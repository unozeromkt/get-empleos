import type { SupabaseClient } from "@supabase/supabase-js";

import { candidateProfileSchema } from "@/lib/ai/schemas/candidate-profile";
import { jobProfileSchema } from "@/lib/ai/schemas/job-profile";
import { sha256 } from "@/lib/documents/hash";
import { toCandidateEvidence, toJobRequirements } from "@/lib/matching/adapters";
import { DEFAULT_SCORING_CONFIG } from "@/lib/matching/config";
import { calculateMatch } from "@/lib/matching/engine";
import type { ScoringConfiguration } from "@/lib/matching/types";
import type { AIRun } from "@/lib/queue/enqueue";
import type { HandlerResult } from "@/lib/queue/dispatch";

/**
 * Calcula el match de un candidato contra una oferta.
 *
 * NO llama a ningún LLM: solo lee los perfiles ya estructurados y ejecuta el
 * motor determinístico. Va por la cola porque puede haber muchos candidatos
 * por oferta y no queremos bloquear la respuesta del usuario.
 */
export async function handleCalculateMatch(
  supabase: SupabaseClient,
  run: AIRun
): Promise<HandlerResult> {
  const { data: jc } = await supabase
    .from("job_candidates")
    .select("id, job_id, profile_version_id")
    .eq("id", run.entity_id)
    .maybeSingle();

  if (!jc) {
    return { ok: false, code: "JOB_CANDIDATE_NOT_FOUND", message: "El candidato ya no existe.", retryable: false };
  }

  // ── Perfil canónico de la oferta ──
  const { data: job } = await supabase
    .from("jobs")
    .select("id, current_profile_version_id, company_id")
    .eq("id", jc.job_id)
    .maybeSingle();

  if (!job?.current_profile_version_id) {
    // Una oferta creada a mano no tiene perfil estructurado. No es un error:
    // simplemente no hay criterios contra los que evaluar.
    return {
      ok: false,
      code: "JOB_HAS_NO_PROFILE",
      message: "La oferta no tiene perfil estructurado. Créala con IA para poder evaluar candidatos.",
      retryable: false,
    };
  }

  const { data: jobVersion } = await supabase
    .from("job_profile_versions")
    .select("id, profile, prompt_version, model_name")
    .eq("id", job.current_profile_version_id)
    .maybeSingle();

  // ── Perfil canónico del candidato ──
  if (!jc.profile_version_id) {
    return {
      ok: false,
      code: "CANDIDATE_HAS_NO_PROFILE",
      message: "El candidato no tiene hoja de vida procesada.",
      retryable: false,
    };
  }

  const { data: candidateVersion } = await supabase
    .from("candidate_profile_versions")
    .select("id, ai_profile, confirmed_profile")
    .eq("id", jc.profile_version_id)
    .maybeSingle();

  if (!jobVersion || !candidateVersion) {
    return { ok: false, code: "PROFILE_VERSION_MISSING", message: "Falta un perfil.", retryable: false };
  }

  // El perfil confirmado por la persona manda sobre la inferencia (spec §33)
  const rawCandidateProfile = candidateVersion.confirmed_profile ?? candidateVersion.ai_profile;

  const parsedJob = jobProfileSchema.safeParse(jobVersion.profile);
  const parsedCandidate = candidateProfileSchema.safeParse(rawCandidateProfile);

  if (!parsedJob.success || !parsedCandidate.success) {
    return {
      ok: false,
      code: "PROFILE_VALIDATION_FAILED",
      message: "Alguno de los perfiles no valida contra su schema.",
      retryable: false,
    };
  }

  // ── Configuración de scoring: por oferta > por empresa > global ──
  const config = await resolveScoringConfig(supabase, jc.job_id as string, job.company_id as string | null);

  // ── Cálculo determinístico ──
  const requirements = toJobRequirements(parsedJob.data);
  const evidence = toCandidateEvidence(parsedCandidate.data);
  const result = calculateMatch(requirements, evidence, config);

  // Idempotencia (spec §34): si nada relevante cambió, no se recalcula
  const inputHash = sha256(
    JSON.stringify({
      job: jobVersion.id,
      candidate: candidateVersion.id,
      scoring: config.version,
    })
  );

  const { data: existing } = await supabase
    .from("match_results")
    .select("id, input_hash")
    .eq("job_candidate_id", jc.id)
    .eq("is_current", true)
    .maybeSingle();

  if (existing?.input_hash === inputHash) {
    return { ok: true }; // ya calculado con las mismas versiones
  }

  // Nunca se recalcula un histórico en silencio: se marca como no vigente y
  // se inserta uno nuevo (spec §18)
  if (existing) {
    await supabase.from("match_results").update({ is_current: false }).eq("id", existing.id);
  }

  const { data: inserted, error: insertError } = await supabase
    .from("match_results")
    .insert({
      job_candidate_id: jc.id,
      job_id: jc.job_id,
      job_profile_version_id: jobVersion.id,
      candidate_profile_version_id: candidateVersion.id,
      overall_score: result.overallScore,
      band: result.band,
      score_confidence: result.scoreConfidence,
      category_scores: result.categoryScores,
      applied_weights: result.appliedWeights,
      critical_gaps: result.criticalGaps,
      explanation: result.explanation,
      scoring_version: result.scoringVersion,
      model_name: jobVersion.model_name,
      prompt_version: jobVersion.prompt_version,
      input_hash: inputHash,
      is_current: true,
    })
    .select("id")
    .single();

  if (insertError || !inserted) {
    return { ok: false, code: "MATCH_INSERT_FAILED", message: "No se pudo guardar el resultado.", retryable: true };
  }

  // Detalle por requisito: es lo que sustenta el "¿por qué este score?" (§19)
  if (result.requirements.length > 0) {
    const { error: reqError } = await supabase.from("match_requirement_results").insert(
      result.requirements.map((r) => ({
        match_result_id: inserted.id,
        requirement_type: r.type,
        requirement_text: r.requirementText.slice(0, 500),
        importance: r.importance,
        status: r.status,
        match_type: r.matchType,
        match_score: r.matchScore,
        candidate_value: r.candidateValue?.slice(0, 500) ?? null,
        candidate_evidence: r.candidateEvidence.slice(0, 1000),
        confidence: r.confidence,
      }))
    );

    if (reqError) {
      return { ok: false, code: "REQUIREMENTS_INSERT_FAILED", message: "No se pudo guardar el detalle.", retryable: true };
    }
  }

  return { ok: true };
}

/** Ámbito más específico primero: oferta → empresa → global (spec §12.1). */
async function resolveScoringConfig(
  supabase: SupabaseClient,
  jobId: string,
  companyId: string | null
): Promise<ScoringConfiguration> {
  const { data: rows } = await supabase
    .from("scoring_configurations")
    .select("version, scope, weights, bands, experience_weights, minimum_profile_confidence, job_id, company_id")
    .eq("is_active", true);

  if (!rows || rows.length === 0) return DEFAULT_SCORING_CONFIG;

  const byJob = rows.find((r) => r.scope === "job" && r.job_id === jobId);
  const byCompany = companyId ? rows.find((r) => r.scope === "company" && r.company_id === companyId) : undefined;
  const global = rows.find((r) => r.scope === "global");

  const chosen = byJob ?? byCompany ?? global;
  if (!chosen) return DEFAULT_SCORING_CONFIG;

  return {
    version: chosen.version as string,
    weights: chosen.weights as ScoringConfiguration["weights"],
    bands: chosen.bands as ScoringConfiguration["bands"],
    experience_weights: chosen.experience_weights as ScoringConfiguration["experience_weights"],
    minimum_profile_confidence: Number(chosen.minimum_profile_confidence),
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";

import { TALENT_SEARCH_LIMITS } from "@/lib/ai/config";
import { candidateProfileSchema } from "@/lib/ai/schemas/candidate-profile";
import type { TalentQuery } from "@/lib/ai/schemas/talent-query";
import { toCandidateEvidence } from "@/lib/matching/adapters";
import { DEFAULT_SCORING_CONFIG } from "@/lib/matching/config";
import { calculateMatch } from "@/lib/matching/engine";
import type { RequirementResult, ScoringConfiguration } from "@/lib/matching/types";
import { normalizeTerm } from "@/lib/search/normalize";
import { queryToRecallParams, queryToRequirements } from "@/lib/search/query-adapter";

/**
 * Búsqueda de talento — módulo 04.
 *
 * Tres pasos: recall en SQL → scoring con el motor determinístico → orden.
 * El LLM ya hizo su parte antes (interpretar la frase) y no participa aquí.
 *
 * Referencia: docs/BUSQUEDA_LENGUAJE_NATURAL.md §6
 */

export interface TalentSearchRow {
  profileVersionId: string;
  candidateId: string | null;
  documentId: string | null;
  /** Solo para mostrar y contactar. Nunca entra al motor (spec §29). */
  displayName: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  headline: string | null;
  totalYears: number | null;
  source: "candidate" | "admin_upload";

  score: number;
  band: string;
  confidence: number;
  requirements: RequirementResult[];
  criticalGaps: Array<{ requirementText: string; reason: string }>;
  summary: string;
}

/** Coincidencia en un CV con texto extraído pero sin perfil canónico. */
export interface UnprocessedHit {
  documentId: string;
  candidateId: string | null;
  filename: string;
  snippet: string;
}

export interface RelaxationSuggestion {
  requirementText: string;
  /** Candidatos cuyo ÚNICO incumplimiento obligatorio es este requisito. */
  unlocked: number;
}

export interface SearchCoverage {
  /** Hojas de vida con perfil canónico, es decir, buscables con ranking. */
  processed: number;
  /** Hojas de vida vigentes sin perfil canónico todavía. */
  pending: number;
}

export interface TalentSearchOutcome {
  results: TalentSearchRow[];
  /** Perfiles que pasaron el recall y fueron puntuados. */
  evaluated: number;
  /** Puntuados que no cumplen ni un solo criterio. Se cuentan, no se ocultan. */
  discarded: number;
  relaxations: RelaxationSuggestion[];
  unprocessed: UnprocessedHit[];
  coverage: SearchCoverage;
}

interface SearchIndexRow {
  profile_version_id: string;
  candidate_id: string | null;
  document_id: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  headline: string | null;
  total_years: number | string | null;
  source: "candidate" | "admin_upload";
}

export async function runTalentSearch(
  supabase: SupabaseClient,
  query: TalentQuery
): Promise<TalentSearchOutcome> {
  const coverage = await readCoverage(supabase);
  const recallParams = queryToRecallParams(query);

  const { data: recalled, error: recallError } = await supabase.rpc("talent_search_recall", {
    p_terms: recallParams.terms,
    p_city: recallParams.city,
    p_min_years: recallParams.minYears,
    p_limit: TALENT_SEARCH_LIMITS.recallLimit,
  });

  if (recallError) {
    throw new Error(`Fallo el recall de búsqueda: ${recallError.message}`);
  }

  const versionIds = ((recalled ?? []) as Array<{ profile_version_id: string }>).map(
    (r) => r.profile_version_id
  );

  const unprocessed = await findUnprocessedHits(supabase, recallParams.terms);

  if (versionIds.length === 0) {
    return { results: [], evaluated: 0, discarded: 0, relaxations: [], unprocessed, coverage };
  }

  const [{ data: versions }, { data: indexRows }] = await Promise.all([
    supabase
      .from("candidate_profile_versions")
      .select("id, ai_profile, confirmed_profile")
      .in("id", versionIds),
    supabase
      .from("candidate_search_index")
      .select(
        "profile_version_id, candidate_id, document_id, display_name, email, phone, city, headline, total_years, source"
      )
      .in("profile_version_id", versionIds),
  ]);

  const indexById = new Map<string, SearchIndexRow>(
    ((indexRows ?? []) as SearchIndexRow[]).map((row) => [row.profile_version_id, row])
  );

  const config = await resolveGlobalScoringConfig(supabase);
  const requirements = queryToRequirements(query);

  const scored: TalentSearchRow[] = [];
  const allRequirementSets: RequirementResult[][] = [];
  let discarded = 0;

  for (const version of versions ?? []) {
    // Lo confirmado por la persona manda sobre lo inferido por la IA (spec §33)
    const raw = version.confirmed_profile ?? version.ai_profile;
    const parsed = candidateProfileSchema.safeParse(raw);

    // Un perfil que no valida contra su schema se salta en silencio: es un dato
    // roto, no un candidato malo, y ensuciar el ranking con él sería peor.
    if (!parsed.success) continue;

    const evidence = toCandidateEvidence(parsed.data);
    const match = calculateMatch(requirements, evidence, config);
    allRequirementSets.push(match.requirements);

    // Quien no cumple NI UN criterio no se muestra, pero se cuenta y se dice
    // en pantalla. Ocultarlo en silencio sería el mismo error que descartarlo.
    const hasAnyMatch = match.requirements.some(
      (r) => r.status === "matched" || r.status === "partial"
    );

    if (!hasAnyMatch) {
      discarded++;
      continue;
    }

    const index = indexById.get(version.id as string);

    scored.push({
      profileVersionId: version.id as string,
      candidateId: index?.candidate_id ?? null,
      documentId: index?.document_id ?? null,
      displayName: index?.display_name?.trim() || "Sin nombre en el CV",
      email: index?.email ?? null,
      phone: index?.phone ?? null,
      city: index?.city ?? null,
      headline: index?.headline ?? null,
      totalYears: index?.total_years === null || index?.total_years === undefined
        ? null
        : Number(index.total_years),
      source: index?.source ?? "admin_upload",
      score: match.overallScore,
      band: match.band,
      confidence: match.scoreConfidence,
      requirements: match.requirements,
      criticalGaps: match.criticalGaps,
      summary: match.explanation.summary,
    });
  }

  scored.sort((a, b) => b.score - a.score || b.confidence - a.confidence);

  return {
    results: scored.slice(0, TALENT_SEARCH_LIMITS.maxResults),
    evaluated: allRequirementSets.length,
    discarded,
    relaxations: suggestRelaxations(allRequirementSets),
    unprocessed,
    coverage,
  };
}

/**
 * Qué criterio está bloqueando a más gente.
 *
 * Solo cuenta a quien falla EXACTAMENTE un requisito obligatorio: ese es el
 * único caso en el que quitarlo cambia algo para esa persona. Es aritmética
 * sobre el resultado ya calculado — ni una consulta ni una llamada extra.
 */
export function suggestRelaxations(
  requirementSets: RequirementResult[][]
): RelaxationSuggestion[] {
  const blockers = new Map<string, number>();

  for (const requirements of requirementSets) {
    const failed = requirements.filter(
      (r) => r.importance !== "preferred" && r.status === "not_found"
    );

    if (failed.length !== 1) continue;

    const key = failed[0].requirementText;
    blockers.set(key, (blockers.get(key) ?? 0) + 1);
  }

  return Array.from(blockers.entries())
    .map(([requirementText, unlocked]) => ({ requirementText, unlocked }))
    .filter((s) => s.unlocked > 0)
    .sort((a, b) => b.unlocked - a.unlocked)
    .slice(0, 3);
}

/**
 * Cobertura real de la búsqueda.
 *
 * `pending` es una diferencia de conteos, no una lista exacta: basta para
 * decirle al reclutador cuántas hojas de vida todavía no son buscables con
 * ranking, que es la pregunta que importa.
 */
async function readCoverage(supabase: SupabaseClient): Promise<SearchCoverage> {
  const [{ count: documents }, { count: processed }] = await Promise.all([
    supabase
      .from("candidate_documents")
      .select("id", { count: "exact", head: true })
      .eq("is_current", true),
    supabase
      .from("candidate_search_index")
      .select("profile_version_id", { count: "exact", head: true }),
  ]);

  return {
    processed: processed ?? 0,
    pending: Math.max(0, (documents ?? 0) - (processed ?? 0)),
  };
}

/**
 * Segundo nivel de resultados: CV con texto extraído pero sin perfil canónico.
 *
 * Se devuelven SIN puntaje y la UI los muestra en una sección aparte. Mezclar
 * una coincidencia de texto con un score real en la misma lista ordenada sería
 * mentir sobre lo que el sistema sabe de esa persona.
 */
async function findUnprocessedHits(
  supabase: SupabaseClient,
  terms: string[]
): Promise<UnprocessedHit[]> {
  if (terms.length === 0) return [];

  const { data: hits } = await supabase
    .from("candidate_documents")
    .select("id, candidate_id, original_filename, extracted_text")
    .eq("is_current", true)
    .not("extracted_text", "is", null)
    .textSearch("extracted_text", terms.join(" or "), { type: "websearch", config: "spanish" })
    .limit(TALENT_SEARCH_LIMITS.maxUnprocessedHits * 2);

  if (!hits || hits.length === 0) return [];

  // Los que ya tienen perfil canónico salen en el ranking; aquí sobran
  const { data: indexed } = await supabase
    .from("candidate_search_index")
    .select("document_id")
    .in("document_id", hits.map((h) => h.id as string));

  const alreadyRanked = new Set((indexed ?? []).map((r) => r.document_id as string));

  return hits
    .filter((h) => !alreadyRanked.has(h.id as string))
    .slice(0, TALENT_SEARCH_LIMITS.maxUnprocessedHits)
    .map((h) => ({
      documentId: h.id as string,
      candidateId: (h.candidate_id as string | null) ?? null,
      filename: (h.original_filename as string) ?? "hoja de vida",
      snippet: buildSnippet((h.extracted_text as string) ?? "", terms),
    }));
}

/** Fragmento del CV alrededor del primer término encontrado. */
export function buildSnippet(text: string, terms: string[], radius = 110): string {
  const haystack = normalizeTerm(text);

  for (const term of terms) {
    const at = haystack.indexOf(term);
    if (at === -1) continue;

    const start = Math.max(0, at - radius);
    const end = Math.min(text.length, at + term.length + radius);

    return `${start > 0 ? "…" : ""}${text.slice(start, end).replace(/\s+/g, " ").trim()}${
      end < text.length ? "…" : ""
    }`;
  }

  return text.slice(0, radius * 2).replace(/\s+/g, " ").trim();
}

/**
 * Configuración de scoring global.
 *
 * La búsqueda no tiene oferta ni empresa, así que solo aplica el ámbito global
 * (spec §12.1). Si no hay ninguna activa, se usa la configuración por defecto.
 */
async function resolveGlobalScoringConfig(
  supabase: SupabaseClient
): Promise<ScoringConfiguration> {
  const { data } = await supabase
    .from("scoring_configurations")
    .select("version, weights, bands, experience_weights, minimum_profile_confidence")
    .eq("is_active", true)
    .eq("scope", "global")
    .maybeSingle();

  if (!data) return DEFAULT_SCORING_CONFIG;

  return {
    version: data.version as string,
    weights: data.weights as ScoringConfiguration["weights"],
    bands: data.bands as ScoringConfiguration["bands"],
    experience_weights: data.experience_weights as ScoringConfiguration["experience_weights"],
    minimum_profile_confidence: Number(data.minimum_profile_confidence),
  };
}

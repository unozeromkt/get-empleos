import type { SupabaseClient } from "@supabase/supabase-js";

import { aiConfig } from "@/lib/ai/config";
import { AIExtractionError } from "@/lib/ai/provider";
import { getExtractionProvider } from "@/lib/ai/providers";
import { sanitizeDocumentText, wrapDocument, hasUsableText } from "@/lib/ai/sanitize";
import { sha256 } from "@/lib/documents/hash";
import { enqueueRun, type AIRun } from "@/lib/queue/enqueue";
import type { HandlerResult } from "@/lib/queue/dispatch";

/**
 * Convierte el texto de una hoja de vida en un CanonicalCandidateProfile.
 *
 * El resultado queda en `ai_profile` con estado 'draft'. El candidato lo revisa
 * y confirma después (spec §33): hasta entonces no se toca su perfil.
 */
export async function handleExtractCandidateProfile(
  supabase: SupabaseClient,
  run: AIRun
): Promise<HandlerResult> {
  const { data: doc, error: docError } = await supabase
    .from("candidate_documents")
    .select("id, candidate_id, extracted_text, version")
    .eq("id", run.entity_id)
    .maybeSingle();

  if (docError || !doc) {
    return {
      ok: false,
      code: "DOCUMENT_NOT_FOUND",
      message: "El documento ya no existe.",
      retryable: false,
    };
  }

  const rawText = (doc.extracted_text as string | null) ?? "";

  if (!hasUsableText(rawText)) {
    await supabase
      .from("candidate_documents")
      .update({
        status: "failed",
        error_code: "INSUFFICIENT_TEXT",
        error_message: "La hoja de vida no tiene texto suficiente para extraer un perfil.",
      })
      .eq("id", doc.id);

    return { ok: false, code: "INSUFFICIENT_TEXT", message: "Texto insuficiente.", retryable: false };
  }

  // El CV es contenido NO CONFIABLE (spec §26)
  const sanitized = sanitizeDocumentText(rawText, aiConfig.maxDocumentChars);
  const wrapped = wrapDocument(sanitized.text);

  try {
    const provider = getExtractionProvider();
    const { data: profile, metadata } = await provider.extractCandidateProfile(wrapped);

    const warnings = [...profile.profile_metadata.warnings];
    if (sanitized.flags.includes("role_marker_neutralized")) {
      warnings.push(
        "La hoja de vida contenía marcadores que simulaban instrucciones para la IA. Se neutralizaron y se trataron como texto."
      );
    }
    if (sanitized.truncated) {
      warnings.push("La hoja de vida se truncó por longitud. Revisa que no falte información al final.");
    }

    const finalProfile = {
      ...profile,
      profile_metadata: { ...profile.profile_metadata, warnings },
    };

    // Una versión nueva desplaza a la anterior, que se conserva como historia
    if (doc.candidate_id) {
      await supabase
        .from("candidate_profile_versions")
        .update({ is_current: false, status: "superseded" })
        .eq("candidate_id", doc.candidate_id)
        .eq("is_current", true);
    }

    const { error: insertError } = await supabase.from("candidate_profile_versions").insert({
      candidate_id: doc.candidate_id,
      source_document_id: doc.id,
      version: (doc.version as number) ?? 1,
      ai_profile: finalProfile,
      confirmed_profile: null, // se rellena cuando la persona revisa (spec §33)
      profile_hash: sha256(JSON.stringify(finalProfile)),
      overall_confidence: finalProfile.profile_metadata.overall_confidence,
      extractor_version: metadata.extractorVersion,
      prompt_version: metadata.promptVersion,
      model_provider: metadata.provider,
      model_name: metadata.model,
      status: "draft",
      is_current: true,
    });

    if (insertError) {
      return {
        ok: false,
        code: "PROFILE_INSERT_FAILED",
        message: "No se pudo guardar el perfil extraído.",
        retryable: true,
      };
    }

    await supabase
      .from("candidate_documents")
      .update({ status: "needs_review", error_code: null, error_message: null })
      .eq("id", doc.id);

    // Los CV que sube el admin no pasan por revisión del candidato: se evalúan
    // directamente. Se enlaza el perfil recién creado y se encola el match.
    const { data: version } = await supabase
      .from("candidate_profile_versions")
      .select("id")
      .eq("source_document_id", doc.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (version) {
      const { data: jobCandidates } = await supabase
        .from("job_candidates")
        .select("id")
        .eq("document_id", doc.id);

      for (const jc of jobCandidates ?? []) {
        await supabase
          .from("job_candidates")
          .update({
            profile_version_id: version.id,
            // Nombre y contacto salen del CV: sirven para contactar a la
            // persona, nunca para puntuarla (spec §29)
            display_name: finalProfile.contact.full_name?.slice(0, 200) ?? null,
            email: finalProfile.contact.email?.slice(0, 200) ?? null,
            phone: finalProfile.contact.phone?.slice(0, 50) ?? null,
          })
          .eq("id", jc.id);

        await enqueueRun(supabase, {
          runType: "calculate_match",
          entityType: "job_candidate",
          entityId: jc.id as string,
        });
      }
    }

    return {
      ok: true,
      metadata: {
        modelProvider: metadata.provider,
        modelName: metadata.model,
        promptVersion: metadata.promptVersion,
        extractorVersion: metadata.extractorVersion,
        tokensIn: metadata.tokensIn,
        tokensOut: metadata.tokensOut,
        costUsd: metadata.costUsd,
      },
    };
  } catch (err) {
    const isAIError = err instanceof AIExtractionError;
    const code = isAIError ? err.code : "PROVIDER_ERROR";
    const retryable = isAIError ? err.retryable : true;
    const message = isAIError ? err.message : "Error inesperado al extraer el perfil.";

    if (!retryable || run.attempts >= run.max_attempts) {
      await supabase
        .from("candidate_documents")
        .update({ status: "failed", error_code: code, error_message: message })
        .eq("id", doc.id);
    }

    return { ok: false, code, message, retryable };
  }
}

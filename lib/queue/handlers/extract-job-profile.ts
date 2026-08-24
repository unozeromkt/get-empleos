import type { SupabaseClient } from "@supabase/supabase-js";

import { aiConfig } from "@/lib/ai/config";
import { AIExtractionError } from "@/lib/ai/provider";
import { getExtractionProvider } from "@/lib/ai/providers";
import { sanitizeDocumentText, wrapDocument, hasUsableText } from "@/lib/ai/sanitize";
import { sha256 } from "@/lib/documents/hash";
import type { AIRun } from "@/lib/queue/enqueue";
import type { HandlerResult } from "@/lib/queue/dispatch";

/**
 * Convierte el texto de la oferta en un CanonicalJobProfile validado.
 *
 * El resultado queda SIEMPRE en estado 'draft' con el documento en
 * 'needs_review': la IA no publica nada por su cuenta (spec §5.3).
 */
export async function handleExtractJobProfile(
  supabase: SupabaseClient,
  run: AIRun
): Promise<HandlerResult> {
  const { data: doc, error: docError } = await supabase
    .from("job_documents")
    .select("id, extracted_text, extracted_text_hash, mime_type, uploaded_by, company_id")
    .eq("id", run.entity_id)
    .maybeSingle();

  if (docError || !doc) {
    return { ok: false, code: "DOCUMENT_NOT_FOUND", message: "El documento ya no existe.", retryable: false };
  }

  const rawText = (doc.extracted_text as string | null) ?? "";

  if (!hasUsableText(rawText)) {
    await supabase
      .from("job_documents")
      .update({
        status: "failed",
        error_code: "INSUFFICIENT_TEXT",
        error_message: "El documento no tiene texto suficiente para extraer una oferta.",
      })
      .eq("id", doc.id);

    return { ok: false, code: "INSUFFICIENT_TEXT", message: "Texto insuficiente.", retryable: false };
  }

  // El documento es contenido NO CONFIABLE: se sanea y se delimita antes de
  // que llegue al modelo (spec §26)
  const sanitized = sanitizeDocumentText(rawText, aiConfig.maxDocumentChars);
  const wrapped = wrapDocument(sanitized.text);

  const source = doc.mime_type === "application/pdf" ? "pdf" : "docx";

  try {
    const provider = getExtractionProvider();
    const { data: profile, metadata } = await provider.extractJobProfile(wrapped, source);

    // Las banderas del saneado se conservan como advertencias visibles para el
    // revisor: si un documento traía instrucciones ocultas, queremos que se vea
    const warnings = [...profile.extraction_metadata.warnings];
    if (sanitized.flags.includes("role_marker_neutralized")) {
      warnings.push(
        "El documento contenía marcadores que simulaban instrucciones para la IA. Se neutralizaron y se trataron como texto."
      );
    }
    if (sanitized.flags.includes("invisible_characters_removed")) {
      warnings.push("El documento contenía caracteres invisibles, que fueron eliminados.");
    }
    if (sanitized.truncated) {
      warnings.push("El documento se truncó por longitud. Revisa que no falte información al final.");
    }

    const finalProfile = {
      ...profile,
      extraction_metadata: { ...profile.extraction_metadata, warnings },
    };

    const { error: insertError } = await supabase.from("job_profile_versions").insert({
      job_id: null, // la oferta aún no existe: se crea al confirmar
      source_document_id: doc.id,
      version: 1,
      source,
      profile: finalProfile,
      ai_profile: finalProfile, // copia intacta, para medir cuánto corrige el humano (spec §37)
      profile_hash: sha256(JSON.stringify(finalProfile)),
      confidence: finalProfile.extraction_metadata.confidence,
      extractor_version: metadata.extractorVersion,
      prompt_version: metadata.promptVersion,
      model_provider: metadata.provider,
      model_name: metadata.model,
      status: "draft",
      created_by: doc.uploaded_by,
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
      .from("job_documents")
      .update({ status: "needs_review", error_code: null, error_message: null })
      .eq("id", doc.id);

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

    // Solo se marca el documento como fallido cuando ya no se va a reintentar
    if (!retryable || run.attempts >= run.max_attempts) {
      await supabase
        .from("job_documents")
        .update({ status: "failed", error_code: code, error_message: message })
        .eq("id", doc.id);
    }

    return { ok: false, code, message, retryable };
  }
}

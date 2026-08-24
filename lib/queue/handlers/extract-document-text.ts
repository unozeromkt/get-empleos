import type { SupabaseClient } from "@supabase/supabase-js";

import { extractDocumentText, DocumentExtractionError } from "@/lib/documents/extract-text";
import { enqueueRun, type AIRun } from "@/lib/queue/enqueue";
import type { HandlerResult } from "@/lib/queue/dispatch";

/**
 * Descarga el documento de Storage y extrae su texto.
 *
 * No llama a ningún LLM: es puro procesamiento local. Se separa del paso de
 * extracción estructurada para que un fallo de PDF.js no se confunda con un
 * fallo del proveedor de IA, y para que reintentar uno no repita el otro.
 */
export async function handleExtractDocumentText(
  supabase: SupabaseClient,
  run: AIRun
): Promise<HandlerResult> {
  const table = run.entity_type === "job_document" ? "job_documents" : "candidate_documents";
  const bucket = run.entity_type === "job_document" ? "job-documents" : "cvs";

  const { data: doc, error: docError } = await supabase
    .from(table)
    .select("id, storage_path, mime_type, status")
    .eq("id", run.entity_id)
    .maybeSingle();

  if (docError || !doc) {
    return { ok: false, code: "DOCUMENT_NOT_FOUND", message: "El documento ya no existe.", retryable: false };
  }

  await supabase.from(table).update({ status: "extracting_text" }).eq("id", doc.id);

  const { data: file, error: downloadError } = await supabase.storage
    .from(bucket)
    .download(doc.storage_path as string);

  if (downloadError || !file) {
    return {
      ok: false,
      code: "STORAGE_DOWNLOAD_FAILED",
      message: "No se pudo descargar el archivo desde Storage.",
      retryable: true,
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await extractDocumentText(buffer, doc.mime_type as string);

    // Un PDF escaneado no da texto. No inventamos nada: se marca como fallido
    // con un código claro para que el revisor humano sepa qué pasó (spec §6).
    if (result.needsOcr) {
      await supabase
        .from(table)
        .update({
          status: "failed",
          error_code: "NO_TEXT_LAYER",
          error_message:
            "El documento no contiene texto extraíble. Puede ser un escaneo o una imagen. Súbelo en un formato con texto seleccionable.",
          ocr_used: false,
          page_count: result.pageCount,
        })
        .eq("id", doc.id);

      return {
        ok: false,
        code: "NO_TEXT_LAYER",
        message: "El documento no tiene capa de texto.",
        retryable: false,
      };
    }

    await supabase
      .from(table)
      .update({
        extracted_text: result.text,
        extracted_text_hash: result.textHash,
        page_count: result.pageCount,
        status: "extracting_profile",
        error_code: null,
        error_message: null,
      })
      .eq("id", doc.id);

    // Encadena el siguiente paso: la extracción estructurada
    await enqueueRun(supabase, {
      runType: run.entity_type === "job_document" ? "extract_job_profile" : "extract_candidate_profile",
      entityType: run.entity_type,
      entityId: doc.id as string,
      inputHash: result.textHash,
    });

    return { ok: true };
  } catch (err) {
    const code = err instanceof DocumentExtractionError ? err.code : "EXTRACTION_FAILED";
    const message =
      err instanceof DocumentExtractionError ? err.message : "Error inesperado al extraer el texto.";

    await supabase
      .from(table)
      .update({ status: "failed", error_code: code, error_message: message })
      .eq("id", doc.id);

    return { ok: false, code, message, retryable: false };
  }
}

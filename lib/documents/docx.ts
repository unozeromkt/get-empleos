import mammoth from "mammoth";

import type { ExtractedDocument } from "@/lib/documents/extract-text";

/**
 * Extracción de texto de DOCX con mammoth.
 *
 * Se usa `extractRawText` en lugar de la conversión a HTML: para extraer datos
 * estructurados solo interesa el contenido, y el marcado únicamente añadiría
 * ruido al prompt y tokens al costo.
 */
export async function extractDocxText(buffer: Buffer): Promise<ExtractedDocument> {
  const result = await mammoth.extractRawText({ buffer });

  return {
    text: result.value ?? "",
    // DOCX no tiene paginación fija: depende del renderizador
    pageCount: null,
    needsOcr: false,
  };
}

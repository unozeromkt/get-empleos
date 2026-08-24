import { extractText, getDocumentProxy } from "unpdf";

import type { ExtractedDocument } from "@/lib/documents/extract-text";

/**
 * Extracción de texto de PDF con unpdf.
 *
 * unpdf empaqueta una build serverless de PDF.js: sin binarios nativos, así
 * que funciona en las funciones de Vercel. Requiere runtime Node, no Edge.
 */
export async function extractPdfText(buffer: Buffer): Promise<ExtractedDocument> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text, totalPages } = await extractText(pdf, { mergePages: true });

  const content = Array.isArray(text) ? text.join("\n\n") : text;

  return {
    text: content ?? "",
    pageCount: totalPages ?? null,
    // Un PDF escaneado es una imagen: PDF.js no devuelve texto. Quien llama
    // decide si intentar OCR o marcar el resultado como datos insuficientes
    // (spec §5.5). Nunca inventamos contenido.
    needsOcr: !content || content.trim().length < 100,
  };
}

import { isAllowedMimeType } from "@/lib/ai/config";
import { sha256 } from "@/lib/documents/hash";

export interface ExtractedDocument {
  text: string;
  pageCount: number | null;
  /** true cuando el documento no dio texto utilizable (probablemente escaneado). */
  needsOcr: boolean;
}

export interface ExtractionOutcome extends ExtractedDocument {
  textHash: string;
}

/** Error de extracción documental con código estable y sin PII. */
export class DocumentExtractionError extends Error {
  constructor(
    public readonly code:
      | "UNSUPPORTED_MIME_TYPE"
      | "EMPTY_DOCUMENT"
      | "CORRUPT_DOCUMENT"
      | "EXTRACTION_FAILED",
    message: string
  ) {
    super(message);
    this.name = "DocumentExtractionError";
  }
}

/**
 * Router de extracción por tipo MIME.
 *
 * Runtime Node obligatorio: unpdf y mammoth no funcionan en Edge.
 * Casos cubiertos por los tests de §43: PDF con texto, DOCX, PDF escaneado,
 * documento vacío y documento corrupto.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionOutcome> {
  if (!isAllowedMimeType(mimeType)) {
    throw new DocumentExtractionError(
      "UNSUPPORTED_MIME_TYPE",
      `Tipo de archivo no soportado: ${mimeType}. Solo se aceptan PDF y DOCX.`
    );
  }

  if (buffer.length === 0) {
    throw new DocumentExtractionError("EMPTY_DOCUMENT", "El archivo está vacío.");
  }

  let extracted: ExtractedDocument;
  try {
    // Import diferido: mantiene estas dependencias fuera del bundle de las
    // rutas que no procesan documentos
    if (mimeType === "application/pdf") {
      const { extractPdfText } = await import("@/lib/documents/pdf");
      extracted = await extractPdfText(buffer);
    } else {
      const { extractDocxText } = await import("@/lib/documents/docx");
      extracted = await extractDocxText(buffer);
    }
  } catch {
    // El error original no se propaga a propósito: puede contener fragmentos
    // del documento, y este mensaje acaba guardado en la base de datos (§21)
    throw new DocumentExtractionError(
      "CORRUPT_DOCUMENT",
      `No se pudo leer el documento (${mimeType}). Puede estar dañado o protegido con contraseña.`
    );
  }

  return { ...extracted, textHash: sha256(extracted.text) };
}

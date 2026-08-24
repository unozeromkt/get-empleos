import { createHash } from "node:crypto";

/**
 * Hashes para deduplicación e idempotencia (spec §21, §34).
 *
 * Si el hash de entrada coincide con el de un run ya exitoso, se reutiliza su
 * resultado en lugar de volver a pagar una llamada al LLM.
 */

export function sha256(input: string | Buffer | Uint8Array): string {
  return createHash("sha256")
    .update(input instanceof Uint8Array ? Buffer.from(input) : input)
    .digest("hex");
}

/**
 * Hash de entrada de un run: identifica de forma única la combinación de
 * trabajo, contenido y versiones. Cambiar el prompt o el extractor invalida
 * la caché, que es exactamente lo que queremos.
 */
export function buildInputHash(parts: {
  runType: string;
  contentHash: string;
  promptVersion?: string;
  extractorVersion?: string;
  model?: string;
}): string {
  return sha256(
    [
      parts.runType,
      parts.contentHash,
      parts.promptVersion ?? "",
      parts.extractorVersion ?? "",
      parts.model ?? "",
    ].join("|")
  );
}

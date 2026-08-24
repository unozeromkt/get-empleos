import type { CandidateProfile } from "@/lib/ai/schemas/candidate-profile";
import type { JobProfile } from "@/lib/ai/schemas/job-profile";
import type { TalentQuery } from "@/lib/ai/schemas/talent-query";

/**
 * Capa de abstracción de IA — spec §23.
 *
 * La aplicación no se acopla a ningún proveedor concreto. Cambiar de OpenAI a
 * otro solo requiere implementar esta interfaz y registrarla en el factory
 * (`lib/ai/providers/index.ts`). Ni el dominio ni la UI se enteran.
 */

/** Metadatos de una llamada, para auditoría y control de costo (spec §21). */
export interface AICallMetadata {
  provider: string;
  model: string;
  promptVersion: string;
  extractorVersion: string;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
}

export interface AIExtractionResult<T> {
  data: T;
  metadata: AICallMetadata;
}

/** Error de extracción con código estable, apto para guardar sin PII. */
export class AIExtractionError extends Error {
  constructor(
    public readonly code:
      | "AI_DISABLED"
      | "SCHEMA_VALIDATION_FAILED"
      | "EMPTY_RESPONSE"
      | "REFUSAL"
      | "TIMEOUT"
      | "CONNECTION_ERROR"
      | "RATE_LIMITED"
      | "PROVIDER_ERROR",
    message: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = "AIExtractionError";
  }
}

export interface AIProfileExtractionProvider {
  readonly name: string;

  /**
   * Extrae un CanonicalJobProfile del texto de una oferta.
   * El texto ya debe venir saneado y delimitado (`lib/ai/sanitize.ts`).
   *
   * Debe validar la respuesta contra el schema. Si no valida, lanzar
   * AIExtractionError — nunca devolver un perfil inconsistente (spec §23).
   */
  extractJobProfile(
    wrappedDocument: string,
    source: "pdf" | "docx" | "manual"
  ): Promise<AIExtractionResult<JobProfile>>;

  /**
   * Extrae un CanonicalCandidateProfile del texto de una hoja de vida.
   * Mismas garantías: texto ya saneado, validación contra schema, y nunca
   * devolver un perfil inconsistente.
   */
  extractCandidateProfile(
    wrappedDocument: string
  ): Promise<AIExtractionResult<CandidateProfile>>;
}

/**
 * Interpretación de búsquedas en lenguaje natural — módulo 04.
 *
 * Va en una interfaz aparte porque no es extracción de documentos: la entrada
 * es una frase que escribe un admin, no un archivo subido por un tercero. Un
 * proveedor puede implementar una, otra o ambas.
 *
 * El LLM se limita a interpretar la pregunta. El ranking lo calcula después
 * `lib/matching/engine.ts`, sin intervención del modelo.
 */
export interface AITalentQueryProvider {
  readonly name: string;

  /**
   * Convierte la frase del reclutador en criterios estructurados.
   * Debe validar la respuesta contra `talentQuerySchema` y lanzar
   * AIExtractionError si no valida.
   */
  parseTalentQuery(wrappedQuery: string): Promise<AIExtractionResult<TalentQuery>>;
}

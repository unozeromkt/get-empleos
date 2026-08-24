/**
 * Configuración central del módulo de IA.
 *
 * Regla de oro: si `AI_ENABLED` es false o falta `OPENAI_API_KEY`, todo el
 * módulo queda inerte y la plataforma funciona exactamente igual que antes.
 * Nada de esto debe poder romper los flujos existentes.
 */

/** Versión del extractor. Se guarda en cada perfil para poder explicarlo después (spec §22). */
export const EXTRACTOR_VERSION = "job-extractor-v1";

function flag(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "true" || raw === "1";
}

function num(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const aiConfig = {
  enabled: flag("AI_ENABLED") && !!process.env.OPENAI_API_KEY,

  provider: process.env.AI_PROVIDER ?? "openai",
  // No usar un modelo de razonamiento (gpt-5-mini, o1, o3): para extracción
  // estructurada gastan tokens de "pensamiento" innecesarios, son más lentos
  // y más caros en la práctica (ver plan §13, incidente 2026-08-11).
  extractionModel: process.env.AI_EXTRACTION_MODEL ?? "gpt-4.1-mini",
  embeddingModel: process.env.AI_EMBEDDING_MODEL ?? "text-embedding-3-small",

  /**
   * Timeout del cliente, deliberadamente por debajo del límite de la función
   * serverless (maxDuration = 60s). Preferimos fallar de forma limpia y
   * registrada a que Vercel corte la ejecución a mitad y deje el run colgado
   * (ver plan §6.1).
   *
   * 50s y no 45s: la extracción de una hoja de vida tarda entre 28s y 44s
   * medidos en producción — el schema canónico produce 1.000-2.100 tokens de
   * salida — así que 45s dejaba los CV largos justo en el filo y fallaban por
   * TIMEOUT de forma intermitente. Los 10s restantes son el margen para las
   * escrituras en base de datos posteriores.
   */
  requestTimeoutMs: num("AI_REQUEST_TIMEOUT_MS", 50_000),

  /** En Vercel Hobby: 1 run por invocación, con el cron disparando cada minuto. */
  workerBatchSize: num("AI_WORKER_BATCH_SIZE", 1),

  dailyCostLimitUsd: num("AI_DAILY_COST_LIMIT_USD", 25),

  /** Tamaño máximo de texto que se envía al modelo, en caracteres. */
  maxDocumentChars: num("AI_MAX_DOCUMENT_CHARS", 60_000),

  features: {
    jobCreation: flag("FEATURE_AI_JOB_CREATION"),
    resumeParsing: flag("FEATURE_AI_RESUME_PARSING"),
    matching: flag("FEATURE_AI_MATCHING"),
    talentSearch: flag("FEATURE_AI_TALENT_SEARCH"),
  },
} as const;

/** Límites de subida de documentos (spec §28). */
export const DOCUMENT_LIMITS = {
  maxSizeBytes: 10 * 1024 * 1024, // 10 MB
  allowedMimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  ] as const,
} as const;

export type AllowedMimeType = (typeof DOCUMENT_LIMITS.allowedMimeTypes)[number];

export function isAllowedMimeType(mime: string): mime is AllowedMimeType {
  return (DOCUMENT_LIMITS.allowedMimeTypes as readonly string[]).includes(mime);
}

export function extensionForMime(mime: string): string {
  return mime === "application/pdf" ? "pdf" : "docx";
}

/**
 * Límites de la búsqueda de talento (módulo 04).
 *
 * `recallLimit` no es un filtro de calidad: es la barrera para el día que la
 * base crezca. Con unos cientos de hojas de vida se puntúa a todo el mundo, que
 * es justo lo que queremos — el peor fallo de un buscador de talento es dejar
 * fuera a alguien que sí encajaba.
 */
export const TALENT_SEARCH_LIMITS = {
  /** Máximo de perfiles que pasan del recall al motor de scoring. */
  recallLimit: num("TALENT_SEARCH_RECALL_LIMIT", 400),
  /** Máximo de resultados devueltos a la UI. */
  maxResults: num("TALENT_SEARCH_MAX_RESULTS", 60),
  /** Máximo de coincidencias del tier de CV sin perfil canónico. */
  maxUnprocessedHits: 20,
  /** Longitud máxima de la consulta que se envía al modelo. */
  maxQueryChars: 500,
} as const;

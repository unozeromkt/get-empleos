import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { z } from "zod";

import { aiConfig, EXTRACTOR_VERSION } from "@/lib/ai/config";
import {
  AIExtractionError,
  type AIProfileExtractionProvider,
  type AIExtractionResult,
  type AITalentQueryProvider,
} from "@/lib/ai/provider";
import { jobProfileSchema, type JobProfile } from "@/lib/ai/schemas/job-profile";
import {
  candidateProfileSchema,
  type CandidateProfile,
} from "@/lib/ai/schemas/candidate-profile";
import {
  JOB_EXTRACTION_SYSTEM_PROMPT,
  JOB_EXTRACTION_PROMPT_VERSION,
  buildJobExtractionUserPrompt,
} from "@/lib/ai/prompts/job-extraction";
import {
  RESUME_EXTRACTION_SYSTEM_PROMPT,
  RESUME_EXTRACTION_PROMPT_VERSION,
  buildResumeExtractionUserPrompt,
} from "@/lib/ai/prompts/resume-extraction";
import {
  TALENT_QUERY_SYSTEM_PROMPT,
  TALENT_QUERY_PROMPT_VERSION,
  buildTalentQueryUserPrompt,
} from "@/lib/ai/prompts/talent-query";
import { talentQuerySchema, type TalentQuery } from "@/lib/ai/schemas/talent-query";

/**
 * Precios por millón de tokens, en USD. Verificados el 2026-08-11 contra
 * https://developers.openai.com/api/docs/pricing (Standard pricing).
 *
 * ⚠️ Re-verificar si cambian de proveedor o si OpenAI actualiza precios. Un
 * modelo ausente de esta tabla se procesa igual: se registran los tokens y
 * `cost_usd` queda en null. Preferimos no reportar costo a reportar uno
 * inventado.
 */
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  // gpt-5-mini es un modelo de razonamiento: el output incluye tokens de
  // razonamiento no visibles, que se facturan igual que el output normal.
  // En la práctica cuesta bastante más que su precio por token sugiere
  // (ver docs/AI_SCREENING_IMPLEMENTATION_PLAN.md §13, incidente 2026-08-11).
  "gpt-5-mini": { input: 0.25, output: 2.0 },
};

function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number | null {
  const price = PRICING_PER_MTOK[model];
  if (!price) return null;
  return (tokensIn / 1_000_000) * price.input + (tokensOut / 1_000_000) * price.output;
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // Por debajo del límite de la función serverless: fallamos limpio en
      // lugar de dejar que Vercel corte la ejecución a mitad (plan §6.1)
      timeout: aiConfig.requestTimeoutMs,
      // Sin reintentos del SDK: los reintentos son responsabilidad de la cola,
      // que además espacia con backoff. Con maxRetries > 0 un timeout consumía
      // 2 × requestTimeoutMs de reloj (90s medidos el 2026-08-13), más que el
      // maxDuration de la función, así que Vercel la mataba antes de poder
      // registrar el fallo y el run quedaba colgado en 'running' hasta que lo
      // rescataba requeue_stale_ai_runs, 10 minutos después.
      maxRetries: 0,
    });
  }
  return client;
}

/**
 * Traduce errores del SDK a códigos estables y sin PII.
 *
 * ORDEN IMPORTA: en el SDK de OpenAI, APIConnectionTimeoutError hereda de
 * APIConnectionError, que a su vez hereda de APIError. Si se comprueba
 * `instanceof APIError` primero, CUALQUIER timeout o fallo de conexión cae
 * ahí en vez de en su rama específica, y se pierde la causa real del error
 * (status queda undefined → mensaje "Error del proveedor (?)"). Por eso los
 * subtipos más específicos van antes que el genérico.
 */
function toExtractionError(err: unknown): AIExtractionError {
  if (err instanceof AIExtractionError) return err;

  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return new AIExtractionError(
      "TIMEOUT",
      `El proveedor no respondió dentro de ${aiConfig.requestTimeoutMs}ms.`,
      true
    );
  }

  if (err instanceof OpenAI.APIConnectionError) {
    return new AIExtractionError(
      "CONNECTION_ERROR",
      "No se pudo conectar con el proveedor de IA. Verifica la conectividad de red del servidor.",
      true
    );
  }

  if (err instanceof OpenAI.APIError) {
    if (err.status === 429) {
      return new AIExtractionError("RATE_LIMITED", "Límite de tasa del proveedor alcanzado.", true);
    }
    if (err.status && err.status >= 500) {
      return new AIExtractionError("PROVIDER_ERROR", `Error del proveedor (${err.status}).`, true);
    }
    // 400/401/403/404/422: error del lado de la petición (modelo inválido, API
    // key inválida, schema rechazado). No reintentar sin corregir la causa.
    return new AIExtractionError(
      "PROVIDER_ERROR",
      `Error del proveedor (${err.status ?? "desconocido"}): ${err.message}`,
      false
    );
  }

  return new AIExtractionError("PROVIDER_ERROR", "Error inesperado al llamar al proveedor.", true);
}

/**
 * Extracción estructurada genérica.
 *
 * Ofertas y hojas de vida solo se diferencian en el prompt y el schema; todo
 * lo demás — validación, rechazo, medición de tokens, traducción de errores —
 * es idéntico y vive aquí una sola vez.
 */
async function extractStructured<T>(
  schema: z.ZodType<T>,
  schemaName: string,
  systemPrompt: string,
  userPrompt: string,
  promptVersion: string
): Promise<AIExtractionResult<T>> {
  if (!aiConfig.enabled) {
    throw new AIExtractionError("AI_DISABLED", "El módulo de IA está deshabilitado.", false);
  }

  const model = aiConfig.extractionModel;

  try {
    const completion = await getClient().chat.completions.parse({
      model,
      messages: [
        // System prompt separado del contenido del documento (spec §26)
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      // Structured Outputs en modo strict: el modelo no puede devolver algo
      // que no valide contra el schema
      response_format: zodResponseFormat(schema, schemaName),
    });

    const message = completion.choices[0]?.message;

    if (message?.refusal) {
      throw new AIExtractionError("REFUSAL", "El modelo rechazó procesar el documento.", false);
    }

    const parsed = message?.parsed;
    if (!parsed) {
      throw new AIExtractionError("EMPTY_RESPONSE", "El modelo no devolvió contenido.", true);
    }

    // Segunda validación explícita: no confiamos en que el helper del SDK
    // sea la única barrera antes de persistir (spec §23)
    const validated = schema.safeParse(parsed);
    if (!validated.success) {
      throw new AIExtractionError(
        "SCHEMA_VALIDATION_FAILED",
        "La respuesta del modelo no valida contra el schema.",
        true
      );
    }

    const tokensIn = completion.usage?.prompt_tokens ?? null;
    const tokensOut = completion.usage?.completion_tokens ?? null;

    return {
      data: validated.data,
      metadata: {
        provider: "openai",
        model,
        promptVersion,
        extractorVersion: EXTRACTOR_VERSION,
        tokensIn,
        tokensOut,
        costUsd:
          tokensIn !== null && tokensOut !== null
            ? estimateCostUsd(model, tokensIn, tokensOut)
            : null,
      },
    };
  } catch (err) {
    throw toExtractionError(err);
  }
}

export const openAIProvider: AIProfileExtractionProvider & AITalentQueryProvider = {
  name: "openai",

  async extractJobProfile(
    wrappedDocument: string,
    source: "pdf" | "docx" | "manual"
  ): Promise<AIExtractionResult<JobProfile>> {
    const result = await extractStructured(
      jobProfileSchema,
      "job_profile",
      JOB_EXTRACTION_SYSTEM_PROMPT,
      buildJobExtractionUserPrompt(wrappedDocument),
      JOB_EXTRACTION_PROMPT_VERSION
    );

    // El origen lo sabe el sistema, no el modelo
    return {
      ...result,
      data: {
        ...result.data,
        extraction_metadata: { ...result.data.extraction_metadata, source },
      },
    };
  },

  async extractCandidateProfile(
    wrappedDocument: string
  ): Promise<AIExtractionResult<CandidateProfile>> {
    return extractStructured(
      candidateProfileSchema,
      "candidate_profile",
      RESUME_EXTRACTION_SYSTEM_PROMPT,
      buildResumeExtractionUserPrompt(wrappedDocument),
      RESUME_EXTRACTION_PROMPT_VERSION
    );
  },

  async parseTalentQuery(wrappedQuery: string): Promise<AIExtractionResult<TalentQuery>> {
    return extractStructured(
      talentQuerySchema,
      "talent_query",
      TALENT_QUERY_SYSTEM_PROMPT,
      buildTalentQueryUserPrompt(wrappedQuery),
      TALENT_QUERY_PROMPT_VERSION
    );
  },
};

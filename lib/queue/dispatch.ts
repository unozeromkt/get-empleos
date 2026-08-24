import type { SupabaseClient } from "@supabase/supabase-js";

import { aiConfig } from "@/lib/ai/config";
import { markRunFailed, markRunSucceeded, type AIRun } from "@/lib/queue/enqueue";
import { handleCalculateMatch } from "@/lib/queue/handlers/calculate-match";
import { handleExtractCandidateProfile } from "@/lib/queue/handlers/extract-candidate-profile";
import { handleExtractDocumentText } from "@/lib/queue/handlers/extract-document-text";
import { handleExtractJobProfile } from "@/lib/queue/handlers/extract-job-profile";

export interface HandlerResult {
  ok: boolean;
  code?: string;
  message?: string;
  retryable?: boolean;
  metadata?: {
    modelProvider?: string | null;
    modelName?: string | null;
    promptVersion?: string | null;
    extractorVersion?: string | null;
    tokensIn?: number | null;
    tokensOut?: number | null;
    costUsd?: number | null;
  };
}

type Handler = (supabase: SupabaseClient, run: AIRun) => Promise<HandlerResult>;

/**
 * Registro de handlers por tipo de trabajo.
 *
 * Cada handler recibe solo un cliente de Supabase y el run: ninguna dependencia
 * de Next.js. Es lo que permite mover el worker a Supabase Edge Functions sin
 * reescribir nada si el límite de Vercel Hobby se queda corto (plan §6.1).
 */
const HANDLERS: Partial<Record<AIRun["run_type"], Handler>> = {
  extract_document_text: handleExtractDocumentText,
  extract_job_profile: handleExtractJobProfile,
  extract_candidate_profile: handleExtractCandidateProfile,
  calculate_match: handleCalculateMatch,
  // Fase 5: normalize_skills (taxonomía ESCO), generate_explanation (embeddings)
};

export interface DispatchSummary {
  claimed: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

/**
 * Comprueba el tope de gasto diario antes de procesar.
 * Sin esto, un bucle de reintentos puede vaciar la cuenta sin que nadie se entere.
 */
async function isOverDailyBudget(supabase: SupabaseClient): Promise<boolean> {
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);

  const { data } = await supabase
    .from("ai_processing_runs")
    .select("cost_usd")
    .gte("created_at", since.toISOString())
    .not("cost_usd", "is", null);

  if (!data) return false;

  const total = data.reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);
  return total >= aiConfig.dailyCostLimitUsd;
}

/**
 * Toma trabajo de la cola y lo procesa.
 *
 * `claim_ai_runs` usa FOR UPDATE SKIP LOCKED, así que dos invocaciones
 * solapadas del cron nunca procesan el mismo run.
 */
export async function dispatchPendingRuns(supabase: SupabaseClient): Promise<DispatchSummary> {
  const summary: DispatchSummary = { claimed: 0, succeeded: 0, failed: 0, skipped: 0 };

  if (!aiConfig.enabled) return summary;

  if (await isOverDailyBudget(supabase)) {
    console.warn("[ai-worker] Tope de gasto diario alcanzado. No se procesa nada más hoy.");
    return summary;
  }

  const { data: runs, error } = await supabase.rpc("claim_ai_runs", {
    p_batch_size: aiConfig.workerBatchSize,
  });

  if (error) {
    console.error("[ai-worker] Error al reclamar runs:", error.message);
    return summary;
  }

  const claimed = (runs ?? []) as AIRun[];
  summary.claimed = claimed.length;

  for (const run of claimed) {
    const handler = HANDLERS[run.run_type];

    if (!handler) {
      await markRunFailed(
        supabase,
        run,
        "NO_HANDLER",
        `No hay handler registrado para "${run.run_type}".`,
        false
      );
      summary.skipped++;
      continue;
    }

    try {
      const result = await handler(supabase, run);

      if (result.ok) {
        await markRunSucceeded(supabase, run.id, result.metadata);
        summary.succeeded++;
      } else {
        await markRunFailed(
          supabase,
          run,
          result.code ?? "HANDLER_FAILED",
          result.message ?? "El handler falló sin detalle.",
          result.retryable ?? false
        );
        summary.failed++;
      }
    } catch {
      // Una excepción no controlada no debe dejar el run colgado en 'running'.
      // No se registra el error original: puede contener texto del documento.
      console.error(`[ai-worker] Excepción en run ${run.id} (${run.run_type})`);
      await markRunFailed(
        supabase,
        run,
        "UNHANDLED_EXCEPTION",
        "Excepción no controlada en el handler.",
        true
      );
      summary.failed++;
    }
  }

  return summary;
}

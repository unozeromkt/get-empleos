import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cola de trabajo de IA respaldada por Postgres.
 *
 * Vercel Hobby no permite un scheduler propio (2 cron jobs, 1 ejecución diaria),
 * así que pg_cron dispara el worker cada minuto desde Supabase (plan §6.1).
 * Las tareas se encolan aquí y nunca bloquean la respuesta al usuario.
 */

export type RunType =
  | "extract_document_text"
  | "extract_job_profile"
  | "extract_candidate_profile"
  | "normalize_skills"
  | "calculate_match"
  | "generate_explanation";

export type EntityType = "job_document" | "candidate_document" | "job_candidate";

export interface AIRun {
  id: string;
  run_type: RunType;
  entity_type: EntityType;
  entity_id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  attempts: number;
  max_attempts: number;
  input_hash: string | null;
}

export interface EnqueueOptions {
  runType: RunType;
  entityType: EntityType;
  entityId: string;
  /** Permite reutilizar el resultado de un run idéntico ya exitoso (spec §34). */
  inputHash?: string | null;
  maxAttempts?: number;
}

/**
 * Encola una tarea. Idempotente: si ya existe un run vivo (queued o running)
 * para la misma entidad y tipo, no crea otro. Sin esto, dos clics seguidos en
 * "procesar" duplicarían el costo.
 */
export async function enqueueRun(
  supabase: SupabaseClient,
  options: EnqueueOptions
): Promise<{ id: string } | { error: string }> {
  const { data: existing } = await supabase
    .from("ai_processing_runs")
    .select("id")
    .eq("run_type", options.runType)
    .eq("entity_type", options.entityType)
    .eq("entity_id", options.entityId)
    .in("status", ["queued", "running"])
    .maybeSingle();

  if (existing) return { id: existing.id as string };

  const { data, error } = await supabase
    .from("ai_processing_runs")
    .insert({
      run_type: options.runType,
      entity_type: options.entityType,
      entity_id: options.entityId,
      input_hash: options.inputHash ?? null,
      max_attempts: options.maxAttempts ?? 3,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { id: data.id as string };
}

/** Marca un run como completado con éxito y registra consumo. */
export async function markRunSucceeded(
  supabase: SupabaseClient,
  runId: string,
  metadata?: {
    modelProvider?: string | null;
    modelName?: string | null;
    promptVersion?: string | null;
    extractorVersion?: string | null;
    tokensIn?: number | null;
    tokensOut?: number | null;
    costUsd?: number | null;
    inputHash?: string | null;
  }
): Promise<void> {
  await supabase
    .from("ai_processing_runs")
    .update({
      status: "succeeded",
      finished_at: new Date().toISOString(),
      model_provider: metadata?.modelProvider ?? null,
      model_name: metadata?.modelName ?? null,
      prompt_version: metadata?.promptVersion ?? null,
      extractor_version: metadata?.extractorVersion ?? null,
      tokens_in: metadata?.tokensIn ?? null,
      tokens_out: metadata?.tokensOut ?? null,
      cost_usd: metadata?.costUsd ?? null,
      ...(metadata?.inputHash ? { input_hash: metadata.inputHash } : {}),
    })
    .eq("id", runId);
}

/**
 * Registra un fallo. Si el error es reintentable y quedan intentos, reencola
 * con backoff exponencial; si no, lo da por fallido definitivo.
 */
export async function markRunFailed(
  supabase: SupabaseClient,
  run: Pick<AIRun, "id" | "attempts" | "max_attempts">,
  errorCode: string,
  errorMessage: string,
  retryable: boolean
): Promise<void> {
  const canRetry = retryable && run.attempts < run.max_attempts;

  // Backoff: 1 min, 4 min, 9 min...
  const backoffMs = canRetry ? Math.pow(run.attempts, 2) * 60_000 : 0;
  const nextRetry = canRetry ? new Date(Date.now() + backoffMs).toISOString() : null;

  await supabase
    .from("ai_processing_runs")
    .update({
      status: canRetry ? "queued" : "failed",
      // El mensaje va sin PII: nunca volcar aquí texto del CV (spec §21, §28)
      error_code: errorCode,
      error_message: errorMessage,
      next_retry_at: nextRetry,
      scheduled_at: nextRetry ?? undefined,
      finished_at: canRetry ? null : new Date().toISOString(),
    })
    .eq("id", run.id);
}

/**
 * Busca un run exitoso previo con el mismo hash de entrada.
 * Evita pagar dos veces por extraer el mismo documento (spec §34).
 */
export async function findCachedRun(
  supabase: SupabaseClient,
  runType: RunType,
  inputHash: string
): Promise<{ entity_id: string } | null> {
  const { data } = await supabase
    .from("ai_processing_runs")
    .select("entity_id")
    .eq("run_type", runType)
    .eq("input_hash", inputHash)
    .eq("status", "succeeded")
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ? { entity_id: data.entity_id as string } : null;
}

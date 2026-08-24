-- ============================================================
-- Migración 011: disparador del worker de IA
--
-- El proyecto está en Vercel Hobby, que solo permite 2 cron jobs y una única
-- ejecución diaria: inservible para una cola. El scheduler vive por tanto en
-- Supabase (pg_cron ya está activo desde 001) y llama por HTTP al endpoint
-- de Vercel cada minuto usando pg_net.
--
-- ┌──────────────────┐   cada minuto   ┌──────────────┐   procesa 1 run
-- │ pg_cron          │ ──────────────► │ /api/cron/   │ ──────────────►
-- │ (dentro de       │    pg_net       │  ai-worker   │   OpenAI + DB
-- │  Supabase)       │    HTTP POST    │  (Vercel)    │
-- └──────────────────┘                 └──────────────┘
--
-- REQUISITO PREVIO — guardar dos secretos en Supabase Vault:
--
--   select vault.create_secret('https://TU-APP.vercel.app/api/cron/ai-worker', 'ai_worker_url');
--   select vault.create_secret('TU_CRON_SECRET', 'ai_worker_secret');
--
-- El segundo valor debe coincidir con CRON_SECRET en las variables de entorno
-- de Vercel. Se usan secretos en Vault en lugar de literales para no dejar la
-- clave escrita en el historial de migraciones.
--
-- Referencia: docs/AI_SCREENING_IMPLEMENTATION_PLAN.md §6.1
-- ============================================================

BEGIN;

-- pg_net: cliente HTTP asíncrono desde Postgres
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- Función disparadora
--
-- Lee URL y secreto de Vault en tiempo de ejecución. Si aún no están
-- configurados, no hace nada y avisa: así la migración se puede aplicar
-- antes de tener el deploy listo, sin romper nada.
-- ============================================================
CREATE OR REPLACE FUNCTION public.trigger_ai_worker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_url     text;
  v_secret  text;
  v_pending int;
BEGIN
  -- No gastar una llamada HTTP si la cola está vacía
  SELECT count(*) INTO v_pending
  FROM public.ai_processing_runs
  WHERE status = 'queued'
    AND scheduled_at <= now();

  IF v_pending = 0 THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets WHERE name = 'ai_worker_url';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets WHERE name = 'ai_worker_secret';

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE WARNING 'trigger_ai_worker: faltan los secretos ai_worker_url / ai_worker_secret en Vault. La cola no se procesará.';
    RETURN;
  END IF;

  PERFORM extensions.net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_secret
               ),
    body    := jsonb_build_object('source', 'pg_cron'),
    timeout_milliseconds := 5000   -- solo dispara; no espera a que termine el trabajo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.trigger_ai_worker() FROM public, anon, authenticated;

-- ============================================================
-- Programación: cada minuto
-- ============================================================
DO $$
BEGIN
  PERFORM cron.unschedule('ai-worker-tick');
EXCEPTION WHEN OTHERS THEN
  NULL;  -- todavía no existía
END $$;

SELECT cron.schedule(
  'ai-worker-tick',
  '* * * * *',
  $$ SELECT public.trigger_ai_worker(); $$
);

-- ============================================================
-- Mantenimiento: reencolar runs que quedaron colgados en 'running'
--
-- Si una función de Vercel se corta por timeout, el run se queda en 'running'
-- para siempre y bloquea a ese documento. Cada 10 minutos se rescatan.
-- ============================================================
CREATE OR REPLACE FUNCTION public.requeue_stale_ai_runs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ai_processing_runs
  SET status        = CASE WHEN attempts >= max_attempts THEN 'failed' ELSE 'queued' END,
      error_code    = COALESCE(error_code, 'STALE_TIMEOUT'),
      error_message = COALESCE(error_message, 'El run superó el tiempo máximo de ejecución y fue reencolado.'),
      next_retry_at = now(),
      scheduled_at  = now(),
      finished_at   = CASE WHEN attempts >= max_attempts THEN now() ELSE NULL END
  WHERE status = 'running'
    AND started_at < now() - interval '10 minutes';
$$;

REVOKE ALL ON FUNCTION public.requeue_stale_ai_runs() FROM public, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('ai-worker-requeue-stale');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'ai-worker-requeue-stale',
  '*/10 * * * *',
  $$ SELECT public.requeue_stale_ai_runs(); $$
);

COMMIT;

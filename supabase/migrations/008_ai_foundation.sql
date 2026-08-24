-- ============================================================
-- Migración 008: fundación de IA
--
-- Crea la infraestructura transversal del módulo de screening:
--   1. ai_processing_runs   — cola de trabajo + auditoría de cada llamada a IA
--   2. scoring_configurations — pesos y bandas versionados
--
-- 100% ADITIVA: no modifica ninguna tabla ni columna existente.
-- Sin OPENAI_API_KEY o con AI_ENABLED=false, nada de esto se usa y la
-- plataforma sigue funcionando igual que antes.
--
-- Referencia: docs/AI_SCREENING_IMPLEMENTATION_PLAN.md §4
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ai_processing_runs — cola + trazabilidad
--
-- Hace de cola de trabajo (Vercel Hobby no permite un scheduler propio, ver §6.1)
-- y a la vez de registro de auditoría exigido por la spec §21.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_processing_runs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Qué trabajo es y sobre qué entidad opera
  run_type          text        NOT NULL CHECK (run_type IN (
                                  'extract_document_text',
                                  'extract_job_profile',
                                  'extract_candidate_profile',
                                  'normalize_skills',
                                  'calculate_match',
                                  'generate_explanation'
                                )),
  entity_type       text        NOT NULL,   -- 'job_document' | 'candidate_document' | ...
  entity_id         uuid        NOT NULL,

  -- Estado de la cola
  status            text        NOT NULL DEFAULT 'queued' CHECK (status IN (
                                  'queued', 'running', 'succeeded', 'failed', 'cancelled'
                                )),
  attempts          int         NOT NULL DEFAULT 0,
  max_attempts      int         NOT NULL DEFAULT 3,
  next_retry_at     timestamptz,

  -- Idempotencia (spec §34): si un run exitoso tiene el mismo hash de entrada,
  -- se reutiliza su resultado en lugar de volver a pagar una llamada al LLM
  input_hash        text,

  -- Trazabilidad de la ejecución (spec §21, §22)
  model_provider    text,
  model_name        text,
  prompt_version    text,
  extractor_version text,

  -- Control de costo
  tokens_in         int,
  tokens_out        int,
  cost_usd          numeric(10, 6),

  -- Errores: SIN PII. Nunca volcar aquí el texto del CV (spec §21, §28)
  error_code        text,
  error_message     text,

  scheduled_at      timestamptz NOT NULL DEFAULT now(),
  started_at        timestamptz,
  finished_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- El worker toma trabajo con: status='queued' AND scheduled_at <= now()
-- ordenado por scheduled_at. Este índice es el que sostiene esa consulta.
CREATE INDEX IF NOT EXISTS ai_runs_queue_idx
  ON public.ai_processing_runs (status, scheduled_at)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS ai_runs_entity_idx
  ON public.ai_processing_runs (entity_type, entity_id);

-- Búsqueda de resultado reutilizable por idempotencia
CREATE INDEX IF NOT EXISTS ai_runs_input_hash_idx
  ON public.ai_processing_runs (run_type, input_hash)
  WHERE status = 'succeeded' AND input_hash IS NOT NULL;

-- Consumo diario, para el tope de gasto
CREATE INDEX IF NOT EXISTS ai_runs_cost_idx
  ON public.ai_processing_runs (created_at)
  WHERE cost_usd IS NOT NULL;

ALTER TABLE public.ai_processing_runs ENABLE ROW LEVEL SECURITY;

-- Solo admins leen la cola. El worker usa service_role, que salta RLS.
CREATE POLICY "ai_runs_admin_read" ON public.ai_processing_runs
  FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Los admins encolan trabajo desde uploadJobDocumentAction y
-- retryJobDocumentAction usando su propia sesión (respeta RLS), no
-- service_role. Sin esta política el INSERT fallaba en silencio.
CREATE POLICY "ai_runs_admin_insert" ON public.ai_processing_runs
  FOR INSERT
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- 1b. claim_ai_runs — toma trabajo de la cola de forma atómica
--
-- FOR UPDATE SKIP LOCKED es lo que evita que dos invocaciones solapadas del
-- worker procesen el mismo run y paguen dos veces la misma llamada al LLM.
-- Marcar 'running' e incrementar attempts ocurre en la misma transacción que
-- la selección: no hay ventana de carrera.
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_ai_runs(p_batch_size int DEFAULT 1)
RETURNS SETOF public.ai_processing_runs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT id
    FROM public.ai_processing_runs
    WHERE status = 'queued'
      AND scheduled_at <= now()
      AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY scheduled_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  UPDATE public.ai_processing_runs r
  SET status     = 'running',
      started_at = now(),
      attempts   = r.attempts + 1
  FROM claimed c
  WHERE r.id = c.id
  RETURNING r.*;
END;
$$;

-- Solo el worker (service_role) puede tomar trabajo
REVOKE ALL ON FUNCTION public.claim_ai_runs(int) FROM public, anon, authenticated;

-- ============================================================
-- 2. scoring_configurations — pesos y bandas versionados (spec §18)
--
-- Los resultados históricos guardan la versión con la que se calcularon y
-- NUNCA se recalculan en silencio con reglas nuevas.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scoring_configurations (
  id                         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  version                    text        NOT NULL,

  -- Ámbito: global, por empresa, o por oferta concreta (spec §12.1)
  scope                      text        NOT NULL DEFAULT 'global'
                                         CHECK (scope IN ('global', 'company', 'job')),
  company_id                 uuid        REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id                     uuid        REFERENCES public.jobs(id) ON DELETE CASCADE,

  -- Pesos de las 6 categorías; deben sumar 100 (spec §12.1)
  weights                    jsonb       NOT NULL,
  -- Umbrales de banda: { "high": 80, "potential": 60 }
  bands                      jsonb       NOT NULL,
  -- Sub-pesos del cálculo de experiencia (spec §15)
  experience_weights         jsonb       NOT NULL,

  -- Por debajo de esta confianza el resultado se marca 'insufficient_data' (spec §12.3)
  minimum_profile_confidence numeric(3, 2) NOT NULL DEFAULT 0.65,

  is_active                  boolean     NOT NULL DEFAULT true,
  notes                      text,
  created_by                 uuid        REFERENCES public.profiles(id),
  created_at                 timestamptz NOT NULL DEFAULT now(),

  -- Coherencia del ámbito con su referencia
  CONSTRAINT scoring_config_scope_ref CHECK (
    (scope = 'global'  AND company_id IS NULL AND job_id IS NULL) OR
    (scope = 'company' AND company_id IS NOT NULL AND job_id IS NULL) OR
    (scope = 'job'     AND job_id IS NOT NULL)
  )
);

-- Una sola configuración activa por ámbito
CREATE UNIQUE INDEX IF NOT EXISTS scoring_config_active_global_idx
  ON public.scoring_configurations (scope)
  WHERE is_active AND scope = 'global';

CREATE UNIQUE INDEX IF NOT EXISTS scoring_config_active_company_idx
  ON public.scoring_configurations (company_id)
  WHERE is_active AND scope = 'company';

CREATE UNIQUE INDEX IF NOT EXISTS scoring_config_active_job_idx
  ON public.scoring_configurations (job_id)
  WHERE is_active AND scope = 'job';

ALTER TABLE public.scoring_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scoring_config_admin_all" ON public.scoring_configurations
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Las empresas pueden leer la config global y la suya propia (para entender el score)
CREATE POLICY "scoring_config_company_read" ON public.scoring_configurations
  FOR SELECT
  USING (
    scope = 'global'
    OR company_id IN (SELECT id FROM public.companies WHERE created_by = auth.uid())
  );

-- ============================================================
-- 3. Configuración de scoring v1 por defecto (spec §12.1 y §18)
-- ============================================================
INSERT INTO public.scoring_configurations
  (version, scope, weights, bands, experience_weights, minimum_profile_confidence, notes)
VALUES (
  'v1',
  'global',
  '{
    "technical_skills": 35,
    "experience": 30,
    "education_certifications": 10,
    "transferable_skills": 10,
    "languages": 5,
    "preferred_skills": 10
  }'::jsonb,
  '{ "high": 80, "potential": 60 }'::jsonb,
  '{
    "relevant_years_fit": 0.35,
    "role_similarity": 0.25,
    "responsibility_coverage": 0.30,
    "required_domain_experience": 0.10
  }'::jsonb,
  0.65,
  'Configuración inicial de la spec §12.1. SIN CALIBRAR: los pesos son un punto de partida razonable, no un modelo validado. Calibrar en Fase 6 con dataset real antes de presentar el score como confiable.'
)
ON CONFLICT DO NOTHING;

COMMIT;

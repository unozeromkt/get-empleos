-- ============================================================
-- Migración 010: CanonicalJobProfile versionado
--
-- Guarda el perfil estructurado que la IA extrae del documento de la oferta.
-- La tabla `jobs` NO se toca en sus columnas existentes: sigue con description,
-- requirements y benefits en texto plano, y todas las vistas públicas y de
-- admin siguen funcionando igual. El perfil canónico vive aparte.
--
-- Referencia: docs/AI_SCREENING_IMPLEMENTATION_PLAN.md §4
-- Spec: §6 (CanonicalJobProfile), §22 (versionado)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. job_profile_versions
--
-- job_id es NULLABLE porque el flujo es: subir documento → extraer → REVISAR
-- → recién ahí se crea la oferta (spec §5.3, la IA no publica directamente).
-- Mientras el admin no confirma, existe el perfil pero todavía no la oferta.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.job_profile_versions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id             uuid        REFERENCES public.jobs(id) ON DELETE CASCADE,
  source_document_id uuid        REFERENCES public.job_documents(id) ON DELETE SET NULL,

  version            int         NOT NULL DEFAULT 1,
  source             text        NOT NULL DEFAULT 'manual'
                                 CHECK (source IN ('manual', 'pdf', 'docx')),

  -- CanonicalJobProfile completo (spec §6). Se valida contra el schema Zod
  -- en lib/ai/schemas/job-profile.ts ANTES de insertar: nunca se guarda un
  -- JSON que no valide (spec §23).
  profile            jsonb       NOT NULL,
  profile_hash       text        NOT NULL,   -- detecta cambios reales → recálculo (spec §34)

  -- Confianza global de la extracción, 0..1
  confidence         numeric(3, 2),

  -- Trazabilidad: un MatchResult debe poder explicarse meses después (spec §22)
  extractor_version  text        NOT NULL,
  prompt_version     text        NOT NULL,
  model_provider     text,
  model_name         text,

  -- 'draft' = extraído por la IA, pendiente de revisión humana
  -- 'confirmed' = un admin lo revisó y aprobó (human-in-the-loop, spec §30)
  status             text        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft', 'confirmed', 'superseded')),

  -- Diferencia entre lo que extrajo la IA y lo que el humano dejó,
  -- para medir recruiter_override_rate (spec §37) sin instrumentación extra
  ai_profile         jsonb,

  confirmed_by       uuid        REFERENCES public.profiles(id),
  confirmed_at       timestamptz,
  created_by         uuid        REFERENCES public.profiles(id),
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Una versión N por oferta. Las filas con job_id NULL (todavía sin confirmar)
-- no colisionan porque Postgres permite múltiples NULL en un índice único.
CREATE UNIQUE INDEX IF NOT EXISTS job_profile_versions_job_version_idx
  ON public.job_profile_versions (job_id, version)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_profile_versions_job_idx
  ON public.job_profile_versions (job_id);
CREATE INDEX IF NOT EXISTS job_profile_versions_document_idx
  ON public.job_profile_versions (source_document_id);
CREATE INDEX IF NOT EXISTS job_profile_versions_status_idx
  ON public.job_profile_versions (status);

ALTER TABLE public.job_profile_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_profile_versions_admin_all" ON public.job_profile_versions
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Las empresas pueden leer el perfil canónico de sus propias ofertas:
-- es lo que explica por qué un candidato obtuvo su score (spec §19).
CREATE POLICY "job_profile_versions_company_read" ON public.job_profile_versions
  FOR SELECT
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.companies c ON c.id = j.company_id
      WHERE c.created_by = auth.uid()
    )
  );

-- ============================================================
-- 2. Enganche opcional desde jobs
--
-- Columnas NULLABLE: una oferta creada a mano no tiene perfil canónico y
-- sigue siendo perfectamente válida.
-- ============================================================
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS current_profile_version_id uuid
    REFERENCES public.job_profile_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS jobs_ai_generated_idx
  ON public.jobs (ai_generated)
  WHERE ai_generated;

COMMIT;

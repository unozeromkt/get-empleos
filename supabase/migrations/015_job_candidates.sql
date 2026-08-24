-- ============================================================
-- Migración 015: job_candidates — persona evaluada para una oferta
--
-- Resuelve el problema del plan §3.8: la cadena
--   applications.candidate_id → candidates.id → profiles.id → auth.users.id
-- es toda NOT NULL, así que hoy es IMPOSIBLE evaluar el CV de alguien que
-- nunca se registró. El admin necesita poder subir CVs sueltos y puntuarlos.
--
-- Se descartó crear usuarios fantasma en auth.users: ensucia el sistema de
-- autenticación, rompe las métricas de registro y crea cuentas para personas
-- que no las pidieron.
--
-- `applications` NO SE TOCA. Al postularse se crea además un job_candidate
-- espejo; los flujos existentes siguen leyendo applications sin enterarse.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.job_candidates (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id             uuid        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,

  -- El "ID del sistema" que ve el reclutador en el listado
  system_ref         bigserial   UNIQUE,

  source             text        NOT NULL CHECK (source IN ('application', 'admin_upload')),

  -- Presente solo si llegó por la URL pública
  application_id     uuid        REFERENCES public.applications(id) ON DELETE CASCADE,
  -- Presente solo si es un usuario registrado
  candidate_id       uuid        REFERENCES public.candidates(id) ON DELETE SET NULL,

  -- Datos extraídos del CV cuando la persona no tiene cuenta.
  -- Se usan para contactarla y mostrarla en el listado, NUNCA para rankear (§29).
  display_name       text,
  email              text,
  phone              text,

  document_id        uuid        REFERENCES public.candidate_documents(id) ON DELETE SET NULL,
  profile_version_id uuid        REFERENCES public.candidate_profile_versions(id) ON DELETE SET NULL,

  -- Reutiliza el mismo pipeline que applications
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending','reviewing','shortlisted','rejected','hired')),

  created_by         uuid        REFERENCES public.profiles(id),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- Coherencia entre origen y referencia
  CONSTRAINT job_candidates_source_ref CHECK (
    (source = 'application'  AND application_id IS NOT NULL) OR
    (source = 'admin_upload' AND application_id IS NULL)
  )
);

-- Una postulación produce exactamente una fila
CREATE UNIQUE INDEX IF NOT EXISTS job_candidates_application_idx
  ON public.job_candidates (application_id)
  WHERE application_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS job_candidates_job_idx       ON public.job_candidates (job_id);
CREATE INDEX IF NOT EXISTS job_candidates_candidate_idx ON public.job_candidates (candidate_id);
CREATE INDEX IF NOT EXISTS job_candidates_status_idx    ON public.job_candidates (job_id, status);

ALTER TABLE public.job_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_candidates_admin_all" ON public.job_candidates
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- La empresa ve solo los candidatos de sus propias ofertas
CREATE POLICY "job_candidates_company_read" ON public.job_candidates
  FOR SELECT
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.companies c ON c.id = j.company_id
      WHERE c.created_by = auth.uid()
    )
  );

CREATE POLICY "job_candidates_company_update" ON public.job_candidates
  FOR UPDATE
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.companies c ON c.id = j.company_id
      WHERE c.created_by = auth.uid()
    )
  );

-- Sin política para candidatos: NUNCA deben leer esta tabla.

CREATE TRIGGER trg_job_candidates_updated_at
  BEFORE UPDATE ON public.job_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Espejo automático de las postulaciones
--
-- Un trigger en lugar de código de aplicación: garantiza que NINGUNA
-- postulación se quede sin su job_candidate, incluso las creadas desde el
-- SQL Editor o por una futura ruta que olvide hacerlo.
-- ============================================================
CREATE OR REPLACE FUNCTION public.mirror_application_to_job_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_candidates (
    job_id, source, application_id, candidate_id, document_id, profile_version_id, status
  )
  SELECT
    NEW.job_id,
    'application',
    NEW.id,
    NEW.candidate_id,
    (SELECT id FROM public.candidate_documents
      WHERE candidate_id = NEW.candidate_id AND is_current LIMIT 1),
    (SELECT id FROM public.candidate_profile_versions
      WHERE candidate_id = NEW.candidate_id AND is_current LIMIT 1),
    NEW.status
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mirror_application ON public.applications;

CREATE TRIGGER trg_mirror_application
  AFTER INSERT ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.mirror_application_to_job_candidate();

-- Mantener el estado sincronizado en ambos sentidos sería frágil; el pipeline
-- vive en job_candidates a partir de la Fase 4, y applications conserva el
-- suyo para no romper las vistas actuales del candidato.
DROP TRIGGER IF EXISTS trg_mirror_application_status ON public.applications;

CREATE OR REPLACE FUNCTION public.sync_application_status_to_job_candidate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.job_candidates
  SET status = NEW.status
  WHERE application_id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mirror_application_status
  AFTER UPDATE OF status ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.sync_application_status_to_job_candidate();

-- ============================================================
-- Backfill de las postulaciones existentes
-- ============================================================
INSERT INTO public.job_candidates (
  job_id, source, application_id, candidate_id, document_id, profile_version_id, status, created_at
)
SELECT
  a.job_id,
  'application',
  a.id,
  a.candidate_id,
  (SELECT id FROM public.candidate_documents d WHERE d.candidate_id = a.candidate_id AND d.is_current LIMIT 1),
  (SELECT id FROM public.candidate_profile_versions v WHERE v.candidate_id = a.candidate_id AND v.is_current LIMIT 1),
  a.status,
  a.applied_at
FROM public.applications a
WHERE NOT EXISTS (
  SELECT 1 FROM public.job_candidates jc WHERE jc.application_id = a.id
);

COMMIT;

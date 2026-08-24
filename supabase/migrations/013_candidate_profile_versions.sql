-- ============================================================
-- Migración 013: CanonicalCandidateProfile versionado (Fase 2)
--
--   1. candidate_profile_versions — perfil estructurado del CV, versionado
--   2. candidates.current_profile_version_id — enganche opcional
--   3. candidate_documents.sha256 pasa a NULLABLE (para poder registrar los
--      CVs históricos, cuyo hash no se puede calcular desde SQL)
--   4. Backfill: registra los CV ya existentes en candidate_documents
--   5. Política de Storage para que el admin pueda leer CVs (bucket 'cvs')
--
-- ADITIVA: candidates.cv_url no se toca y sigue apuntando al CV vigente, así
-- que las 6 vistas que ya lo leen (dashboard, perfil, apply, admin, empresa)
-- siguen funcionando sin cambios.
--
-- Referencia: docs/AI_SCREENING_IMPLEMENTATION_PLAN.md §4
-- Spec: §8 (CanonicalCandidateProfile), §22 (versionado), §33 (precedencia)
-- ============================================================

BEGIN;

-- ============================================================
-- 1. candidate_profile_versions
--
-- candidate_id es NULLABLE: en la Fase 4 el admin podrá subir el CV de alguien
-- que nunca se registró, y ese perfil canónico no tendrá dueño (plan §3.8).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.candidate_profile_versions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  candidate_id       uuid        REFERENCES public.candidates(id) ON DELETE CASCADE,
  source_document_id uuid        REFERENCES public.candidate_documents(id) ON DELETE SET NULL,

  version            int         NOT NULL DEFAULT 1,

  -- Lo que extrajo la IA, intacto. Nunca se sobrescribe.
  ai_profile         jsonb       NOT NULL,
  -- Lo que el candidato revisó y confirmó. Manda sobre ai_profile (spec §33).
  confirmed_profile  jsonb,

  profile_hash       text        NOT NULL,
  overall_confidence numeric(3, 2),

  -- Trazabilidad (spec §22)
  extractor_version  text        NOT NULL,
  prompt_version     text        NOT NULL,
  model_provider     text,
  model_name         text,

  status             text        NOT NULL DEFAULT 'draft'
                                 CHECK (status IN ('draft', 'confirmed', 'superseded')),
  is_current         boolean     NOT NULL DEFAULT true,

  confirmed_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Un solo perfil vigente por candidato registrado
CREATE UNIQUE INDEX IF NOT EXISTS candidate_profile_versions_current_idx
  ON public.candidate_profile_versions (candidate_id)
  WHERE is_current AND candidate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS candidate_profile_versions_candidate_idx
  ON public.candidate_profile_versions (candidate_id);
CREATE INDEX IF NOT EXISTS candidate_profile_versions_document_idx
  ON public.candidate_profile_versions (source_document_id);

ALTER TABLE public.candidate_profile_versions ENABLE ROW LEVEL SECURITY;

-- El candidato ve y confirma su propio perfil extraído
CREATE POLICY "candidate_profile_versions_own_read" ON public.candidate_profile_versions
  FOR SELECT USING (auth.uid() = candidate_id);

CREATE POLICY "candidate_profile_versions_own_update" ON public.candidate_profile_versions
  FOR UPDATE USING (auth.uid() = candidate_id);

CREATE POLICY "candidate_profile_versions_admin_all" ON public.candidate_profile_versions
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- 2. Enganche opcional desde candidates
-- ============================================================
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS current_profile_version_id uuid
    REFERENCES public.candidate_profile_versions(id) ON DELETE SET NULL;

-- ============================================================
-- 3. sha256 nullable en candidate_documents
--
-- Los CV históricos ya están en Storage pero su hash no se puede calcular
-- desde SQL. Preferimos registrarlos con sha256 NULL a inventar un valor o
-- a dejarlos fuera del sistema de versionado.
-- ============================================================
ALTER TABLE public.candidate_documents
  ALTER COLUMN sha256 DROP NOT NULL;

-- ============================================================
-- 4. Backfill de los CV existentes
--
-- Hasta ahora todos los CV vivían en la ruta fija '{user_id}/cv.pdf' con
-- upsert, así que cada uno sobrescribía al anterior (plan §3.1). Se registran
-- como versión 1 para que el sistema de versionado arranque con historia
-- consistente. status='uploaded' → la cola los procesará cuando corresponda.
-- ============================================================
INSERT INTO public.candidate_documents (
  candidate_id, uploaded_by, storage_path, original_filename,
  mime_type, size_bytes, sha256, version, is_current, status, created_at
)
SELECT
  c.id,
  c.id,                                    -- lo subió el propio candidato
  c.cv_url,
  'cv.pdf',
  'application/pdf',
  0,                                       -- tamaño real desconocido
  NULL,                                    -- hash no calculable desde SQL
  1,
  true,
  'uploaded',
  COALESCE(c.cv_updated_at, now())
FROM public.candidates c
WHERE c.cv_url IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.candidate_documents d WHERE d.candidate_id = c.id
  );

-- ============================================================
-- 5. Storage: el admin necesita leer los CV para el screening
--
-- El bucket 'cvs' ya existe y es privado. Solo se añade lectura para admins;
-- el acceso sigue siendo siempre por URL firmada (spec §28).
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'cvs') THEN
    DROP POLICY IF EXISTS "cvs_admin_read" ON storage.objects;

    CREATE POLICY "cvs_admin_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'cvs'
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      );
  ELSE
    RAISE WARNING 'Bucket "cvs" no existe.';
  END IF;
END $$;

COMMIT;

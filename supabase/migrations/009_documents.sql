-- ============================================================
-- Migración 009: documentos fuente (ofertas y hojas de vida)
--
--   1. job_documents        — Word/PDF de la oferta que sube el admin
--   2. candidate_documents  — CV versionado (resuelve el problema del §3.1:
--                             hoy el CV se sobrescribe y se pierde el original)
--   3. Políticas de Storage para el bucket privado 'job-documents'
--
-- REQUISITO PREVIO: crear el bucket 'job-documents' en Supabase Dashboard
--   Storage → New bucket → nombre: "job-documents" → Public bucket: OFF → Save
--
-- ADITIVA: no modifica columnas existentes. candidates.cv_url se mantiene
-- intacta y sigue apuntando al CV vigente, así que las vistas actuales
-- (dashboard, perfil, admin, empresa) no se enteran del cambio.
--
-- Referencia: docs/AI_SCREENING_IMPLEMENTATION_PLAN.md §4
-- ============================================================

BEGIN;

-- ============================================================
-- 1. job_documents — documento fuente de una oferta
-- ============================================================
CREATE TABLE IF NOT EXISTS public.job_documents (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- La oferta se crea DESPUÉS de revisar la extracción, así que al subir el
  -- documento todavía no hay job_id. Se rellena al confirmar (spec §5.3).
  job_id               uuid        REFERENCES public.jobs(id) ON DELETE SET NULL,
  company_id           uuid        REFERENCES public.companies(id) ON DELETE SET NULL,
  uploaded_by          uuid        NOT NULL REFERENCES public.profiles(id),

  storage_path         text        NOT NULL,
  original_filename    text        NOT NULL,
  mime_type            text        NOT NULL,
  size_bytes           bigint      NOT NULL,
  sha256               text        NOT NULL,   -- deduplicación e idempotencia

  -- Estados de procesamiento (spec §5.2)
  status               text        NOT NULL DEFAULT 'uploaded' CHECK (status IN (
                                     'uploaded',
                                     'extracting_text',
                                     'extracting_profile',
                                     'needs_review',
                                     'ready',
                                     'failed'
                                   )),

  extracted_text       text,
  extracted_text_hash  text,
  page_count           int,
  ocr_used             boolean     NOT NULL DEFAULT false,

  error_code           text,
  error_message        text,       -- SIN PII

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_documents_job_idx    ON public.job_documents (job_id);
CREATE INDEX IF NOT EXISTS job_documents_status_idx ON public.job_documents (status);
CREATE INDEX IF NOT EXISTS job_documents_sha_idx    ON public.job_documents (sha256);

ALTER TABLE public.job_documents ENABLE ROW LEVEL SECURITY;

-- Solo admins: Get Company publica todas las ofertas (decisión de producto)
CREATE POLICY "job_documents_admin_all" ON public.job_documents
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE TRIGGER trg_job_documents_updated_at
  BEFORE UPDATE ON public.job_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 2. candidate_documents — CV versionado
--
-- candidate_id es NULLABLE a propósito: cuando el admin sube el CV de alguien
-- que nunca se registró, no hay fila en candidates a la que apuntar (§3.8).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.candidate_documents (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  candidate_id         uuid        REFERENCES public.candidates(id) ON DELETE CASCADE,
  uploaded_by          uuid        NOT NULL REFERENCES public.profiles(id),

  storage_path         text        NOT NULL,
  original_filename    text        NOT NULL,
  mime_type            text        NOT NULL,
  size_bytes           bigint      NOT NULL,
  sha256               text        NOT NULL,

  -- Versionado: cada CV nuevo incrementa version y desmarca el anterior.
  -- Sin esto no se puede explicar un MatchResult histórico (spec §22).
  version              int         NOT NULL DEFAULT 1,
  is_current           boolean     NOT NULL DEFAULT true,

  status               text        NOT NULL DEFAULT 'uploaded' CHECK (status IN (
                                     'uploaded',
                                     'extracting_text',
                                     'extracting_profile',
                                     'needs_review',
                                     'ready',
                                     'failed'
                                   )),

  extracted_text       text,
  extracted_text_hash  text,
  page_count           int,
  ocr_used             boolean     NOT NULL DEFAULT false,

  error_code           text,
  error_message        text,       -- SIN PII

  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Un solo CV vigente por candidato registrado
CREATE UNIQUE INDEX IF NOT EXISTS candidate_documents_current_idx
  ON public.candidate_documents (candidate_id)
  WHERE is_current AND candidate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS candidate_documents_candidate_idx
  ON public.candidate_documents (candidate_id);
CREATE INDEX IF NOT EXISTS candidate_documents_status_idx
  ON public.candidate_documents (status);
CREATE INDEX IF NOT EXISTS candidate_documents_sha_idx
  ON public.candidate_documents (sha256);

ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;

-- El candidato ve y gestiona solo sus propios documentos
CREATE POLICY "candidate_documents_own_read" ON public.candidate_documents
  FOR SELECT USING (auth.uid() = candidate_id);

CREATE POLICY "candidate_documents_own_insert" ON public.candidate_documents
  FOR INSERT WITH CHECK (auth.uid() = candidate_id AND auth.uid() = uploaded_by);

CREATE POLICY "candidate_documents_own_update" ON public.candidate_documents
  FOR UPDATE USING (auth.uid() = candidate_id);

-- Los admins gestionan todos (incluidos los que suben ellos mismos)
CREATE POLICY "candidate_documents_admin_all" ON public.candidate_documents
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE TRIGGER trg_candidate_documents_updated_at
  BEFORE UPDATE ON public.candidate_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- 3. Storage: políticas del bucket privado 'job-documents'
--
-- El bucket debe existir antes (ver cabecera). Los CVs siguen en el bucket
-- 'cvs' ya existente, que también es privado.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'job-documents') THEN

    DROP POLICY IF EXISTS "job_documents_admin_read"   ON storage.objects;
    DROP POLICY IF EXISTS "job_documents_admin_write"  ON storage.objects;
    DROP POLICY IF EXISTS "job_documents_admin_delete" ON storage.objects;

    -- Sin política pública: el acceso es siempre por URL firmada (spec §28)
    CREATE POLICY "job_documents_admin_read" ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'job-documents'
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      );

    CREATE POLICY "job_documents_admin_write" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'job-documents'
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      );

    CREATE POLICY "job_documents_admin_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'job-documents'
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      );

  ELSE
    RAISE WARNING 'Bucket "job-documents" no existe. Créalo en Supabase Dashboard (privado) y vuelve a ejecutar esta migración para aplicar sus políticas de Storage.';
  END IF;
END $$;

COMMIT;

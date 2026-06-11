-- ============================================================
-- GetEmpleos — Schema inicial
-- ============================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- búsqueda full-text
CREATE EXTENSION IF NOT EXISTS "pg_cron";  -- cron jobs para expirar ofertas

-- ============================================================
-- TABLA: profiles (extiende auth.users)
-- ============================================================
CREATE TABLE public.profiles (
  id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text        NOT NULL,
  email       text        NOT NULL,
  phone       text,
  city        text,
  role        text        NOT NULL DEFAULT 'candidate' CHECK (role IN ('admin', 'candidate')),
  avatar_url  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- TABLA: candidates (perfil extendido)
-- ============================================================
CREATE TABLE public.candidates (
  id                uuid        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  birth_date        date,
  gender            text        CHECK (gender IN ('masculino', 'femenino', 'otro', 'prefiero_no_decir')),
  education_level   text        CHECK (education_level IN ('bachiller', 'tecnico', 'tecnologo', 'profesional', 'especialista', 'maestria', 'doctorado')),
  career            text,
  years_experience  int         DEFAULT 0,
  skills            text[]      DEFAULT '{}',
  languages         text[]      DEFAULT '{}',
  linkedin_url      text,
  cv_url            text,
  cv_updated_at     timestamptz,
  availability      text        CHECK (availability IN ('inmediata', '15_dias', '30_dias')),
  expected_salary   numeric,
  summary           text        CHECK (char_length(summary) <= 500),
  profile_complete  boolean     DEFAULT false
);

ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidates_select_own" ON public.candidates
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "candidates_select_admin" ON public.candidates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "candidates_modify_own" ON public.candidates
  FOR ALL USING (auth.uid() = id);

-- ============================================================
-- TABLA: job_areas (catálogo de áreas)
-- ============================================================
CREATE TABLE public.job_areas (
  id    serial  PRIMARY KEY,
  name  text    NOT NULL,
  icon  text,
  slug  text    UNIQUE NOT NULL
);

ALTER TABLE public.job_areas ENABLE ROW LEVEL SECURITY;

-- Lectura pública para todos
CREATE POLICY "job_areas_public_read" ON public.job_areas
  FOR SELECT USING (true);

-- Solo admins pueden modificar
CREATE POLICY "job_areas_admin_write" ON public.job_areas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- TABLA: jobs (ofertas de trabajo)
-- ============================================================
CREATE TABLE public.jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text        NOT NULL,
  slug            text        UNIQUE NOT NULL,
  description     text        NOT NULL,
  requirements    text,
  benefits        text,
  area_id         int         REFERENCES public.job_areas(id),
  modality        text        CHECK (modality IN ('presencial', 'remoto', 'hibrido')),
  contract_type   text        CHECK (contract_type IN ('tiempo_completo', 'tiempo_parcial', 'temporal', 'por_obra')),
  salary_min      numeric,
  salary_max      numeric,
  salary_visible  boolean     DEFAULT true,
  city            text        NOT NULL,
  department      text,
  vacancies       int         DEFAULT 1,
  status          text        DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  featured        boolean     DEFAULT false,
  created_by      uuid        REFERENCES public.profiles(id),
  expires_at      timestamptz,
  published_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Lectura pública solo para ofertas activas
CREATE POLICY "jobs_public_read_active" ON public.jobs
  FOR SELECT USING (status = 'active');

-- Admins pueden ver y modificar todo
CREATE POLICY "jobs_admin_all" ON public.jobs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Índice para búsqueda por texto
CREATE INDEX jobs_title_trgm ON public.jobs USING gin (title gin_trgm_ops);
CREATE INDEX jobs_status_idx ON public.jobs (status);
CREATE INDEX jobs_featured_idx ON public.jobs (featured, status);

-- ============================================================
-- TABLA: applications (postulaciones)
-- ============================================================
CREATE TABLE public.applications (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        uuid        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  candidate_id  uuid        NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  status        text        DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'shortlisted', 'rejected', 'hired')),
  cover_letter  text,
  admin_notes   text,  -- NUNCA exponer al candidato
  applied_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- Candidatos solo ven sus propias postulaciones (SIN admin_notes)
CREATE POLICY "applications_candidate_read" ON public.applications
  FOR SELECT USING (auth.uid() = candidate_id);

-- Candidatos pueden crear postulaciones
CREATE POLICY "applications_candidate_insert" ON public.applications
  FOR INSERT WITH CHECK (auth.uid() = candidate_id);

-- Admins pueden ver y modificar todo (usa JWT app_metadata para evitar queries recursivos)
CREATE POLICY "applications_admin_all" ON public.applications
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

CREATE INDEX applications_candidate_idx ON public.applications (candidate_id);
CREATE INDEX applications_job_idx ON public.applications (job_id);

-- ============================================================
-- TRIGGER: updated_at automático
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: crear profile automáticamente al registrarse
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'candidate')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- CRON: cerrar ofertas expiradas (pg_cron, cada hora)
-- ============================================================
SELECT cron.schedule(
  'close-expired-jobs',
  '0 * * * *',
  $$
    UPDATE public.jobs
    SET status = 'closed'
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now();
  $$
);

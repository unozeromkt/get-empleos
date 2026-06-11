-- ============================================================
-- Migración 002: tabla companies + FK en jobs
-- ============================================================

CREATE TABLE public.companies (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  logo_url    text,
  website     text,
  description text,
  city        text,
  industry    text,
  created_by  uuid        REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Lectura pública
CREATE POLICY "companies_public_read" ON public.companies
  FOR SELECT USING (true);

-- Solo admins pueden crear/editar
CREATE POLICY "companies_admin_write" ON public.companies
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Agregar columna company_id a jobs
ALTER TABLE public.jobs
  ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Trigger updated_at
CREATE TRIGGER trg_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

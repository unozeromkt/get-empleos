-- ============================================================
-- Migración 003: rol "company" — empresas clientes en el portal
--
-- Cambios:
--   1. profiles.role acepta 'company' además de 'admin'/'candidate'
--   2. companies: agrega nit, legal_rep, status, approval tracking
--   3. jobs.status: agrega 'pending_review' para flujo de aprobación
--   4. jobs: agrega review_notes (feedback del admin al aprobar/rechazar)
--   5. RLS companies: empresa gestiona su propio perfil; admin aprueba
--   6. RLS jobs: empresa gestiona sus propias ofertas
--   7. RLS applications: empresa ve postulaciones a sus ofertas
--   8. Trigger: protege companies.status de cambios no-admin
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Actualizar CHECK de profiles.role → incluir 'company'
-- ============================================================
DO $$
DECLARE v_name text;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'candidate', 'company'));

-- ============================================================
-- 2. Ampliar tabla companies con campos del nuevo rol
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS nit              text,
  ADD COLUMN IF NOT EXISTS legal_rep        text,
  ADD COLUMN IF NOT EXISTS status           text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approved_at      timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by      uuid REFERENCES public.profiles(id);

-- Agregar CHECK de status si la columna se acaba de crear
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.companies'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%pending%'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS companies_status_idx     ON public.companies (status);
CREATE INDEX IF NOT EXISTS companies_created_by_idx ON public.companies (created_by);

-- ============================================================
-- 3. Actualizar CHECK de jobs.status → incluir 'pending_review'
-- ============================================================
DO $$
DECLARE v_name text;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.jobs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.jobs DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'closed'));

-- 4. Notas del admin al aprobar/rechazar una oferta de empresa
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS review_notes text;

-- ============================================================
-- 5. RLS para companies — reconstruir políticas completas
-- ============================================================
DROP POLICY IF EXISTS "companies_public_read"  ON public.companies;
DROP POLICY IF EXISTS "companies_admin_write"  ON public.companies;
DROP POLICY IF EXISTS "companies_admin_all"    ON public.companies;
DROP POLICY IF EXISTS "companies_admin_read"   ON public.companies;
DROP POLICY IF EXISTS "companies_owner_read"   ON public.companies;
DROP POLICY IF EXISTS "companies_owner_insert" ON public.companies;
DROP POLICY IF EXISTS "companies_owner_update" ON public.companies;

-- Público solo ve empresas aprobadas
CREATE POLICY "companies_public_read" ON public.companies
  FOR SELECT USING (status = 'approved');

-- Admins ven y modifican todo (aprobación, rechazo, edición)
CREATE POLICY "companies_admin_all" ON public.companies
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- La empresa ve su propio perfil aunque esté pendiente o rechazado
CREATE POLICY "companies_owner_read" ON public.companies
  FOR SELECT USING (auth.uid() = created_by);

-- La empresa crea su perfil (solo usuarios con role='company')
CREATE POLICY "companies_owner_insert" ON public.companies
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'company'
    )
  );

-- La empresa actualiza su perfil (el trigger previene cambiar status)
CREATE POLICY "companies_owner_update" ON public.companies
  FOR UPDATE USING (auth.uid() = created_by);

-- ============================================================
-- 6. Trigger: proteger companies.status de cambios por no-admins
-- ============================================================
CREATE OR REPLACE FUNCTION protect_company_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_role text;
BEGIN
  -- Leer el rol del JWT actual (funciona en contexto PostgREST)
  v_role := auth.jwt() -> 'app_metadata' ->> 'role';

  -- Permitir: admins y service_role (v_role = null cuando no hay app_metadata)
  IF v_role IS NULL OR v_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- Bloquear cambio de status por cualquier otro rol
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'Solo los administradores pueden cambiar el estado de aprobación de la empresa';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_company_status ON public.companies;
CREATE TRIGGER trg_protect_company_status
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION protect_company_status();

-- ============================================================
-- 7. RLS para jobs — empresa gestiona sus propias ofertas
-- ============================================================
DROP POLICY IF EXISTS "jobs_company_select" ON public.jobs;
DROP POLICY IF EXISTS "jobs_company_insert" ON public.jobs;
DROP POLICY IF EXISTS "jobs_company_update" ON public.jobs;
DROP POLICY IF EXISTS "jobs_company_delete" ON public.jobs;

-- Empresa ve todas sus ofertas (todos los estados)
CREATE POLICY "jobs_company_select" ON public.jobs
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM public.companies WHERE created_by = auth.uid()
    )
  );

-- Empresa crea ofertas solo si su empresa está aprobada; status inicial = 'draft'
CREATE POLICY "jobs_company_insert" ON public.jobs
  FOR INSERT WITH CHECK (
    status = 'draft'
    AND company_id IN (
      SELECT id FROM public.companies
      WHERE created_by = auth.uid() AND status = 'approved'
    )
  );

-- Empresa edita sus propias ofertas; no puede poner status = 'active' directamente
CREATE POLICY "jobs_company_update" ON public.jobs
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM public.companies WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    -- La empresa solo puede cambiar entre draft, pending_review y closed
    -- 'active' y 'paused' son exclusivos del admin
    status IN ('draft', 'pending_review', 'closed')
    AND company_id IN (
      SELECT id FROM public.companies WHERE created_by = auth.uid()
    )
  );

-- Empresa elimina solo sus borradores
CREATE POLICY "jobs_company_delete" ON public.jobs
  FOR DELETE USING (
    status = 'draft'
    AND company_id IN (
      SELECT id FROM public.companies WHERE created_by = auth.uid()
    )
  );

-- ============================================================
-- 8. RLS para applications — empresa ve postulaciones a sus ofertas
-- ============================================================
DROP POLICY IF EXISTS "applications_company_read"   ON public.applications;
DROP POLICY IF EXISTS "applications_company_update" ON public.applications;

-- Empresa ve postulaciones a sus ofertas
-- CRÍTICO: en código nunca incluir admin_notes en queries desde empresa
CREATE POLICY "applications_company_read" ON public.applications
  FOR SELECT USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      INNER JOIN public.companies c ON j.company_id = c.id
      WHERE c.created_by = auth.uid()
    )
  );

-- Empresa puede mover candidatos por el pipeline (sin acceder a admin_notes)
CREATE POLICY "applications_company_update" ON public.applications
  FOR UPDATE USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      INNER JOIN public.companies c ON j.company_id = c.id
      WHERE c.created_by = auth.uid()
    )
  )
  WITH CHECK (
    status IN ('pending', 'reviewing', 'shortlisted', 'rejected', 'hired')
    -- Las empresas no pueden establecer admin_notes — se omite en server actions
  );

COMMIT;

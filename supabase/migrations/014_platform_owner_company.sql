-- ============================================================
-- Migración 014: Get Company como empresa de la plataforma
--
-- Hasta ahora las ofertas propias de Get Company se guardaban con
-- company_id = NULL, lo que obligaba a tratarlas como caso especial en cada
-- consulta y dejaba las tarjetas del portal público sin nombre ni logo.
--
--   1. companies.is_platform_owner — marca la empresa dueña del portal
--   2. Registro de Get Company, ya aprobado
--   3. Backfill: las ofertas sin empresa pasan a ser suyas
--
-- Se usa una columna booleana en lugar de buscar por nombre o de fijar un
-- UUID en el código: el nombre puede cambiar y un UUID hardcodeado ata el
-- código a una base de datos concreta.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Marca de empresa propietaria
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS is_platform_owner boolean NOT NULL DEFAULT false;

-- Solo puede haber una
CREATE UNIQUE INDEX IF NOT EXISTS companies_platform_owner_idx
  ON public.companies (is_platform_owner)
  WHERE is_platform_owner;

-- ============================================================
-- 2. Registro de Get Company
--
-- created_by queda en NULL a propósito: no pertenece a ningún usuario con rol
-- 'company', sino a la propia plataforma. La gestionan los admins.
-- ============================================================
INSERT INTO public.companies (name, description, website, city, industry, status, is_platform_owner, approved_at)
SELECT
  'Get Company',
  'Empresa colombiana de gestión humana y servicios temporales. Publica sus propias vacantes en GetEmpleos.',
  'https://getcompany.co',
  'Medellín',
  'Gestión humana',
  'approved',
  true,
  now()
WHERE NOT EXISTS (SELECT 1 FROM public.companies WHERE is_platform_owner);

-- ============================================================
-- 3. Backfill: ofertas propias sin empresa asociada
-- ============================================================
UPDATE public.jobs
SET company_id = (SELECT id FROM public.companies WHERE is_platform_owner LIMIT 1)
WHERE company_id IS NULL;

-- ============================================================
-- 4. Lectura pública de la empresa propietaria
--
-- Las tarjetas del portal público hacen JOIN con companies. Sin esta política
-- las ofertas de Get Company aparecerían sin nombre ni logo para visitantes
-- no autenticados.
-- ============================================================
DROP POLICY IF EXISTS "companies_public_read_platform_owner" ON public.companies;

CREATE POLICY "companies_public_read_platform_owner" ON public.companies
  FOR SELECT
  USING (is_platform_owner);

COMMIT;

-- Migración 007: corregir política de UPDATE de jobs para empresas
--
-- Problema: la política "jobs_company_update" de migration 003 restringe
-- status a ('draft', 'pending_review', 'closed'), bloqueando la publicación
-- directa. La migration 004 intentó corregirlo creando una segunda política
-- "company_update_own_jobs", pero en algunos entornos no fue aplicada.
--
-- Solución: reemplazar AMBAS políticas por una sola política unificada que
-- permite a empresas aprobadas establecer los estados que corresponden a su
-- flujo: draft → active → paused/closed.

DROP POLICY IF EXISTS "jobs_company_update"      ON public.jobs;
DROP POLICY IF EXISTS "company_update_own_jobs"  ON public.jobs;

CREATE POLICY "jobs_company_update" ON public.jobs
  FOR UPDATE
  TO authenticated
  USING (
    -- La empresa solo puede editar sus propias ofertas
    company_id IN (
      SELECT id FROM public.companies WHERE created_by = auth.uid()
    )
  )
  WITH CHECK (
    -- Empresa aprobada puede poner 'active' y 'paused'; borrador y cerrado siempre
    status IN ('draft', 'active', 'paused', 'closed')
    AND company_id IN (
      SELECT id FROM public.companies
      WHERE created_by = auth.uid() AND status = 'approved'
    )
  );

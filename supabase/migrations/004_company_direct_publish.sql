-- Migración 004: empresas aprobadas pueden publicar ofertas directamente
-- (sin pasar por pending_review → admin)

-- ── Actualizar política UPDATE de jobs para empresas ─────────────────────────
-- La política anterior solo permitía status IN ('draft','pending_review','closed').
-- Ahora permitimos 'active' y 'paused' también para que submitEmpresaJobAction
-- pueda publicar directamente y las empresas puedan pausar sus propias ofertas.

DROP POLICY IF EXISTS "company_update_own_jobs" ON jobs;

CREATE POLICY "company_update_own_jobs" ON jobs
  FOR UPDATE
  TO authenticated
  USING (
    -- Solo puede tocar sus propias ofertas y la empresa debe estar aprobada
    company_id IN (
      SELECT id FROM companies
      WHERE created_by = auth.uid()
        AND status = 'approved'
    )
  )
  WITH CHECK (
    -- Los estados permitidos al escribir (excluye pending_review para forzar
    -- el flujo: draft → active, o active → paused/closed)
    status IN ('draft', 'active', 'paused', 'closed')
    AND company_id IN (
      SELECT id FROM companies WHERE created_by = auth.uid()
    )
  );

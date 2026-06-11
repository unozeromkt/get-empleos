-- Migración 005: permitir a empresas ver datos de candidatos que se postularon
-- a sus propias ofertas. Sin esta política los JOINs en la query de postulaciones
-- devuelven vacío porque las tablas profiles y candidates solo permiten
-- lectura al propio dueño o a admins.

-- ── profiles: empresa puede leer el perfil de un candidato que se postuló ────
CREATE POLICY "company_read_applicant_profiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'candidate'
    AND id IN (
      SELECT a.candidate_id
      FROM   applications  a
      JOIN   jobs          j ON j.id = a.job_id
      JOIN   companies     c ON c.id = j.company_id
      WHERE  c.created_by = auth.uid()
    )
  );

-- ── candidates: empresa puede leer el perfil extendido del candidato ──────────
CREATE POLICY "company_read_applicant_candidates" ON candidates
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT a.candidate_id
      FROM   applications  a
      JOIN   jobs          j ON j.id = a.job_id
      JOIN   companies     c ON c.id = j.company_id
      WHERE  c.created_by = auth.uid()
    )
  );

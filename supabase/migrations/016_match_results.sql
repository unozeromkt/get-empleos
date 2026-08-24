-- ============================================================
-- Migración 016: resultados de matching — spec §11, §21, §22
--
--   1. match_results              — score, banda, confianza, breakdown
--   2. match_requirement_results  — un registro por requisito, con evidencia
--
-- RLS CRÍTICA: el candidato NUNCA puede leer su propio score. Es el mismo
-- principio que admin_notes (CLAUDE.md:441), y aquí el riesgo es mayor:
-- exponer la puntuación a alguien rechazado es un problema legal, no solo
-- de producto.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.match_results (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cuelga de job_candidates, no de applications: así cubre por igual a los
  -- postulados y a los CV que sube el admin de gente sin cuenta (plan §3.9)
  job_candidate_id            uuid        NOT NULL REFERENCES public.job_candidates(id) ON DELETE CASCADE,
  job_id                      uuid        NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,

  -- Versiones exactas usadas. Sin esto un resultado histórico no se puede
  -- explicar meses después (spec §22)
  job_profile_version_id      uuid        REFERENCES public.job_profile_versions(id) ON DELETE SET NULL,
  candidate_profile_version_id uuid       REFERENCES public.candidate_profile_versions(id) ON DELETE SET NULL,

  overall_score               int         NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  band                        text        NOT NULL CHECK (band IN ('high','potential','low','insufficient_data')),

  -- Independiente del score (spec §20): un 88 con 54% de confianza es válido
  score_confidence            numeric(3,2) NOT NULL CHECK (score_confidence BETWEEN 0 AND 1),

  category_scores             jsonb       NOT NULL,  -- las 6 categorías; null = no aplicable
  applied_weights             jsonb       NOT NULL,  -- pesos tras renormalizar (§12.2)
  critical_gaps               jsonb       NOT NULL DEFAULT '[]'::jsonb,
  explanation                 jsonb       NOT NULL,

  -- Trazabilidad completa (spec §22)
  scoring_version             text        NOT NULL,
  taxonomy_version            text,
  model_name                  text,
  prompt_version              text,

  -- Evita recalcular si nada relevante cambió (spec §34)
  input_hash                  text        NOT NULL,
  is_current                  boolean     NOT NULL DEFAULT true,

  computed_at                 timestamptz NOT NULL DEFAULT now()
);

-- Un solo resultado vigente por candidato-oferta
CREATE UNIQUE INDEX IF NOT EXISTS match_results_current_idx
  ON public.match_results (job_candidate_id)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS match_results_job_idx
  ON public.match_results (job_id, overall_score DESC)
  WHERE is_current;

CREATE INDEX IF NOT EXISTS match_results_band_idx
  ON public.match_results (job_id, band)
  WHERE is_current;

ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_results_admin_all" ON public.match_results
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "match_results_company_read" ON public.match_results
  FOR SELECT
  USING (
    job_id IN (
      SELECT j.id FROM public.jobs j
      JOIN public.companies c ON c.id = j.company_id
      WHERE c.created_by = auth.uid()
    )
  );

-- Sin política para candidatos: no pueden leer su score bajo ninguna circunstancia.

-- ============================================================
-- Detalle por requisito — spec §14, §19
--
-- Es lo que permite responder "¿POR QUÉ este candidato obtuvo este score?"
-- mostrando el fragmento del CV que sustenta cada coincidencia.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.match_requirement_results (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_result_id    uuid        NOT NULL REFERENCES public.match_results(id) ON DELETE CASCADE,

  requirement_type   text        NOT NULL CHECK (requirement_type IN
                                   ('skill','experience','education','language','certification','responsibility')),
  requirement_text   text        NOT NULL,
  importance         text        NOT NULL CHECK (importance IN ('must_have','required','preferred')),

  -- unknown ≠ not_found (spec §8): que el CV no lo mencione no demuestra
  -- que el candidato no lo tenga
  status             text        NOT NULL CHECK (status IN ('matched','partial','unknown','not_found')),
  match_type         text        NOT NULL CHECK (match_type IN
                                   ('exact','canonical_alias','taxonomy_related','semantic','partial','unknown','not_found')),
  match_score        numeric(3,2) NOT NULL CHECK (match_score BETWEEN 0 AND 1),

  candidate_value    text,
  candidate_evidence text,
  confidence         numeric(3,2),

  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_requirement_results_match_idx
  ON public.match_requirement_results (match_result_id);

ALTER TABLE public.match_requirement_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_requirement_results_admin_all" ON public.match_requirement_results
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "match_requirement_results_company_read" ON public.match_requirement_results
  FOR SELECT
  USING (
    match_result_id IN (
      SELECT m.id FROM public.match_results m
      JOIN public.jobs j     ON j.id = m.job_id
      JOIN public.companies c ON c.id = j.company_id
      WHERE c.created_by = auth.uid()
    )
  );

COMMIT;

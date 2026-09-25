-- ============================================================
-- 024 — Configuración de scoring v4
--
-- Separa las competencias conductuales no observables en un CV del match
-- técnico. Su ausencia deja el requisito como `unknown`; solo la evidencia
-- laboral concreta permite que la categoría conductual participe en el score.
-- ============================================================
BEGIN;

UPDATE public.scoring_configurations
   SET is_active = false
 WHERE scope = 'global' AND is_active;

INSERT INTO public.scoring_configurations
  (version, scope, weights, bands, experience_weights, minimum_profile_confidence,
   weight_mode, adaptive_blend, notes)
VALUES (
  'v4',
  'global',
  '{
    "technical_skills": 33,
    "experience": 29,
    "education_certifications": 9,
    "transferable_skills": 10,
    "languages": 4,
    "preferred_skills": 10,
    "location": 5
  }'::jsonb,
  '{ "high": 80, "potential": 60 }'::jsonb,
  '{
    "relevant_years_fit": 0.35,
    "role_similarity": 0.25,
    "responsibility_coverage": 0.30,
    "required_domain_experience": 0.10
  }'::jsonb,
  0.65,
  'adaptive',
  0.50,
  'v4: conserva las correcciones v3 y excluye competencias conductuales sin evidencia concreta. Las alternativas con "o" no deben convertirse en requisitos simultáneos. Pendiente de calibración con resultados reales.'
);

COMMIT;

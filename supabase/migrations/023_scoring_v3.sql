-- ============================================================
-- 023 — Configuración de scoring v3
--
-- Corrige tres falsos negativos observados en el caso real de Auxiliar de
-- Bodega: duraciones explícitas, resolución del cargo logístico y tratamiento
-- de funciones no descritas como datos desconocidos, no como incumplimientos.
-- Los pesos se conservan; cambia la versión porque cambió el significado de
-- las señales. Los resultados históricos no se sobrescriben.
-- ============================================================
BEGIN;

UPDATE public.scoring_configurations
   SET is_active = false
 WHERE scope = 'global' AND is_active;

INSERT INTO public.scoring_configurations
  (version, scope, weights, bands, experience_weights, minimum_profile_confidence,
   weight_mode, adaptive_blend, notes)
VALUES (
  'v3',
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
  'v3: usa duraciones explícitas por cargo, reconoce equivalencias de oficios logísticos y trata funciones sin detalle como unknown. La cobertura visible excluye unknown. Pendiente de calibración con resultados reales de selección.'
);

COMMIT;

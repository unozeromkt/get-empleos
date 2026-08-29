-- ============================================================
-- 022 — Configuración de scoring v2
--
-- Motivo: comparando un caso real (vacante "Operario(a) Call Center" en Neiva
-- contra una candidata que el cliente considera idónea) el motor v1 la dejaba
-- fuera de la banda alta. El diagnóstico no fue de pesos sino de método: el
-- motor comparaba CADENAS DE TEXTO en vez de competencias, así que un CV que
-- describe el mismo trabajo con otras palabras puntuaba como si no lo hubiera
-- hecho nunca. Ver docs/ALGORITMO_DE_MATCHING.md §16.
--
-- Cambios que acompañan a esta versión (todos en lib/matching/):
--   · Morfología del español al comparar ("clientes" cubre "cliente",
--     "negociación" cubre "negociar").
--   · Taxonomía de oficio: quien maneja Excel cumple "herramientas ofimáticas";
--     un "Agente de Servicio al Cliente" cubre un cargo de "Call Center".
--   · La similitud deja de usarse como nota: se convierte en cumplimiento.
--   · Las competencias blandas ya pueden sustentarse en la experiencia laboral,
--     que es justo lo que la spec §17 exigía y el código no hacía.
--   · Nueva categoría `location`: para un cargo presencial, la ciudad es un
--     requisito del puesto. Se compara CIUDAD, nunca dirección de residencia.
--   · Pesos adaptativos: el reparto fijo asumía vacantes técnicas y no
--     describe lo que publica Get Company.
--
-- Los resultados históricos NO se recalculan: quedan con su versión v1, que es
-- la que explica la decisión que se tomó en su momento (spec §22).
-- ============================================================
BEGIN;

ALTER TABLE public.scoring_configurations
  ADD COLUMN IF NOT EXISTS weight_mode text NOT NULL DEFAULT 'adaptive'
    CHECK (weight_mode IN ('fixed', 'adaptive')),
  ADD COLUMN IF NOT EXISTS adaptive_blend numeric(3, 2) NOT NULL DEFAULT 0.50
    CHECK (adaptive_blend >= 0 AND adaptive_blend <= 1);

COMMENT ON COLUMN public.scoring_configurations.weight_mode IS
  'fixed: usa los pesos tal cual. adaptive: los reajusta según la masa real de requisitos de la oferta.';
COMMENT ON COLUMN public.scoring_configurations.adaptive_blend IS
  'Cuánto manda la forma de la oferta sobre los pesos configurados. 0 = solo configuración, 1 = solo oferta.';

-- El detalle de requisitos admite ahora filas de tipo 'location'
ALTER TABLE public.match_requirement_results
  DROP CONSTRAINT IF EXISTS match_requirement_results_requirement_type_check;

ALTER TABLE public.match_requirement_results
  ADD CONSTRAINT match_requirement_results_requirement_type_check
  CHECK (requirement_type IN
    ('skill','experience','education','language','certification','responsibility','location'));

-- Solo puede haber una configuración global activa (índice único parcial):
-- se retira la v1 antes de insertar la v2.
UPDATE public.scoring_configurations
   SET is_active = false
 WHERE scope = 'global' AND is_active;

INSERT INTO public.scoring_configurations
  (version, scope, weights, bands, experience_weights, minimum_profile_confidence,
   weight_mode, adaptive_blend, notes)
VALUES (
  'v2',
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
  'v2: comparación por competencia en vez de por texto, categoría de ubicación y pesos adaptativos. Los pesos siguen SIN CALIBRAR contra contrataciones reales; ahora existe un caso de referencia en tests/calibracion/.'
)
ON CONFLICT DO NOTHING;

COMMIT;

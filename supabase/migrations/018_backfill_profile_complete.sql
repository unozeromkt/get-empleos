-- ============================================================
-- Migración 018: recalcula profile_complete con la regla nueva (3 campos)
--
-- El requisito para postularse pasó de 6 campos (nombre, ciudad, nivel
-- educativo, carrera, años de experiencia, disponibilidad) a solo 3:
-- nombre, teléfono y CV cargado (ver lib/utils/profile-complete.ts).
--
-- `candidates.profile_complete` es un valor guardado, no calculado al leer:
-- solo se recalcula cuando el candidato guarda el formulario, sube el CV, o
-- confirma el perfil extraído por IA. Cualquier candidato que se registró
-- antes de este cambio y no volvió a tocar ninguna de esas tres acciones
-- sigue con el valor de la regla vieja — puede estar bloqueado para
-- postularse aunque ya cumpla la regla nueva.
--
-- Esta migración recalcula el flag para TODOS los candidatos existentes,
-- una sola vez, con la regla vigente.
-- ============================================================

BEGIN;

UPDATE public.candidates c
SET profile_complete = (
  TRIM(COALESCE(p.full_name, '')) <> ''
  AND TRIM(COALESCE(p.phone, '')) <> ''
  AND c.cv_url IS NOT NULL
)
FROM public.profiles p
WHERE p.id = c.id;

COMMIT;

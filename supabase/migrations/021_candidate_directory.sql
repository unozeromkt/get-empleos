-- ============================================================
-- 021 — Vista unificada de la base de hojas de vida
--
-- La pantalla /admin/candidates mezclaba en Node dos orígenes (candidatos con
-- cuenta y hojas de vida sin cuenta) trayéndose las tablas enteras. Eso no
-- escala y tiene tres puntos de rotura:
--
--   1. Los `.in(source_document_id, [...])` mandan los UUID en la URL: a unos
--      cientos de documentos se supera el límite y devuelve HTTP 414.
--   2. Sin `.range()`, PostgREST trunca en el tope por defecto (~1000 filas)
--      SIN error: dejarían de verse hojas de vida en silencio.
--   3. Traer `applications` entera solo para contar es O(n) sobre una tabla
--      que crece con cada postulación.
--
-- La vista resuelve los tres: una sola consulta paginable con `.range()` y
-- contadores con `head: true`, que no traen filas.
-- ============================================================

-- security_invoker: la vista se evalúa con los permisos de quien consulta, así
-- que la RLS de las tablas subyacentes sigue aplicando. Sin esto la vista
-- correría como su definidor y sería un agujero de seguridad.
CREATE OR REPLACE VIEW public.candidate_directory
WITH (security_invoker = true) AS

-- ── Capa 1: candidatos con cuenta ──
SELECT
  'registered'::text                      AS tier,
  c.id::text                              AS key_id,
  c.id                                    AS candidate_id,
  cd.id                                   AS document_id,
  COALESCE(NULLIF(btrim(p.full_name), ''), 'Sin nombre') AS name,
  p.email                                 AS email,
  NULL::text                              AS filename,
  c.career                                AS headline,
  c.years_experience::numeric             AS years,
  NULL::text                              AS city,
  (c.cv_url IS NOT NULL)                  AS has_cv,
  NULL::text                              AS doc_status,
  p.created_at                            AS created_at,
  p.avatar_url                            AS avatar_url,
  NULL::uuid                              AS job_id,
  NULL::uuid                              AS job_candidate_id,
  (SELECT count(*) FROM public.applications a WHERE a.candidate_id = c.id) AS applications
FROM public.candidates c
JOIN public.profiles p ON p.id = c.id
LEFT JOIN LATERAL (
  SELECT d.id
  FROM public.candidate_documents d
  WHERE d.candidate_id = c.id AND d.is_current
  ORDER BY d.created_at DESC
  LIMIT 1
) cd ON true

UNION ALL

-- ── Capa 2: hojas de vida sin cuenta (cargadas por un admin) ──
SELECT
  'cv'::text,
  d.id::text,
  NULL::uuid,
  d.id,
  -- Identidad: nombre extraído por la IA; si no, el que puso el admin; y como
  -- último recurso el nombre del archivo.
  COALESCE(
    NULLIF(btrim(pv.prof -> 'contact' ->> 'full_name'), ''),
    NULLIF(btrim(jc.display_name), ''),
    d.original_filename,
    'Hoja de vida'
  ),
  pv.prof -> 'contact' ->> 'email',
  d.original_filename,
  pv.prof ->> 'headline',
  -- El campo puede venir null o no numérico según lo que traiga el CV
  CASE
    WHEN pv.prof ->> 'total_years_experience' ~ '^[0-9]+(\.[0-9]+)?$'
    THEN (pv.prof ->> 'total_years_experience')::numeric
    ELSE NULL
  END,
  pv.prof -> 'contact' ->> 'city',
  true,
  d.status,
  d.created_at,
  NULL::text,
  jc.job_id,
  jc.id,
  0::bigint
FROM public.candidate_documents d
LEFT JOIN LATERAL (
  -- El perfil confirmado por un humano manda sobre el extraído
  SELECT COALESCE(v.confirmed_profile, v.ai_profile) AS prof
  FROM public.candidate_profile_versions v
  WHERE v.source_document_id = d.id AND v.is_current
  ORDER BY v.created_at DESC
  LIMIT 1
) pv ON true
LEFT JOIN LATERAL (
  SELECT j.id, j.job_id, j.display_name
  FROM public.job_candidates j
  WHERE j.document_id = d.id
  ORDER BY j.created_at DESC
  LIMIT 1
) jc ON true
WHERE d.candidate_id IS NULL AND d.is_current;

GRANT SELECT ON public.candidate_directory TO authenticated;

-- Índices de apoyo para el conteo de postulaciones y los LATERAL
CREATE INDEX IF NOT EXISTS applications_candidate_idx
  ON public.applications (candidate_id);

CREATE INDEX IF NOT EXISTS candidate_documents_current_idx
  ON public.candidate_documents (candidate_id, is_current, created_at DESC);

CREATE INDEX IF NOT EXISTS job_candidates_document_idx
  ON public.job_candidates (document_id, created_at DESC);

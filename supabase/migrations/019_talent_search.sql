-- ============================================================
-- Migración 019: búsqueda de talento por lenguaje natural (módulo 04)
--
--   1. search_normalize()             — normalización IMMUTABLE (tildes, mayúsculas)
--   2. candidate_search_index         — proyección delgada del perfil canónico
--   3. refresh_candidate_search_index — mantenimiento por trigger
--   4. talent_search_recall()         — recall indexado
--   5. talent_searches                — auditoría, caché de parseo y búsquedas guardadas
--   6. Índice FTS sobre candidate_documents.extracted_text
--
-- 100% ADITIVA: solo CREATE. No modifica ninguna tabla ni columna existente.
-- Con FEATURE_AI_TALENT_SEARCH=false nada de esto se consulta y la plataforma
-- funciona exactamente igual que antes.
--
-- RLS: todo el módulo es de uso exclusivo del admin de Get Company. Ni las
-- empresas cliente ni los candidatos leen nada de aquí.
--
-- Referencia: docs/BUSQUEDA_LENGUAJE_NATURAL.md
-- ============================================================

BEGIN;

-- ============================================================
-- 1. search_normalize — minúsculas sin tildes
--
-- IMMUTABLE a propósito: se usa dentro de índices. `unaccent` no sirve aquí
-- porque no es IMMUTABLE (depende de un diccionario configurable).
-- La misma función está replicada en TS (lib/search/normalize.ts) para que los
-- términos de la consulta se normalicen exactamente igual que el índice.
-- ============================================================
CREATE OR REPLACE FUNCTION public.search_normalize(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT btrim(translate(
    lower(p_text),
    'áàäâãéèëêíìïîóòöôõúùüûñç',
    'aaaaaeeeeiiiiooooouuuunc'
  ));
$$;

-- ============================================================
-- 2. candidate_search_index
--
-- Una fila por perfil canónico VIGENTE. Existe para no tener que desempaquetar
-- el jsonb de miles de perfiles en cada búsqueda: aquí el prefiltro es un
-- índice, y solo los finalistas pagan el coste de cargar el perfil completo.
--
-- display_name, email y phone viven aquí SOLO para mostrar y contactar. Nunca
-- entran al motor de scoring — `toCandidateEvidence()` no los copia (spec §29).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.candidate_search_index (
  profile_version_id uuid PRIMARY KEY
                     REFERENCES public.candidate_profile_versions(id) ON DELETE CASCADE,

  -- NULL cuando el CV lo subió el admin y la persona no tiene cuenta
  candidate_id       uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  document_id        uuid REFERENCES public.candidate_documents(id) ON DELETE SET NULL,

  -- Datos de contacto: operar la plataforma, jamás rankear
  display_name       text,
  email              text,
  phone              text,

  city               text,   -- tal cual, para mostrar
  city_norm          text,   -- normalizado, para filtrar
  headline           text,

  -- Proyección normalizada del perfil canónico
  skills             text[] NOT NULL DEFAULT '{}',
  job_titles         text[] NOT NULL DEFAULT '{}',
  languages          text[] NOT NULL DEFAULT '{}',
  certifications     text[] NOT NULL DEFAULT '{}',
  education_fields   text[] NOT NULL DEFAULT '{}',

  -- NULL cuando el CV no trae fechas suficientes. NULL nunca es 0 (spec §8)
  total_years        numeric,
  overall_confidence numeric(3,2),

  source             text NOT NULL CHECK (source IN ('candidate', 'admin_upload')),

  searchable         tsvector,

  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS candidate_search_skills_idx
  ON public.candidate_search_index USING gin (skills);
CREATE INDEX IF NOT EXISTS candidate_search_titles_idx
  ON public.candidate_search_index USING gin (job_titles);
CREATE INDEX IF NOT EXISTS candidate_search_fts_idx
  ON public.candidate_search_index USING gin (searchable);
CREATE INDEX IF NOT EXISTS candidate_search_city_idx
  ON public.candidate_search_index (city_norm);
CREATE INDEX IF NOT EXISTS candidate_search_years_idx
  ON public.candidate_search_index (total_years);
CREATE INDEX IF NOT EXISTS candidate_search_candidate_idx
  ON public.candidate_search_index (candidate_id);

ALTER TABLE public.candidate_search_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "candidate_search_index_admin_all" ON public.candidate_search_index
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- 3. refresh_candidate_search_index
--
-- Reconstruye (o borra) la fila de índice de un perfil. Se invoca desde el
-- trigger y desde el backfill, así que la lógica vive en un solo sitio.
--
-- Un perfil deja de indexarse en cuanto pierde is_current: la búsqueda solo ve
-- la versión vigente de cada hoja de vida.
-- ============================================================
CREATE OR REPLACE FUNCTION public.refresh_candidate_search_index(p_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v           public.candidate_profile_versions%ROWTYPE;
  prof        jsonb;
  v_skills    text[];
  v_titles    text[];
  v_langs     text[];
  v_certs     text[];
  v_fields    text[];
  v_name      text;
  v_email     text;
  v_phone     text;
  v_city      text;
  v_years     numeric;
  v_narrative text;
BEGIN
  SELECT * INTO v FROM public.candidate_profile_versions WHERE id = p_version_id;

  IF NOT FOUND OR NOT v.is_current THEN
    DELETE FROM public.candidate_search_index WHERE profile_version_id = p_version_id;
    RETURN;
  END IF;

  -- Lo confirmado por la persona manda sobre lo inferido por la IA (spec §33)
  prof := COALESCE(v.confirmed_profile, v.ai_profile);

  IF prof IS NULL THEN
    DELETE FROM public.candidate_search_index WHERE profile_version_id = p_version_id;
    RETURN;
  END IF;

  -- ── Habilidades: se indexan el nombre canónico y el literal del CV ──
  SELECT COALESCE(array_agg(DISTINCT n) FILTER (WHERE n <> ''), '{}')
    INTO v_skills
    FROM (
      SELECT public.search_normalize(x) AS n
      FROM jsonb_array_elements(COALESCE(prof->'skills', '[]'::jsonb)) s,
           LATERAL unnest(ARRAY[s->>'canonical_name', s->>'raw_name']) AS u(x)
      WHERE x IS NOT NULL
    ) t;

  -- ── Cargos desempeñados ──
  SELECT COALESCE(array_agg(DISTINCT n) FILTER (WHERE n <> ''), '{}')
    INTO v_titles
    FROM (
      SELECT public.search_normalize(e->>'title') AS n
      FROM jsonb_array_elements(COALESCE(prof->'experience', '[]'::jsonb)) e
      WHERE e->>'title' IS NOT NULL
    ) t;

  SELECT COALESCE(array_agg(DISTINCT n) FILTER (WHERE n <> ''), '{}')
    INTO v_langs
    FROM (
      SELECT public.search_normalize(l->>'language') AS n
      FROM jsonb_array_elements(COALESCE(prof->'languages', '[]'::jsonb)) l
      WHERE l->>'language' IS NOT NULL
    ) t;

  SELECT COALESCE(array_agg(DISTINCT n) FILTER (WHERE n <> ''), '{}')
    INTO v_certs
    FROM (
      SELECT public.search_normalize(c->>'name') AS n
      FROM jsonb_array_elements(COALESCE(prof->'certifications', '[]'::jsonb)) c
      WHERE c->>'name' IS NOT NULL
    ) t;

  -- Área de estudio y título. La INSTITUCIÓN no se indexa a propósito (§29):
  -- convertir la universidad en criterio de búsqueda es exactamente el sesgo
  -- que el sistema promete no tener.
  SELECT COALESCE(array_agg(DISTINCT n) FILTER (WHERE n <> ''), '{}')
    INTO v_fields
    FROM (
      SELECT public.search_normalize(x) AS n
      FROM jsonb_array_elements(COALESCE(prof->'education', '[]'::jsonb)) ed,
           LATERAL unnest(ARRAY[ed->>'field', ed->>'degree']) AS u(x)
      WHERE x IS NOT NULL
    ) t;

  -- ── Texto libre: donde muchos CV declaran su especialidad sin repetirla
  --    en la lista de habilidades ──
  SELECT string_agg(txt, ' ')
    INTO v_narrative
    FROM (
      SELECT prof->>'headline' AS txt
      UNION ALL SELECT prof->>'professional_summary'
      UNION ALL
        SELECT concat_ws(' ', e->>'title', e->>'company')
        FROM jsonb_array_elements(COALESCE(prof->'experience', '[]'::jsonb)) e
      UNION ALL
        SELECT r
        FROM jsonb_array_elements(COALESCE(prof->'experience', '[]'::jsonb)) e2,
             LATERAL jsonb_array_elements_text(COALESCE(e2->'responsibilities', '[]'::jsonb)) r
      UNION ALL
        SELECT a
        FROM jsonb_array_elements(COALESCE(prof->'experience', '[]'::jsonb)) e3,
             LATERAL jsonb_array_elements_text(COALESCE(e3->'achievements', '[]'::jsonb)) a
      UNION ALL
        SELECT concat_ws(' ', p->>'name', p->>'description')
        FROM jsonb_array_elements(COALESCE(prof->'projects', '[]'::jsonb)) p
    ) x
    WHERE txt IS NOT NULL AND btrim(txt) <> '';

  -- ── Datos de contacto ──
  IF v.candidate_id IS NOT NULL THEN
    SELECT p.full_name, p.email, p.phone, p.city
      INTO v_name, v_email, v_phone, v_city
      FROM public.profiles p
      WHERE p.id = v.candidate_id;
  END IF;

  v_name  := COALESCE(NULLIF(btrim(COALESCE(v_name, '')),  ''), prof->'contact'->>'full_name');
  v_email := COALESCE(NULLIF(btrim(COALESCE(v_email, '')), ''), prof->'contact'->>'email');
  v_phone := COALESCE(NULLIF(btrim(COALESCE(v_phone, '')), ''), prof->'contact'->>'phone');
  v_city  := COALESCE(NULLIF(btrim(COALESCE(v_city, '')),  ''), prof->'contact'->>'city');

  -- Años totales solo si el CV permitía calcularlos. Ausencia → NULL, no 0.
  BEGIN
    v_years := NULLIF(prof->>'total_years_experience', '')::numeric;
  EXCEPTION WHEN OTHERS THEN
    v_years := NULL;
  END;

  INSERT INTO public.candidate_search_index (
    profile_version_id, candidate_id, document_id,
    display_name, email, phone,
    city, city_norm, headline,
    skills, job_titles, languages, certifications, education_fields,
    total_years, overall_confidence, source, searchable, updated_at
  ) VALUES (
    v.id, v.candidate_id, v.source_document_id,
    v_name, v_email, v_phone,
    v_city, public.search_normalize(v_city), prof->>'headline',
    v_skills, v_titles, v_langs, v_certs, v_fields,
    v_years, v.overall_confidence,
    CASE WHEN v.candidate_id IS NOT NULL THEN 'candidate' ELSE 'admin_upload' END,
    to_tsvector('spanish', public.search_normalize(concat_ws(' ',
      COALESCE(v_narrative, ''),
      array_to_string(v_skills, ' '),
      array_to_string(v_titles, ' '),
      array_to_string(v_fields, ' '),
      array_to_string(v_certs, ' ')
    ))),
    now()
  )
  ON CONFLICT (profile_version_id) DO UPDATE SET
    candidate_id       = EXCLUDED.candidate_id,
    document_id        = EXCLUDED.document_id,
    display_name       = EXCLUDED.display_name,
    email              = EXCLUDED.email,
    phone              = EXCLUDED.phone,
    city               = EXCLUDED.city,
    city_norm          = EXCLUDED.city_norm,
    headline           = EXCLUDED.headline,
    skills             = EXCLUDED.skills,
    job_titles         = EXCLUDED.job_titles,
    languages          = EXCLUDED.languages,
    certifications     = EXCLUDED.certifications,
    education_fields   = EXCLUDED.education_fields,
    total_years        = EXCLUDED.total_years,
    overall_confidence = EXCLUDED.overall_confidence,
    source             = EXCLUDED.source,
    searchable         = EXCLUDED.searchable,
    updated_at         = now();
END;
$$;

-- El índice NUNCA puede romper el camino de escritura: si un perfil trae datos
-- con una forma inesperada, se registra un WARNING y se sigue. Perder una fila
-- de índice degrada la búsqueda; abortar la transacción rompería la extracción
-- de hojas de vida entera.
CREATE OR REPLACE FUNCTION public.trg_refresh_candidate_search_index()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.candidate_search_index WHERE profile_version_id = OLD.id;
    RETURN OLD;
  END IF;

  BEGIN
    PERFORM public.refresh_candidate_search_index(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'candidate_search_index: no se pudo indexar el perfil %', NEW.id;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_candidate_profile_versions_search ON public.candidate_profile_versions;

CREATE TRIGGER trg_candidate_profile_versions_search
  AFTER INSERT OR UPDATE OR DELETE ON public.candidate_profile_versions
  FOR EACH ROW EXECUTE FUNCTION public.trg_refresh_candidate_search_index();

-- ============================================================
-- 4. talent_search_recall — capa de recall
--
-- Reduce la base a un conjunto plausible que después puntúa el motor
-- determinístico. Devuelve un `lexical_score` que solo sirve para ordenar el
-- recall: NO es una medida de idoneidad y nunca se muestra al usuario.
--
-- SECURITY INVOKER (por defecto): la RLS de admin sigue aplicando dentro.
-- ============================================================
CREATE OR REPLACE FUNCTION public.talent_search_recall(
  p_terms     text[]  DEFAULT '{}',
  p_city      text    DEFAULT NULL,
  p_min_years numeric DEFAULT NULL,
  p_limit     int     DEFAULT 400
)
RETURNS TABLE (profile_version_id uuid, lexical_score numeric)
LANGUAGE sql
STABLE
AS $$
  -- TODAS las referencias van cualificadas a propósito: los nombres de
  -- RETURNS TABLE son parámetros de salida visibles dentro del cuerpo, y una
  -- referencia suelta a `profile_version_id` o `lexical_score` sería ambigua.
  WITH norm AS (
    SELECT COALESCE(
             array_agg(public.search_normalize(t)) FILTER (WHERE btrim(COALESCE(t, '')) <> ''),
             '{}'
           ) AS terms
    FROM unnest(COALESCE(p_terms, '{}')) AS u(t)
  ),
  scored AS (
    SELECT
      csi.profile_version_id AS version_id,
      csi.total_years        AS years,
      (
        -- Coincidencia en habilidades: la señal más fuerte
        (SELECT count(*) FROM unnest(n.terms) AS a(q)
          WHERE EXISTS (SELECT 1 FROM unnest(csi.skills) AS b(s) WHERE b.s LIKE '%' || a.q || '%'))::numeric * 2

        -- Coincidencia en cargos desempeñados
        + (SELECT count(*) FROM unnest(n.terms) AS a(q)
            WHERE EXISTS (SELECT 1 FROM unnest(csi.job_titles) AS b(jt) WHERE b.jt LIKE '%' || a.q || '%'))::numeric

        -- Señal textual del resto del CV.
        -- Se rankea TÉRMINO A TÉRMINO y se toma el mejor: plainto_tsquery une
        -- con AND, así que una consulta de cinco términos casi nunca casaría
        -- entera y la señal se perdería. Aquí basta con que uno aparezca.
        + COALESCE(
            (SELECT max(ts_rank(csi.searchable, plainto_tsquery('spanish', a.q)))
               FROM unnest(n.terms) AS a(q)),
            0
          )::numeric * 4
      ) AS score
    FROM public.candidate_search_index csi, norm n
    WHERE (p_city IS NULL OR btrim(p_city) = '' OR csi.city_norm = public.search_normalize(p_city))
      -- Los años DESCONOCIDOS no excluyen: 'unknown' no es 'no cumple' (spec §8).
      -- El motor los puntuará como tal, con su confianza más baja.
      AND (p_min_years IS NULL OR csi.total_years IS NULL OR csi.total_years >= p_min_years)
  )
  SELECT scored.version_id, scored.score
  FROM scored
  ORDER BY scored.score DESC, scored.years DESC NULLS LAST
  LIMIT COALESCE(p_limit, 400);
$$;

REVOKE ALL ON FUNCTION public.talent_search_recall(text[], text, numeric, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.talent_search_recall(text[], text, numeric, int) TO authenticated;

-- ============================================================
-- 5. talent_searches — auditoría, caché de parseo y búsquedas guardadas
--
-- El costo de la llamada de parseo se registra AQUÍ y no en
-- ai_processing_runs: así esta migración no necesita tocar el CHECK de
-- run_type de la tabla existente.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.talent_searches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  raw_query       text NOT NULL,
  -- sha256 de la consulta normalizada: repetir una búsqueda idéntica reutiliza
  -- el parseo en lugar de pagar otra llamada al LLM (spec §34)
  query_hash      text NOT NULL,
  parsed_query    jsonb NOT NULL,

  results_count   int,
  evaluated_count int,

  -- Búsquedas guardadas: la misma fila, marcada
  is_saved        boolean NOT NULL DEFAULT false,
  label           text,

  model_provider  text,
  model_name      text,
  prompt_version  text,
  tokens_in       int,
  tokens_out      int,
  cost_usd        numeric(10, 6),

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talent_searches_hash_idx
  ON public.talent_searches (query_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS talent_searches_saved_idx
  ON public.talent_searches (created_by, created_at DESC)
  WHERE is_saved;
CREATE INDEX IF NOT EXISTS talent_searches_cost_idx
  ON public.talent_searches (created_at)
  WHERE cost_usd IS NOT NULL;

ALTER TABLE public.talent_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talent_searches_admin_all" ON public.talent_searches
  FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- ============================================================
-- 6. Índice FTS sobre el texto plano de los CV
--
-- Sostiene el segundo nivel de resultados: hojas de vida con texto extraído
-- pero sin perfil canónico todavía. Se muestran aparte y SIN puntaje.
-- ============================================================
-- Sin COALESCE a propósito: PostgREST genera exactamente
-- `to_tsvector('spanish', extracted_text)` en sus filtros `fts`, y el índice
-- solo se usa si la expresión coincide carácter a carácter.
CREATE INDEX IF NOT EXISTS candidate_documents_text_fts_idx
  ON public.candidate_documents
  USING gin (to_tsvector('spanish', extracted_text));

-- ============================================================
-- 7. Backfill del índice con los perfiles ya existentes
-- ============================================================
DO $$
DECLARE
  r       record;
  ok      int := 0;
  failed  int := 0;
BEGIN
  FOR r IN SELECT id FROM public.candidate_profile_versions WHERE is_current LOOP
    BEGIN
      PERFORM public.refresh_candidate_search_index(r.id);
      ok := ok + 1;
    EXCEPTION WHEN OTHERS THEN
      -- Un perfil con datos malformados no puede tumbar el backfill entero
      failed := failed + 1;
    END;
  END LOOP;

  RAISE NOTICE 'candidate_search_index: % perfiles indexados, % con error', ok, failed;
END;
$$;

COMMIT;

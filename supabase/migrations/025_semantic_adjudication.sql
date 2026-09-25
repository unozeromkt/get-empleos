-- Auditoría de la segunda opinión semántica. El score final continúa siendo
-- calculado por el motor versionado; aquí se conserva qué evidencia auxiliar
-- fue aceptada y con qué modelo/prompt se obtuvo.

alter table public.match_results
  add column if not exists semantic_status text not null default 'disabled'
    check (semantic_status in ('disabled', 'not_needed', 'applied', 'fallback')),
  add column if not exists semantic_adjudications jsonb not null default '[]'::jsonb,
  add column if not exists semantic_model_name text,
  add column if not exists semantic_prompt_version text;

comment on column public.match_results.semantic_status is
  'Estado de la adjudicación semántica: no reemplaza el motor determinístico.';
comment on column public.match_results.semantic_adjudications is
  'Decisiones semánticas aceptadas únicamente tras validar cita literal y confianza.';

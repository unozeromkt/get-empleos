-- v5: segunda opinión semántica acotada, con evidencia literal y créditos
-- fijos. Los pesos permanecen iguales a v4 para aislar el efecto del cambio.

begin;

update public.scoring_configurations
set is_active = false
where scope = 'global' and is_active = true;

insert into public.scoring_configurations (
  version,
  scope,
  weights,
  experience_weights,
  bands,
  minimum_profile_confidence,
  weight_mode,
  adaptive_blend,
  is_active,
  notes
)
select
  'v5',
  'global',
  weights,
  experience_weights,
  bands,
  minimum_profile_confidence,
  weight_mode,
  adaptive_blend,
  true,
  'v5: adjudicación semántica acotada; el motor conserva el score final.'
from public.scoring_configurations
where version = 'v4' and scope = 'global'
order by created_at desc
limit 1;

commit;

-- ============================================================
-- 020 — Papelera de ofertas
--
-- Hasta ahora la única forma de quitar una oferta del sistema era borrarla,
-- y `applications` tiene ON DELETE CASCADE sobre job_id: eliminar una oferta
-- se llevaba por delante las postulaciones de candidatos reales, sin vuelta
-- atrás. El estado 'archived' da una papelera reversible.
--
-- Una oferta archivada no aparece en el portal público (la política de lectura
-- pública exige status = 'active') ni en el listado por defecto del admin.
-- ============================================================

-- 1. Ampliar el CHECK de status con 'archived'
--    Se busca la constraint por definición porque el nombre ha cambiado entre
--    migraciones (001 la creó sin nombre explícito, 003 la renombró).
DO $$
DECLARE v_name text;
BEGIN
  SELECT conname INTO v_name
  FROM pg_constraint
  WHERE conrelid = 'public.jobs'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';
  IF v_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.jobs DROP CONSTRAINT %I', v_name);
  END IF;
END $$;

ALTER TABLE public.jobs
  ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('draft', 'pending_review', 'active', 'paused', 'closed', 'archived'));

-- 2. Cuándo se archivó y desde qué estado, para poder restaurar al estado
--    original en lugar de dejar todo en 'draft'.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_from text;

-- 3. Índice parcial: la papelera se consulta poco y siempre por el mismo filtro
CREATE INDEX IF NOT EXISTS jobs_archived_idx
  ON public.jobs (archived_at DESC)
  WHERE status = 'archived';

-- ============================================================
-- Nota sobre el cierre automático por expiración (migración 001):
-- solo actúa sobre status = 'active', así que no toca las archivadas.
-- ============================================================

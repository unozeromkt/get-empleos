-- ============================================================
-- Migración 012: corrige la política RLS de ai_processing_runs
--
-- Bug de la migración 008: solo se creó una política de SELECT para admins
-- ("ai_runs_admin_read"). Faltaba INSERT.
--
-- uploadJobDocumentAction y retryJobDocumentAction (lib/actions/ai-jobs.ts)
-- encolan trabajo usando el cliente de sesión del admin (createClient(),
-- respeta RLS) — no el cliente de service_role. Sin una política de INSERT,
-- Postgres bloqueaba el INSERT en silencio y Supabase lo devolvía como
-- "El documento se subió pero no se pudo encolar su procesamiento."
--
-- El worker (app/api/cron/ai-worker/route.ts) sí usa createAdminClient()
-- con service_role, que salta RLS por completo — por eso claim_ai_runs,
-- markRunSucceeded y markRunFailed nunca tuvieron este problema.
-- ============================================================

BEGIN;

CREATE POLICY "ai_runs_admin_insert" ON public.ai_processing_runs
  FOR INSERT
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

COMMIT;

-- ============================================================
-- Migración 017: permitir que el admin suba CVs al bucket 'cvs'
--
-- Bug de la migración 013: solo se creó "cvs_admin_read" (SELECT). El admin
-- puede LEER cualquier CV pero no ESCRIBIR ninguno.
--
-- uploadCandidateCVAction (lib/actions/ai-screening.ts) sube a la carpeta
-- 'admin-uploads/', que además no coincide con la política del candidato
-- —basada en que el primer segmento de la ruta sea su propio user id—, así
-- que la subida desde la pestaña "Subir CVs" fallaba siempre.
--
-- Las políticas del candidato sobre su propia carpeta NO se tocan.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'cvs') THEN

    DROP POLICY IF EXISTS "cvs_admin_insert" ON storage.objects;
    DROP POLICY IF EXISTS "cvs_admin_update" ON storage.objects;
    DROP POLICY IF EXISTS "cvs_admin_delete" ON storage.objects;

    CREATE POLICY "cvs_admin_insert" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'cvs'
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      );

    -- Necesario para poder limpiar el archivo si falla el registro en la
    -- tabla y no dejarlo huérfano en Storage
    CREATE POLICY "cvs_admin_delete" ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'cvs'
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      );

    CREATE POLICY "cvs_admin_update" ON storage.objects
      FOR UPDATE TO authenticated
      USING (
        bucket_id = 'cvs'
        AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      );

  ELSE
    RAISE WARNING 'Bucket "cvs" no existe.';
  END IF;
END $$;

COMMIT;

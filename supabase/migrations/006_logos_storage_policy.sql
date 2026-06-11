-- Migración 006: políticas de Storage para el bucket 'logos'
-- REQUISITO PREVIO: crear el bucket 'logos' en Supabase Dashboard
--   Storage → New bucket → nombre: "logos" → Public bucket: ON → Save
-- Luego ejecutar este SQL en el SQL Editor de Supabase.

-- Empresas pueden subir su propio logo
CREATE POLICY "company_upload_own_logo"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM companies WHERE created_by = auth.uid()
    )
  );

-- Empresas pueden reemplazar su propio logo
CREATE POLICY "company_update_own_logo"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'logos'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM companies WHERE created_by = auth.uid()
    )
  );

-- Lectura pública de logos (el bucket es público, pero dejamos política explícita)
CREATE POLICY "public_read_logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos');

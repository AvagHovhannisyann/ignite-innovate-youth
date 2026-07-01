
CREATE POLICY "qe own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='quest-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "qe own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='quest-evidence' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
CREATE POLICY "Anyone can view logos by folder"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'logos' AND array_length(storage.foldername(name), 1) >= 1);

DROP POLICY IF EXISTS "Anyone can view trip images" ON storage.objects;
CREATE POLICY "Anyone can view trip images by folder"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'trip-images' AND array_length(storage.foldername(name), 1) >= 1);

DROP POLICY IF EXISTS "Public can view promotion images" ON storage.objects;
CREATE POLICY "Anyone can view promotion images by folder"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'promotion-images' AND array_length(storage.foldername(name), 1) >= 1);

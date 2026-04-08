INSERT INTO storage.buckets (id, name, public) VALUES ('promotion-images', 'promotion-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins can upload promotion images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'promotion-images' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public can view promotion images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'promotion-images');

CREATE POLICY "Admins can delete promotion images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'promotion-images' AND public.has_role(auth.uid(), 'admin'));
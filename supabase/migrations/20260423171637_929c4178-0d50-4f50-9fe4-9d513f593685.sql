CREATE OR REPLACE FUNCTION public.set_admin_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL AND public.has_role(auth.uid(), 'admin') THEN
    NEW.company_id := public.get_user_company_id(auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_promotions_company_id ON public.promotions;
CREATE TRIGGER set_promotions_company_id
BEFORE INSERT OR UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.set_admin_company_id();

DROP TRIGGER IF EXISTS set_trips_company_id ON public.trips;
CREATE TRIGGER set_trips_company_id
BEFORE INSERT OR UPDATE ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.set_admin_company_id();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'promotion_images_promotion_id_fkey'
  ) THEN
    ALTER TABLE public.promotion_images
      ADD CONSTRAINT promotion_images_promotion_id_fkey
      FOREIGN KEY (promotion_id) REFERENCES public.promotions(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP POLICY IF EXISTS "Clients can view company promotions" ON public.promotions;
CREATE POLICY "Authenticated users can view published promotions"
ON public.promotions
FOR SELECT
TO authenticated
USING (draft_status = 'published');

DROP POLICY IF EXISTS "Clients can view booked trips" ON public.trips;
CREATE POLICY "Authenticated users can view public or assigned trips"
ON public.trips
FOR SELECT
TO authenticated
USING (
  (is_public = true AND draft_status = 'published')
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.clients c ON c.id = b.client_id
    WHERE b.trip_id = trips.id AND c.email = public.get_auth_email()
  )
);

DROP POLICY IF EXISTS "Clients can view booked trip images" ON public.trip_images;
CREATE POLICY "Authenticated users can view accessible trip images"
ON public.trip_images
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = trip_images.trip_id
      AND (
        (t.is_public = true AND t.draft_status = 'published')
        OR t.user_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.bookings b
          JOIN public.clients c ON c.id = b.client_id
          WHERE b.trip_id = t.id AND c.email = public.get_auth_email()
        )
      )
  )
);

DROP POLICY IF EXISTS "Admins can upload trip images" ON storage.objects;
CREATE POLICY "Admins can upload trip images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'trip-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update trip images" ON storage.objects;
CREATE POLICY "Admins can update trip images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'trip-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'trip-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete trip images" ON storage.objects;
CREATE POLICY "Admins can delete trip images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'trip-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can upload promotion images" ON storage.objects;
CREATE POLICY "Admins can upload promotion images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'promotion-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update promotion images" ON storage.objects;
CREATE POLICY "Admins can update promotion images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'promotion-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'promotion-images' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete promotion images" ON storage.objects;
CREATE POLICY "Admins can delete promotion images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'promotion-images' AND public.has_role(auth.uid(), 'admin'));

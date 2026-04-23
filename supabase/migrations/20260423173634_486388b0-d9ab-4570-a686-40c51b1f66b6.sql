DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trips' AND column_name = 'status') THEN
    ALTER TABLE public.trips ADD COLUMN status text NOT NULL DEFAULT 'scheduled';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seats') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seats' AND column_name = 'occupant_name') THEN
      ALTER TABLE public.seats ADD COLUMN occupant_name text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seats' AND column_name = 'updated_at') THEN
      ALTER TABLE public.seats ADD COLUMN updated_at timestamp with time zone NOT NULL DEFAULT now();
    END IF;
  END IF;
END $$;

UPDATE public.trips
SET status = CASE
  WHEN draft_status = 'draft' THEN 'draft'
  WHEN end_date < CURRENT_DATE THEN 'completed'
  WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 'active'
  ELSE 'scheduled'
END
WHERE status IS NULL OR status IN ('published', '');

CREATE OR REPLACE FUNCTION public.refresh_trip_statuses()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.trips
  SET status = CASE
    WHEN draft_status = 'draft' THEN 'draft'
    WHEN status IN ('cancelled', 'archived') THEN status
    WHEN end_date < CURRENT_DATE THEN 'completed'
    WHEN start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE THEN 'active'
    ELSE 'scheduled'
  END,
  updated_at = now()
  WHERE status NOT IN ('cancelled', 'archived') OR status IS NULL;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'seats') THEN
    ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Admins can manage seats" ON public.seats;
    CREATE POLICY "Admins can manage seats"
    ON public.seats
    FOR ALL
    TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));

    DROP POLICY IF EXISTS "Authenticated users can view trip seats" ON public.seats;
    CREATE POLICY "Authenticated users can view trip seats"
    ON public.seats
    FOR SELECT
    TO authenticated
    USING (true);
  END IF;
END $$;

DROP POLICY IF EXISTS "Admins can manage company trips" ON public.trips;
CREATE POLICY "Admins can manage company trips"
ON public.trips
FOR ALL
TO authenticated
USING ((company_id = public.get_user_company_id(auth.uid())) AND public.has_role(auth.uid(), 'admin'))
WITH CHECK ((company_id = public.get_user_company_id(auth.uid())) AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Authenticated users can view public or assigned trips" ON public.trips;
CREATE POLICY "Authenticated users can view public or assigned trips"
ON public.trips
FOR SELECT
TO authenticated
USING (
  ((is_public = true) AND (draft_status = 'published') AND (status IN ('scheduled', 'active')))
  OR (user_id = auth.uid() AND status IN ('scheduled', 'active'))
  OR EXISTS (
    SELECT 1
    FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE b.trip_id = trips.id
      AND c.email = public.get_auth_email()
      AND trips.status IN ('scheduled', 'active')
  )
);
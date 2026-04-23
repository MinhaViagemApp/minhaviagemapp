ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS max_installments_card integer NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS credit_card_fee_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS draft_status text NOT NULL DEFAULT 'published';

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS draft_status text NOT NULL DEFAULT 'published';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS address text;

ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'pix';

CREATE TABLE IF NOT EXISTS public.promotion_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id uuid NOT NULL,
  image_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.promotion_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage promotion images" ON public.promotion_images;
CREATE POLICY "Admins can manage promotion images"
ON public.promotion_images
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Clients can view promotion images" ON public.promotion_images;
CREATE POLICY "Clients can view promotion images"
ON public.promotion_images
FOR SELECT
TO authenticated
USING (true);

CREATE TABLE IF NOT EXISTS public.trip_queries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  trip_id uuid NOT NULL,
  payment_method text NOT NULL DEFAULT 'pix',
  installments integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pendente',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_queries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage trip queries" ON public.trip_queries;
CREATE POLICY "Admins can manage trip queries"
ON public.trip_queries
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Clients can manage own trip queries" ON public.trip_queries;
CREATE POLICY "Clients can manage own trip queries"
ON public.trip_queries
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.trip_seats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id uuid NOT NULL,
  user_id uuid,
  seat_number text NOT NULL,
  status text NOT NULL DEFAULT 'reserved',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (trip_id, seat_number)
);

ALTER TABLE public.trip_seats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage trip seats" ON public.trip_seats;
CREATE POLICY "Admins can manage trip seats"
ON public.trip_seats
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Clients can view own trip seats" ON public.trip_seats;
CREATE POLICY "Clients can view own trip seats"
ON public.trip_seats
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_trip_queries_updated_at ON public.trip_queries;
CREATE TRIGGER update_trip_queries_updated_at
BEFORE UPDATE ON public.trip_queries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 1. Create companies table
CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  pix_key text,
  logo_url text,
  cnpj text,
  address text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- 2. Create user_companies junction table
CREATE TABLE public.user_companies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- 3. Create clients table (separate from profiles)
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email, company_id)
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 4. Add company_id to trips
ALTER TABLE public.trips ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- 5. Drop old bookings foreign keys if any, add proper ones
-- First drop old bookings table and recreate with proper FKs
DROP TABLE IF EXISTS public.bookings;
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  total_value numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'pix',
  payment_status text NOT NULL DEFAULT 'pendente',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, trip_id)
);
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 6. Helper function to get user's company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.user_companies WHERE user_id = _user_id LIMIT 1
$$;

-- 7. RLS for companies
CREATE POLICY "Users can view own company"
  ON public.companies FOR SELECT TO authenticated
  USING (id = public.get_user_company_id(auth.uid()));

CREATE POLICY "Admins can update own company"
  ON public.companies FOR UPDATE TO authenticated
  USING (id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

-- 8. RLS for user_companies
CREATE POLICY "Users can view own membership"
  ON public.user_companies FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage memberships"
  ON public.user_companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) AND company_id = public.get_user_company_id(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND company_id = public.get_user_company_id(auth.uid()));

-- 9. RLS for clients
CREATE POLICY "Admins can manage company clients"
  ON public.clients FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view self by email"
  ON public.clients FOR SELECT TO authenticated
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 10. Update trips RLS - drop old policies first
DROP POLICY IF EXISTS "Admins can manage all trips" ON public.trips;
DROP POLICY IF EXISTS "Clients can view own trips" ON public.trips;

CREATE POLICY "Admins can manage company trips"
  ON public.trips FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view booked trips"
  ON public.trips FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.clients c ON c.id = b.client_id
      WHERE b.trip_id = trips.id
      AND c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- 11. RLS for bookings
CREATE POLICY "Admins can manage company bookings"
  ON public.bookings FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = bookings.client_id AND c.company_id = public.get_user_company_id(auth.uid()))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = bookings.client_id AND c.company_id = public.get_user_company_id(auth.uid()))
  );

CREATE POLICY "Clients can view own bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = bookings.client_id
      AND c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- 12. Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clients;

-- 13. Update trip_images RLS
DROP POLICY IF EXISTS "Clients can view own trip images" ON public.trip_images;
CREATE POLICY "Clients can view booked trip images"
  ON public.trip_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bookings b
      JOIN public.clients c ON c.id = b.client_id
      WHERE b.trip_id = trip_images.trip_id
      AND c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

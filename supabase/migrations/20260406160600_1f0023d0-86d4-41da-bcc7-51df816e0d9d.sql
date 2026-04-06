
-- 1. Create a security definer function to get user email without direct auth.users access
CREATE OR REPLACE FUNCTION public.get_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- 2. Drop and recreate clients RLS policies that reference auth.users
DROP POLICY IF EXISTS "Clients can view self by email" ON public.clients;
CREATE POLICY "Clients can view self by email" ON public.clients
  FOR SELECT TO authenticated
  USING (email = public.get_auth_email());

-- 3. Drop and recreate bookings RLS policies that reference auth.users
DROP POLICY IF EXISTS "Clients can view own bookings" ON public.bookings;
CREATE POLICY "Clients can view own bookings" ON public.bookings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients c
    WHERE c.id = bookings.client_id
    AND c.email = public.get_auth_email()
  ));

-- 4. Drop and recreate trip_images RLS policies that reference auth.users  
DROP POLICY IF EXISTS "Clients can view booked trip images" ON public.trip_images;
CREATE POLICY "Clients can view booked trip images" ON public.trip_images
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE b.trip_id = trip_images.trip_id
    AND c.email = public.get_auth_email()
  ));

-- 5. Drop and recreate trips RLS policy for clients
DROP POLICY IF EXISTS "Clients can view booked trips" ON public.trips;
CREATE POLICY "Clients can view booked trips" ON public.trips
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM bookings b
    JOIN clients c ON c.id = b.client_id
    WHERE b.trip_id = trips.id
    AND c.email = public.get_auth_email()
  ));

-- 6. Add company_id to promotions and update its policies
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

DROP POLICY IF EXISTS "Admins can manage promotions" ON public.promotions;
CREATE POLICY "Admins can manage promotions" ON public.promotions
  FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (company_id = get_user_company_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "All authenticated can view promotions" ON public.promotions;
CREATE POLICY "Clients can view company promotions" ON public.promotions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM clients c
    WHERE c.company_id = promotions.company_id
    AND c.email = public.get_auth_email()
  ));

-- 7. Also allow clients to insert into bookings (for payment confirmation flows)
-- and allow clients to view companies they belong to
DROP POLICY IF EXISTS "Users can view own company" ON public.companies;
CREATE POLICY "Users can view own company" ON public.companies
  FOR SELECT TO authenticated
  USING (
    id = get_user_company_id(auth.uid())
    OR EXISTS (
      SELECT 1 FROM clients c
      WHERE c.company_id = companies.id
      AND c.email = public.get_auth_email()
    )
  );

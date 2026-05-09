
-- Função is_superadmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'superadmin'
  )
$$;

-- Tabela agency_subscriptions
CREATE TABLE IF NOT EXISTS public.agency_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'trial',
  monthly_amount numeric NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  canceled_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agency_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin manages subscriptions"
ON public.agency_subscriptions FOR ALL TO authenticated
USING (public.is_superadmin())
WITH CHECK (public.is_superadmin());

CREATE TRIGGER trg_agency_subs_updated
BEFORE UPDATE ON public.agency_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela link_clicks (cliques em links de divulgação)
CREATE TABLE IF NOT EXISTS public.link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'direct',
  campaign text,
  referrer text,
  user_agent text,
  ip_hash text,
  path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_link_clicks_created ON public.link_clicks (created_at DESC);
CREATE INDEX idx_link_clicks_source ON public.link_clicks (source);

CREATE POLICY "Anyone can insert click"
ON public.link_clicks FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Superadmin reads clicks"
ON public.link_clicks FOR SELECT TO authenticated
USING (public.is_superadmin());

-- Policies para superadmin enxergar tudo
CREATE POLICY "Superadmin reads all companies"
ON public.companies FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "Superadmin reads all clients"
ON public.clients FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "Superadmin reads all trips"
ON public.trips FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "Superadmin reads all bookings"
ON public.bookings FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "Superadmin reads all coupons"
ON public.coupons FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "Superadmin reads all promotions"
ON public.promotions FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "Superadmin reads all profiles"
ON public.profiles FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "Superadmin reads all user_roles"
ON public.user_roles FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "Superadmin reads all user_companies"
ON public.user_companies FOR SELECT TO authenticated USING (public.is_superadmin());

CREATE POLICY "Superadmin reads all installments"
ON public.installments FOR SELECT TO authenticated USING (public.is_superadmin());

-- Trigger: atribui superadmin automaticamente ao e-mail conhecido
CREATE OR REPLACE FUNCTION public.assign_superadmin_on_signup()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF lower(NEW.email) = 'dionemoney1@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'superadmin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_superadmin ON auth.users;
CREATE TRIGGER on_auth_user_created_superadmin
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.assign_superadmin_on_signup();

-- Caso o e-mail já exista, atribui agora
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'superadmin'::app_role FROM auth.users
WHERE lower(email) = 'dionemoney1@gmail.com'
ON CONFLICT DO NOTHING;

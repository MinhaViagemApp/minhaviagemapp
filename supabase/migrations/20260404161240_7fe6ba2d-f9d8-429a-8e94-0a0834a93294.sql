
-- Create bookings table
CREATE TABLE public.bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  total_value numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'pix',
  payment_status text NOT NULL DEFAULT 'pendente',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(client_id, trip_id)
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can manage all bookings"
  ON public.bookings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Clients can view their own bookings
CREATE POLICY "Clients can view own bookings"
  ON public.bookings FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

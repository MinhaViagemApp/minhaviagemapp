
CREATE TABLE public.bus_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  seat_number integer NOT NULL,
  status text NOT NULL DEFAULT 'livre',
  passenger_name text,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trip_id, seat_number)
);

ALTER TABLE public.bus_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage bus seats"
ON public.bus_seats FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clients can view seats for booked trips"
ON public.bus_seats FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM bookings b
  JOIN clients c ON c.id = b.client_id
  WHERE b.trip_id = bus_seats.trip_id AND c.email = get_auth_email()
));

CREATE TRIGGER update_bus_seats_updated_at
  BEFORE UPDATE ON public.bus_seats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS total_seats integer NOT NULL DEFAULT 44;

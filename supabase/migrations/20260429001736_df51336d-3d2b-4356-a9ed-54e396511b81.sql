ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmada',
  ADD COLUMN IF NOT EXISTS notification_shown boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON public.bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_trip_id ON public.bookings(trip_id);
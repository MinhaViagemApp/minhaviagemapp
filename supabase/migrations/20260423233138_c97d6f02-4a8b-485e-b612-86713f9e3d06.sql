-- 1. Add seat_number column to trip_queries to track pre-reserved seat
ALTER TABLE public.trip_queries
  ADD COLUMN IF NOT EXISTS seat_number integer,
  ADD COLUMN IF NOT EXISTS passenger_name text,
  ADD COLUMN IF NOT EXISTS phone text;

-- 2. New RPC: client pre-reserves a seat (status = 'pendente')
CREATE OR REPLACE FUNCTION public.prereserve_bus_seat(
  _trip_id uuid,
  _seat_number integer,
  _passenger_name text,
  _phone text DEFAULT NULL
)
RETURNS public.bus_seats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seat public.bus_seats;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT * INTO _seat
  FROM public.bus_seats
  WHERE trip_id = _trip_id AND seat_number = _seat_number
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.bus_seats (trip_id, seat_number, status, passenger_name, updated_at)
    VALUES (_trip_id, _seat_number, 'pendente', NULLIF(TRIM(_passenger_name), ''), now())
    RETURNING * INTO _seat;
  ELSE
    IF _seat.status NOT IN ('livre', 'free') THEN
      RAISE EXCEPTION 'Esta poltrona já está reservada nesta viagem.';
    END IF;
    UPDATE public.bus_seats
    SET status = 'pendente',
        passenger_name = NULLIF(TRIM(_passenger_name), ''),
        updated_at = now()
    WHERE id = _seat.id
    RETURNING * INTO _seat;
  END IF;

  RETURN _seat;
END;
$$;

-- 3. Allow clients to view all bus_seats of public/visible trips (so they see occupied seats)
DROP POLICY IF EXISTS "Authenticated can view bus seats of accessible trips" ON public.bus_seats;
CREATE POLICY "Authenticated can view bus seats of accessible trips"
ON public.bus_seats
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.id = bus_seats.trip_id
      AND (
        (t.is_public = true AND t.draft_status = 'published')
        OR t.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.bookings b JOIN public.clients c ON c.id = b.client_id WHERE b.trip_id = t.id AND c.email = public.get_auth_email())
      )
  )
);

-- 4. RPC for admin to confirm/reject a pre-reservation
CREATE OR REPLACE FUNCTION public.confirm_trip_query(_query_id uuid, _client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _q public.trip_queries;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores.';
  END IF;

  SELECT * INTO _q FROM public.trip_queries WHERE id = _query_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pré-reserva não encontrada.'; END IF;

  -- Confirm the seat
  IF _q.seat_number IS NOT NULL THEN
    UPDATE public.bus_seats
    SET status = 'ocupada', client_id = _client_id, updated_at = now()
    WHERE trip_id = _q.trip_id AND seat_number = _q.seat_number;
  END IF;

  -- Create booking
  INSERT INTO public.bookings (client_id, trip_id, payment_method)
  VALUES (_client_id, _q.trip_id, _q.payment_method);

  UPDATE public.trip_queries SET status = 'confirmada', updated_at = now() WHERE id = _query_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_trip_query(_query_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _q public.trip_queries;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores.';
  END IF;
  SELECT * INTO _q FROM public.trip_queries WHERE id = _query_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Não encontrada.'; END IF;

  IF _q.seat_number IS NOT NULL THEN
    UPDATE public.bus_seats
    SET status = 'livre', client_id = NULL, passenger_name = NULL, updated_at = now()
    WHERE trip_id = _q.trip_id AND seat_number = _q.seat_number AND status = 'pendente';
  END IF;

  UPDATE public.trip_queries SET status = 'recusada', updated_at = now() WHERE id = _query_id;
END;
$$;
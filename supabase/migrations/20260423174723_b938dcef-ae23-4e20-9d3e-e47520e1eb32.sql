CREATE UNIQUE INDEX IF NOT EXISTS bus_seats_trip_seat_unique
ON public.bus_seats (trip_id, seat_number);

CREATE UNIQUE INDEX IF NOT EXISTS trip_seats_trip_seat_unique
ON public.trip_seats (trip_id, seat_number);

CREATE OR REPLACE FUNCTION public.reserve_bus_seat(
  _trip_id uuid,
  _seat_number integer,
  _client_id uuid,
  _passenger_name text
)
RETURNS public.bus_seats
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _seat public.bus_seats;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem confirmar reservas.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.trips t
    WHERE t.id = _trip_id
      AND t.company_id = public.get_user_company_id(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Viagem não encontrada para esta agência.';
  END IF;

  SELECT *
  INTO _seat
  FROM public.bus_seats
  WHERE trip_id = _trip_id
    AND seat_number = _seat_number
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.bus_seats (trip_id, seat_number, status, client_id, passenger_name, updated_at)
    VALUES (_trip_id, _seat_number, 'ocupada', _client_id, NULLIF(TRIM(_passenger_name), ''), now())
    RETURNING * INTO _seat;
  ELSE
    IF _seat.status NOT IN ('livre', 'free') THEN
      RAISE EXCEPTION 'Esta poltrona já está ocupada nesta viagem.';
    END IF;

    UPDATE public.bus_seats
    SET status = 'ocupada',
        client_id = _client_id,
        passenger_name = NULLIF(TRIM(_passenger_name), ''),
        updated_at = now()
    WHERE id = _seat.id
    RETURNING * INTO _seat;
  END IF;

  RETURN _seat;
END;
$$;
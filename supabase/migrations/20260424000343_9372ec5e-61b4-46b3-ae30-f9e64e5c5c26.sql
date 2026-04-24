
-- Atualizar confirm_trip_query para:
-- 1) Identificar cliente pelo NOME (não pelo email) dentro da mesma empresa
-- 2) Gerar installments automaticamente baseado na trip_query
-- 3) Manter criação do booking

CREATE OR REPLACE FUNCTION public.confirm_trip_query(_query_id uuid, _client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _q public.trip_queries;
  _trip public.trips;
  _qty int;
  _per_amount numeric;
  _today date := CURRENT_DATE;
  i int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores.';
  END IF;

  SELECT * INTO _q FROM public.trip_queries WHERE id = _query_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pré-reserva não encontrada.'; END IF;

  SELECT * INTO _trip FROM public.trips WHERE id = _q.trip_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Viagem não encontrada.'; END IF;

  -- Confirmar a poltrona
  IF _q.seat_number IS NOT NULL THEN
    UPDATE public.bus_seats
    SET status = 'ocupada', client_id = _client_id, updated_at = now()
    WHERE trip_id = _q.trip_id AND seat_number = _q.seat_number;
  END IF;

  -- Criar booking (somente se ainda não existir para esse cliente nessa viagem)
  IF NOT EXISTS (
    SELECT 1 FROM public.bookings
    WHERE client_id = _client_id AND trip_id = _q.trip_id
  ) THEN
    INSERT INTO public.bookings (client_id, trip_id, payment_method, total_value)
    VALUES (_client_id, _q.trip_id, _q.payment_method, _trip.total_price);
  END IF;

  -- Gerar parcelas (somente se ainda não existirem para esse user nessa viagem)
  _qty := COALESCE(_q.installments, 1);
  IF _qty < 1 THEN _qty := 1; END IF;
  _per_amount := COALESCE(_trip.total_price, 0) / _qty;

  IF NOT EXISTS (
    SELECT 1 FROM public.installments
    WHERE trip_id = _q.trip_id AND user_id = _q.user_id
  ) THEN
    FOR i IN 1.._qty LOOP
      INSERT INTO public.installments (
        trip_id, user_id, installment_number, amount, status, payment_method, due_date
      ) VALUES (
        _q.trip_id,
        _q.user_id,
        i,
        _per_amount,
        'pendente',
        _q.payment_method,
        (_today + ((i - 1) || ' months')::interval)::date
      );
    END LOOP;
  END IF;

  UPDATE public.trip_queries SET status = 'confirmada', updated_at = now() WHERE id = _query_id;
END;
$function$;

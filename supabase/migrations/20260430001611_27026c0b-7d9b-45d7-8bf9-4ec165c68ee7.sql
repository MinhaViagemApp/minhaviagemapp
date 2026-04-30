
-- Re-sincronizar user_id baseado no client_id ↔ profile.email
UPDATE public.installments i
SET user_id = p.id
FROM public.clients c
JOIN public.profiles p ON lower(p.email) = lower(c.email)
WHERE i.client_id = c.id
  AND (i.user_id IS DISTINCT FROM p.id);

-- Criar parcelas faltantes para bookings sem installments
-- (1 parcela à vista usando total_value como fallback simples)
INSERT INTO public.installments (trip_id, client_id, user_id, installment_number, amount, status, payment_method, due_date)
SELECT 
  b.trip_id,
  b.client_id,
  p.id,
  1,
  b.total_value,
  'pendente',
  COALESCE(b.payment_method, 'pix'),
  CURRENT_DATE
FROM public.bookings b
LEFT JOIN public.clients c ON c.id = b.client_id
LEFT JOIN public.profiles p ON lower(p.email) = lower(c.email)
WHERE NOT EXISTS (
  SELECT 1 FROM public.installments i 
  WHERE i.trip_id = b.trip_id AND i.client_id = b.client_id
);

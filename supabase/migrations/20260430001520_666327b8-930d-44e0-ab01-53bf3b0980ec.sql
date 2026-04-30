
-- 1. Adicionar coluna client_id em installments
ALTER TABLE public.installments 
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_installments_client_id ON public.installments(client_id);

-- 2. Backfill: para cada parcela com user_id, encontra o client correspondente via email do profile
UPDATE public.installments i
SET client_id = c.id
FROM public.profiles p
JOIN public.clients c ON lower(c.email) = lower(p.email)
WHERE i.user_id = p.id
  AND i.client_id IS NULL;

-- 3. Backfill: para parcelas sem user_id mas com booking único na trip, vincula ao client_id da booking
-- (apenas onde existe exatamente 1 cliente com booking nessa trip)
UPDATE public.installments i
SET client_id = sub.client_id
FROM (
  SELECT trip_id, client_id
  FROM public.bookings
  GROUP BY trip_id, client_id
) sub
WHERE i.client_id IS NULL
  AND i.user_id IS NULL
  AND i.trip_id = sub.trip_id
  AND (SELECT COUNT(DISTINCT client_id) FROM public.bookings WHERE trip_id = i.trip_id) = 1;

-- 4. Policy: cliente pode SELECT suas parcelas via email ↔ clients.email
DROP POLICY IF EXISTS "Clients can view own installments via email" ON public.installments;
CREATE POLICY "Clients can view own installments via email"
  ON public.installments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = installments.client_id
        AND lower(c.email) = lower(public.get_auth_email())
    )
  );

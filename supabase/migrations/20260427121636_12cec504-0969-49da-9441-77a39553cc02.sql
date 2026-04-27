
-- 1. Coluna para link do comprovante
ALTER TABLE public.installments
  ADD COLUMN IF NOT EXISTS receipt_url text,
  ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamptz;

-- 2. Bucket de comprovantes (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Policies de Storage
DROP POLICY IF EXISTS "Clients upload own receipts" ON storage.objects;
CREATE POLICY "Clients upload own receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Clients view own receipts" ON storage.objects;
CREATE POLICY "Clients view own receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

DROP POLICY IF EXISTS "Clients update own receipts" ON storage.objects;
CREATE POLICY "Clients update own receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Permitir que clientes atualizem APENAS o receipt_url da sua própria parcela
DROP POLICY IF EXISTS "Clients can update own installment receipt" ON public.installments;
CREATE POLICY "Clients can update own installment receipt"
ON public.installments FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.clients c ON c.id = b.client_id
    WHERE b.trip_id = installments.trip_id
      AND c.email = public.get_auth_email()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.clients c ON c.id = b.client_id
    WHERE b.trip_id = installments.trip_id
      AND c.email = public.get_auth_email()
  )
);

-- 5. Permitir que clientes vejam suas parcelas via booking (não só via trips.user_id)
DROP POLICY IF EXISTS "Clients can view own installments via bookings" ON public.installments;
CREATE POLICY "Clients can view own installments via bookings"
ON public.installments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.clients c ON c.id = b.client_id
    WHERE b.trip_id = installments.trip_id
      AND c.email = public.get_auth_email()
  )
);

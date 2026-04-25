-- Etapa 2: juros boleto por viagem
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS boleto_fee_percent numeric NOT NULL DEFAULT 0;

-- Etapa 2: cupons de desconto por agência
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL,
  discount_percent numeric NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  expires_at date,
  cash_only boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage company coupons"
  ON public.coupons FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (company_id = public.get_user_company_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can read active coupons"
  ON public.coupons FOR SELECT TO authenticated
  USING (active = true);

CREATE TRIGGER trg_coupons_updated_at
  BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Etapa 2: registrar cupom usado na pré-reserva (opcional, snapshot)
ALTER TABLE public.trip_queries
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS discount_percent numeric NOT NULL DEFAULT 0;

-- Etapa 3: garantir que installments aceita os 3 status; e permitir admin alterar status manualmente.
-- (RLS de installments já permite admin gerenciar tudo.)
-- Função utilitária para admin atualizar status de uma parcela (mantém auditoria simples).
CREATE OR REPLACE FUNCTION public.set_installment_status(_installment_id uuid, _status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar status de parcelas.';
  END IF;
  IF _status NOT IN ('pendente','pago','atrasado','cancelado') THEN
    RAISE EXCEPTION 'Status inválido: %', _status;
  END IF;
  UPDATE public.installments SET status = _status WHERE id = _installment_id;
END;
$$;
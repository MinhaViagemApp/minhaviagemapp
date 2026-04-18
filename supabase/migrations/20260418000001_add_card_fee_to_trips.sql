-- Adicionar campo de taxa do cartão de crédito na tabela trips
ALTER TABLE public.trips 
  ADD COLUMN IF NOT EXISTS credit_card_fee_percent DECIMAL(5,2) DEFAULT 0;

-- Garantir que max_installments_card suporte até 24
-- (O campo já existe, só garantimos que está correto)
COMMENT ON COLUMN public.trips.credit_card_fee_percent IS 'Taxa percentual do cartão de crédito (ex: 2.5 = 2,5%)';
COMMENT ON COLUMN public.trips.max_installments_card IS 'Número máximo de vezes no cartão (até 24)';

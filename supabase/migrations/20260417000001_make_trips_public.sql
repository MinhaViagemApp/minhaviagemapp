-- 1. Adicionar colunas para viabilizar viagens públicas e controle de parcelas
ALTER TABLE public.trips 
    ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS max_installments_card INTEGER DEFAULT 12;

-- 2. Tornar o user_id opcional (para viagens que ainda não foram vendidas a ninguém)
ALTER TABLE public.trips ALTER COLUMN user_id DROP NOT NULL;

-- 3. Atualizar as políticas de RLS para a tabela trips
-- Garantir que qualquer usuário autenticado possa ver viagens marcadas como públicas
CREATE POLICY "Qualquer pessoa pode ver viagens públicas" 
ON public.trips FOR SELECT 
TO authenticated 
USING (is_public = true OR auth.uid() = user_id);

-- 4. Garantir que as imagens de viagens públicas também sejam visíveis
-- (Normalmente já existe uma política de SELECT para autenticados, mas vamos reforçar)
DROP POLICY IF EXISTS "Qualquer pessoa pode ver imagens de viagens" ON public.trip_images;
CREATE POLICY "Qualquer pessoa pode ver imagens de viagens"
ON public.trip_images FOR SELECT
TO authenticated
USING (true);

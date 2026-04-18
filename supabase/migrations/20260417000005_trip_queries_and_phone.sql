-- 1. Adicionar coluna de telefone na tabela de perfis
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profiles' AND COLUMN_NAME = 'phone') THEN
        ALTER TABLE public.profiles ADD COLUMN phone TEXT;
    END IF;
END $$;

-- 2. Criar tabela de consultas (Pré-reservas)
CREATE TABLE IF NOT EXISTS public.trip_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
    payment_method TEXT NOT NULL,
    installments INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Habilitar RLS
ALTER TABLE public.trip_queries ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de Segurança
DROP POLICY IF EXISTS "Usuários podem ver suas próprias consultas" ON public.trip_queries;
CREATE POLICY "Usuários podem ver suas próprias consultas" ON public.trip_queries 
FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuários podem criar suas consultas" ON public.trip_queries;
CREATE POLICY "Usuários podem criar suas consultas" ON public.trip_queries 
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins gerenciam todas as consultas" ON public.trip_queries;
CREATE POLICY "Admins gerenciam todas as consultas" ON public.trip_queries 
FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 5. Atualizar função de criação de perfil para incluir telefone se disponível
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, phone)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', ''), 
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

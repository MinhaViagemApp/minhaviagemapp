-- Tabela de Poltronas (Seats) para o sistema de mapa de ônibus
CREATE TABLE IF NOT EXISTS public.seats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seat_number TEXT NOT NULL,
    status TEXT DEFAULT 'free' CHECK (status IN ('free', 'reserved', 'occupied')),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reserved_at TIMESTAMP WITH TIME ZONE,
    trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(trip_id, seat_number)
);

-- Habilitar RLS
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Qualquer pessoa autenticada pode ver as poltronas" 
ON public.seats FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Admins podem gerenciar todas as poltronas" 
ON public.seats FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários podem reservar poltronas livres" 
ON public.seats FOR UPDATE 
TO authenticated 
USING (status = 'free')
WITH CHECK (status = 'reserved');

-- Função para popular poltronas iniciais de uma viagem (exemplo de 1 a 60)
-- Esta parte é opcional e pode ser disparada por um trigger ou manualmente
-- INSERT INTO public.seats (seat_number, trip_id)
-- SELECT lpad(s::text, 2, '0'), 'ID_DA_VIAGEM'
-- FROM generate_series(1, 60) s;

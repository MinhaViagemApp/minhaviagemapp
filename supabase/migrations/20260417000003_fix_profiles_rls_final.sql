-- Garantir que a tabela profiles tenha permissões abertas para leitura (SELECT) de usuários logados
-- Isso é fundamental para que o AuthContext e o Dashboard do cliente funcionem
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (true);

-- Garantir que o próprio usuário possa criar (INSERT) seu perfil se ele não existir
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- Garantir que o próprio usuário possa atualizar (UPDATE) seus dados básicos
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

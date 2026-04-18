-- Garantir que a política de administrador tenha o WITH CHECK para permitir inserções (INSERT)
DROP POLICY IF EXISTS "Admins can manage all trips" ON public.trips;
CREATE POLICY "Admins can manage all trips" 
ON public.trips FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reforçar a política de imagens de viagens para administradores
DROP POLICY IF EXISTS "Admins can manage trip images" ON public.trip_images;
CREATE POLICY "Admins can manage trip images"
ON public.trip_images FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

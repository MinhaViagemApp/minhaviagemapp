
CREATE POLICY "Admins can insert companies"
  ON public.companies FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Also allow authenticated users to insert into user_companies for self
CREATE POLICY "Users can insert own membership"
  ON public.user_companies FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

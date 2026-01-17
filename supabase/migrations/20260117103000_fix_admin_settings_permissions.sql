-- Ensure whitelisted admin users have the official admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email IN ('stanleyvic13@gmail.com', 'stanleyvic14@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Revise settings RLS to be more robust
DROP POLICY IF EXISTS "Admins can manage settings" ON public.settings;
CREATE POLICY "Admins can manage settings" ON public.settings
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    (SELECT email FROM auth.users WHERE id = auth.uid()) IN ('stanleyvic13@gmail.com', 'stanleyvic14@gmail.com')
  );

DROP POLICY IF EXISTS "Anyone can read settings" ON public.settings;
CREATE POLICY "Anyone can read settings" ON public.settings
  FOR SELECT USING (true);

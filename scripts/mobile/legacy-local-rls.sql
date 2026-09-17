-- Local-only reconstruction: initial profiles admin policy recursively selects
-- profiles; its deployed replacement is absent from the repository migrations.
-- Exact policy/function metadata verified read-only on 2026-09-12, no user rows read.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid()) AND is_admin = true);
$$;
DROP POLICY profiles_select_own ON public.profiles;
DROP POLICY profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT
  USING (((SELECT auth.uid()) = id) OR public.is_admin());

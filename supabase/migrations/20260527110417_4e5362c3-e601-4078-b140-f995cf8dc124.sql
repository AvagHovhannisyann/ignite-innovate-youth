CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM public, anon, authenticated;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;

ALTER POLICY "Admins view all roles" ON public.user_roles
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins view all profiles" ON public.profiles
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins read recs" ON public.recommendations
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins view all projects" ON public.started_projects
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins manage opportunities" ON public.opportunities
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins view all participations" ON public.participations
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

ALTER POLICY "Admins view all achievements" ON public.achievements
USING (app_private.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;

-- 1. New columns on started_projects
ALTER TABLE public.started_projects
  ADD COLUMN IF NOT EXISTS difficulty_tier text NOT NULL DEFAULT 'easy' CHECK (difficulty_tier IN ('easy','medium','hard')),
  ADD COLUMN IF NOT EXISTS xp_cost int NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS xp_reward_standard int NOT NULL DEFAULT 400,
  ADD COLUMN IF NOT EXISTS xp_reward_exceptional int NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS quality text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS admin_rating int CHECK (admin_rating IS NULL OR (admin_rating BETWEEN 1 AND 5)),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- 2. participants
CREATE TABLE IF NOT EXISTS public.project_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.started_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_participants TO authenticated;
GRANT ALL ON public.project_participants TO service_role;
ALTER TABLE public.project_participants ENABLE ROW LEVEL SECURITY;

-- 3. messages
CREATE TABLE IF NOT EXISTS public.project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.started_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  media_urls text[] NOT NULL DEFAULT '{}',
  media_types text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_messages TO authenticated;
GRANT ALL ON public.project_messages TO service_role;
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;

-- 4. Helper: is_project_member (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.is_project_member(_uid uuid, _pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_participants WHERE project_id = _pid AND user_id = _uid
  ) OR EXISTS (
    SELECT 1 FROM public.started_projects WHERE id = _pid AND user_id = _uid
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated, anon;

-- 5. Migrate existing owners as participants
INSERT INTO public.project_participants (project_id, user_id, role)
SELECT id, user_id, 'owner' FROM public.started_projects
ON CONFLICT (project_id, user_id) DO NOTHING;

-- 6. Policies
DROP POLICY IF EXISTS "participants_select" ON public.project_participants;
CREATE POLICY "participants_select" ON public.project_participants FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_project_member(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "participants_insert" ON public.project_participants;
CREATE POLICY "participants_insert" ON public.project_participants FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "participants_delete" ON public.project_participants;
CREATE POLICY "participants_delete" ON public.project_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "messages_select" ON public.project_messages;
CREATE POLICY "messages_select" ON public.project_messages FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "messages_insert" ON public.project_messages;
CREATE POLICY "messages_insert" ON public.project_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (public.is_project_member(auth.uid(), project_id) OR public.has_role(auth.uid(), 'admin')));
DROP POLICY IF EXISTS "messages_delete" ON public.project_messages;
CREATE POLICY "messages_delete" ON public.project_messages FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 7. Expand started_projects SELECT to participants
DROP POLICY IF EXISTS "Users view own projects" ON public.started_projects;
CREATE POLICY "Members view projects" ON public.started_projects FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_project_member(auth.uid(), id) OR public.has_role(auth.uid(), 'admin'));

-- 8. Storage policies for project-media bucket (bucket created via tool)
DROP POLICY IF EXISTS "project_media_select" ON storage.objects;
CREATE POLICY "project_media_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'project-media'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR public.is_project_member(auth.uid(), (split_part(name, '/', 1))::uuid)
    )
  );
DROP POLICY IF EXISTS "project_media_insert" ON storage.objects;
CREATE POLICY "project_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-media'
    AND public.is_project_member(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

-- 9. RPCs
CREATE OR REPLACE FUNCTION public.tier_cost(_tier text) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _tier WHEN 'easy' THEN 200 WHEN 'medium' THEN 400 WHEN 'hard' THEN 700 ELSE 200 END
$$;
CREATE OR REPLACE FUNCTION public.tier_reward(_tier text, _exceptional boolean) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE _tier
    WHEN 'easy' THEN CASE WHEN _exceptional THEN 500 ELSE 400 END
    WHEN 'medium' THEN CASE WHEN _exceptional THEN 1000 ELSE 800 END
    WHEN 'hard' THEN CASE WHEN _exceptional THEN 2000 ELSE 1500 END
    ELSE 400 END
$$;

CREATE OR REPLACE FUNCTION public.count_active_projects(_uid uuid) RETURNS int
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int FROM public.started_projects sp
   JOIN public.project_participants pp ON pp.project_id = sp.id
   WHERE pp.user_id = _uid AND sp.status IN ('active','submitted')
$$;
GRANT EXECUTE ON FUNCTION public.count_active_projects(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_project(
  _title text, _short_description text, _full_description text,
  _matching_interests text[], _team_size text, _first_steps jsonb,
  _difficulty_tier text
) RETURNS public.started_projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _cost int;
  _xp int;
  _row public.started_projects;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _difficulty_tier NOT IN ('easy','medium','hard') THEN RAISE EXCEPTION 'invalid tier'; END IF;
  IF public.count_active_projects(_uid) >= 2 THEN
    RAISE EXCEPTION 'active project limit reached (max 2)';
  END IF;
  _cost := public.tier_cost(_difficulty_tier);
  SELECT COALESCE(xp,0) INTO _xp FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _xp < _cost THEN RAISE EXCEPTION 'not enough XP (need %)', _cost; END IF;

  UPDATE public.profiles SET xp = _xp - _cost WHERE id = _uid;

  INSERT INTO public.started_projects (
    user_id, title, short_description, full_description, matching_interests,
    difficulty, team_size, first_steps, status, difficulty_tier,
    xp_cost, xp_reward_standard, xp_reward_exceptional
  ) VALUES (
    _uid, _title, _short_description, _full_description, COALESCE(_matching_interests,'{}'),
    _difficulty_tier, _team_size, COALESCE(_first_steps,'[]'::jsonb), 'active', _difficulty_tier,
    _cost, public.tier_reward(_difficulty_tier, false), public.tier_reward(_difficulty_tier, true)
  ) RETURNING * INTO _row;

  INSERT INTO public.project_participants (project_id, user_id, role)
    VALUES (_row.id, _uid, 'owner');

  INSERT INTO public.notifications (user_id, title, body, kind)
    VALUES (_uid, 'Նախագիծը մեկնարկեց 🚀', format('«%s» — %s XP պահեստավորված', _row.title, _cost), 'success');

  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.start_project(text,text,text,text[],text,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_project(_project_id uuid) RETURNS public.project_participants
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _proj public.started_projects;
  _xp int;
  _row public.project_participants;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _proj FROM public.started_projects WHERE id = _project_id;
  IF _proj.id IS NULL THEN RAISE EXCEPTION 'project not found'; END IF;
  IF _proj.status <> 'active' THEN RAISE EXCEPTION 'project not joinable'; END IF;
  IF public.count_active_projects(_uid) >= 2 THEN
    RAISE EXCEPTION 'active project limit reached (max 2)';
  END IF;
  SELECT COALESCE(xp,0) INTO _xp FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _xp < _proj.xp_cost THEN RAISE EXCEPTION 'not enough XP (need %)', _proj.xp_cost; END IF;
  UPDATE public.profiles SET xp = _xp - _proj.xp_cost WHERE id = _uid;
  INSERT INTO public.project_participants (project_id, user_id, role)
    VALUES (_project_id, _uid, 'member')
    ON CONFLICT (project_id, user_id) DO NOTHING
    RETURNING * INTO _row;
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.join_project(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_project(_project_id uuid) RETURNS public.started_projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.started_projects;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.is_project_member(_uid, _project_id) THEN RAISE EXCEPTION 'not a member'; END IF;
  UPDATE public.started_projects
     SET status = 'submitted', submitted_at = now()
   WHERE id = _project_id AND status = 'active'
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'project cannot be submitted in current state'; END IF;
  INSERT INTO public.notifications (user_id, title, body, kind)
    SELECT pp.user_id, 'Նախագիծը ուղարկվեց ստուգման', format('«%s» սպասում է ադմինի վերանայմանը։', _row.title), 'info'
    FROM public.project_participants pp WHERE pp.project_id = _project_id;
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.submit_project(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_project(
  _project_id uuid, _approve boolean, _exceptional boolean DEFAULT false,
  _rating int DEFAULT NULL, _reason text DEFAULT NULL
) RETURNS public.started_projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.started_projects;
  _award int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'admin required'; END IF;
  SELECT * INTO _row FROM public.started_projects WHERE id = _project_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _row.status NOT IN ('submitted','active') THEN RAISE EXCEPTION 'cannot review in % state', _row.status; END IF;

  IF _approve THEN
    _award := CASE WHEN _exceptional THEN _row.xp_reward_exceptional ELSE _row.xp_reward_standard END;
    UPDATE public.started_projects
       SET status='approved', approved_at=now(), reviewed_at=now(), reviewed_by=_uid,
           quality = CASE WHEN _exceptional THEN 'exceptional' ELSE 'standard' END,
           admin_rating = _rating, progress = 100
     WHERE id = _project_id RETURNING * INTO _row;

    UPDATE public.profiles p
       SET xp = COALESCE(xp,0) + _award
      FROM public.project_participants pp
     WHERE pp.project_id = _project_id AND pp.user_id = p.id;

    INSERT INTO public.notifications (user_id, title, body, kind)
      SELECT pp.user_id,
             CASE WHEN _exceptional THEN 'Բացառիկ կատարում 🌟' ELSE 'Նախագիծը հաստատվեց ✅' END,
             format('«%s» — +%s XP', _row.title, _award), 'success'
        FROM public.project_participants pp WHERE pp.project_id = _project_id;
  ELSE
    UPDATE public.started_projects
       SET status='rejected', reviewed_at=now(), reviewed_by=_uid, rejection_reason=_reason
     WHERE id = _project_id RETURNING * INTO _row;
    INSERT INTO public.notifications (user_id, title, body, kind)
      SELECT pp.user_id, 'Նախագիծը մերժվեց', COALESCE(_reason,'Պատճառ նշված չէ։'), 'warning'
        FROM public.project_participants pp WHERE pp.project_id = _project_id;
  END IF;

  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.review_project(uuid,boolean,boolean,int,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_project(_project_id uuid) RETURNS public.started_projects
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.started_projects;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _row FROM public.started_projects WHERE id = _project_id;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _row.user_id <> _uid AND NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _row.status NOT IN ('active','submitted') THEN RAISE EXCEPTION 'cannot cancel'; END IF;
  UPDATE public.started_projects SET status='cancelled', cancelled_at=now() WHERE id=_project_id RETURNING * INTO _row;
  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.cancel_project(uuid) TO authenticated;

-- 10. Rank computation
CREATE OR REPLACE FUNCTION public.get_user_rank(_uid uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _completed int;
  _exceptional int;
  _submitted int;
  _avg_rating numeric;
  _activity int;
  _badges int;
  _reliability numeric;
  _score numeric;
  _tier text;
BEGIN
  SELECT COUNT(*) FILTER (WHERE sp.status='approved'),
         COUNT(*) FILTER (WHERE sp.status='approved' AND sp.quality='exceptional'),
         COUNT(*) FILTER (WHERE sp.status IN ('approved','rejected','submitted')),
         AVG(sp.admin_rating) FILTER (WHERE sp.admin_rating IS NOT NULL)
    INTO _completed, _exceptional, _submitted, _avg_rating
    FROM public.started_projects sp
    JOIN public.project_participants pp ON pp.project_id = sp.id
   WHERE pp.user_id = _uid;

  SELECT COUNT(*) INTO _badges FROM public.achievements WHERE user_id = _uid;

  SELECT
    COALESCE((SELECT COUNT(*) FROM public.participations WHERE user_id = _uid AND joined_at > now() - interval '30 days'),0) +
    COALESCE((SELECT COUNT(*) FROM public.posts WHERE author_id = _uid AND created_at > now() - interval '30 days'),0) +
    COALESCE((SELECT COUNT(*) FROM public.post_comments WHERE user_id = _uid AND created_at > now() - interval '30 days'),0)
    INTO _activity;

  _reliability := CASE WHEN _submitted > 0 THEN _completed::numeric / _submitted ELSE 0 END;

  _score :=
      (_completed * 30)
    + (_exceptional * 20)
    + (COALESCE(_avg_rating,0) * 15)
    + (LEAST(_activity, 30) * 0.5)
    + (_reliability * 100 * 0.10)
    + (_badges * 10);

  _tier := CASE
    WHEN _score >= 1500 THEN 'Diamond'
    WHEN _score >= 900 THEN 'Platinum'
    WHEN _score >= 500 THEN 'Gold'
    WHEN _score >= 200 THEN 'Silver'
    WHEN _score >= 50 THEN 'Bronze'
    ELSE 'Unranked' END;

  RETURN jsonb_build_object(
    'score', ROUND(_score)::int,
    'tier', _tier,
    'completed', _completed,
    'exceptional', _exceptional,
    'avg_rating', COALESCE(ROUND(_avg_rating,2),0),
    'activity', _activity,
    'reliability', ROUND(_reliability,2),
    'badges', _badges
  );
END $$;
GRANT EXECUTE ON FUNCTION public.get_user_rank(uuid) TO authenticated;

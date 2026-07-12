-- Security and data-integrity hardening.
--
-- The browser is an untrusted client.  Profile XP, quest state, awards,
-- moderation state, project state, participation rewards, support identity,
-- and OAuth secrets therefore cross the database boundary only through
-- narrowly-scoped SECURITY DEFINER functions.

-- -------------------------------------------------------------------------
-- Safe role lookup
-- -------------------------------------------------------------------------
-- Several later migrations use public.has_role from RLS policies.  Keep that
-- API available for policies and the current user's UI, but do not let callers
-- enumerate the roles of arbitrary user ids.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id = auth.uid()
      THEN app_private.has_role(_user_id, _role)
    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- -------------------------------------------------------------------------
-- Profiles: students may edit biography fields, never XP/level/tokens/email.
-- -------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (
  full_name, age, phone, school, bio, interests, skills, learning_areas,
  goal, preferred_project_type, availability, onboarded
) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.touch_profile_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Onboarding completion is monotonic; a client cannot toggle it back and
  -- repeatedly trigger welcome side effects.
  NEW.onboarded := OLD.onboarded OR NEW.onboarded;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_profile_updated_at();

-- Recovery path for accounts created while the auth trigger was unavailable.
-- Identity fields come from auth.users, never from caller-supplied JSON.
CREATE OR REPLACE FUNCTION public.ensure_my_profile()
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _uid uuid := auth.uid();
  _auth_user auth.users;
  _row public.profiles;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT * INTO _auth_user FROM auth.users WHERE id = _uid;
  IF _auth_user.id IS NULL THEN RAISE EXCEPTION 'auth user not found'; END IF;

  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    _uid,
    COALESCE(_auth_user.raw_user_meta_data->>'full_name', _auth_user.raw_user_meta_data->>'name', ''),
    _auth_user.email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    email = COALESCE(public.profiles.email, EXCLUDED.email)
  RETURNING * INTO _row;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN _row;
END
$$;

REVOKE ALL ON FUNCTION public.ensure_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_my_profile() TO authenticated;

-- The opportunities page is intentionally part of the public site.  Joining
-- remains authenticated and RPC-only, but anonymous visitors must be able to
-- inspect the catalog before deciding to create an account.
DROP POLICY IF EXISTS "Anyone authed can view opportunities" ON public.opportunities;
DROP POLICY IF EXISTS "Anyone can view opportunities" ON public.opportunities;
CREATE POLICY "Anyone can view opportunities" ON public.opportunities
  FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.opportunities TO anon, authenticated;

-- Cross-user UI (feed authors, project members and chat participants) needs a
-- deliberately small public profile surface.  Never grant broad profile reads:
-- email, phone, age, school and other biography fields remain private.
CREATE OR REPLACE FUNCTION public.get_member_directory(_user_ids uuid[])
RETURNS TABLE (id uuid, full_name text, xp int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF cardinality(COALESCE(_user_ids, '{}'::uuid[])) > 100 THEN
    RAISE EXCEPTION 'too many users requested';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.xp
    FROM public.profiles p
   WHERE p.id = ANY(COALESCE(_user_ids, '{}'::uuid[]))
     AND (p.onboarded OR p.id = auth.uid());
END
$$;

REVOKE ALL ON FUNCTION public.get_member_directory(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_member_directory(uuid[]) TO authenticated;

-- -------------------------------------------------------------------------
-- Direct grants that bypassed trusted state transitions
-- -------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.achievements FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_quests FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_quest_rerolls FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.reward_claims FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.quest_submissions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.started_projects FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.project_participants FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.participations FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.recommendations FROM anon, authenticated;

GRANT SELECT ON public.achievements, public.user_quests,
  public.user_quest_rerolls, public.reward_claims, public.quest_submissions,
  public.started_projects, public.project_participants, public.participations,
  public.recommendations TO authenticated;

DROP POLICY IF EXISTS "Users insert own achievements" ON public.achievements;
DROP POLICY IF EXISTS "Users insert own quest state" ON public.user_quests;
DROP POLICY IF EXISTS "Users update own quest state" ON public.user_quests;
DROP POLICY IF EXISTS "Users manage own rerolls" ON public.user_quest_rerolls;
CREATE POLICY "Users read own rerolls" ON public.user_quest_rerolls
  FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Users insert own claims" ON public.reward_claims;
DROP POLICY IF EXISTS "own submissions insert" ON public.quest_submissions;
DROP POLICY IF EXISTS "admin update submissions" ON public.quest_submissions;
DROP POLICY IF EXISTS "Users create own projects" ON public.started_projects;
DROP POLICY IF EXISTS "Users update own projects" ON public.started_projects;
DROP POLICY IF EXISTS "participants_insert" ON public.project_participants;
DROP POLICY IF EXISTS "participants_delete" ON public.project_participants;
DROP POLICY IF EXISTS "Users join opportunities" ON public.participations;
DROP POLICY IF EXISTS "Users upsert own recs" ON public.recommendations;
DROP POLICY IF EXISTS "Users update own recs" ON public.recommendations;

-- Notifications are server-authored.  A student may only mark their own rows
-- read/unread; they cannot rewrite a notification into a fake award.
REVOKE INSERT, UPDATE ON public.notifications FROM anon, authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;

CREATE OR REPLACE FUNCTION public.notify_onboarding_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.onboarded AND NOT OLD.onboarded THEN
    INSERT INTO public.notifications (user_id, title, body, kind)
    VALUES (
      NEW.id,
      'Բարի գալուստ Էջմիածնի Երիտասարդական Տուն 🎉',
      'Մուտքն ավարտված է։ Քո անհատականացված առաջարկները պատրաստվում են։',
      'info'
    );
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS profiles_notify_onboarding_complete ON public.profiles;
CREATE TRIGGER profiles_notify_onboarding_complete
  AFTER UPDATE OF onboarded ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_onboarding_complete();

-- -------------------------------------------------------------------------
-- Atomic opportunity join + one-time reward
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_opportunity(_opportunity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _participation public.participations;
  _new_xp int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.opportunities WHERE id = _opportunity_id) THEN
    RAISE EXCEPTION 'opportunity not found';
  END IF;

  INSERT INTO public.participations (user_id, opportunity_id)
  VALUES (_uid, _opportunity_id)
  ON CONFLICT (user_id, opportunity_id) DO NOTHING
  RETURNING * INTO _participation;

  IF _participation.id IS NULL THEN
    SELECT * INTO _participation
      FROM public.participations
      WHERE user_id = _uid AND opportunity_id = _opportunity_id;
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'xp_awarded', 0,
      'participation', to_jsonb(_participation)
    );
  END IF;

  UPDATE public.profiles
     SET xp = xp + 25
   WHERE id = _uid
   RETURNING xp INTO _new_xp;
  IF _new_xp IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;

  INSERT INTO public.achievements (user_id, badge)
  VALUES (_uid, 'Առաջին մասնակցություն')
  ON CONFLICT (user_id, badge) DO NOTHING;

  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (_uid, 'Միացար հնարավորությանը', '+25 XP ստացար։', 'success');

  RETURN jsonb_build_object(
    'ok', true,
    'already', false,
    'xp_awarded', 25,
    'total_xp', _new_xp,
    'participation', to_jsonb(_participation)
  );
END
$$;

REVOKE ALL ON FUNCTION public.join_opportunity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_opportunity(uuid) TO authenticated;

-- -------------------------------------------------------------------------
-- Quest state: progress is derived from trusted tables, never a client delta.
-- Armenia's calendar day is explicit so daily state resets at local midnight.
-- -------------------------------------------------------------------------
UPDATE public.quest_templates
   SET requires_evidence = false, evidence_prompt = NULL
 WHERE id IN ('a-join', 'a-project', 'a-ai', 'a-profile', 'd-explore-3', 'd-ai-ideas');

UPDATE public.quest_templates
   SET requires_evidence = true,
       evidence_prompt = COALESCE(
         evidence_prompt,
         CASE id
           WHEN 'd-share' THEN 'Նկարագրիր՝ ում ես պատմել հարթակի մասին և ինչ արձագանք ես ստացել։'
           WHEN 'd-lesson' THEN 'Նշիր դիտած մաստեր-դասը և մեկ միտք, որ սովորեցիր։'
           WHEN 'd-streak' THEN 'Նկարագրիր վերջին երկու օրերի քո գործունեությունը հարթակում։'
           WHEN 'd-event' THEN 'Նշիր ընտրած միջոցառումը և ինչու է այն քեզ հետաքրքրում։'
           ELSE 'Նկարագրիր կատարված աշխատանքը և կցիր ապացույց, եթե ունես։'
         END
       )
 WHERE id IN ('d-share', 'd-lesson', 'd-streak', 'd-event');

REVOKE ALL ON FUNCTION public.increment_quest_progress(text, text, int)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_quest_progress(_template_id text)
RETURNS public.user_quests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _target int;
  _progress int;
  _row public.user_quests;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT target INTO _target
    FROM public.quest_templates
   WHERE id = _template_id AND active = true AND kind = 'activity';
  IF _target IS NULL THEN RAISE EXCEPTION 'unknown automatic activity quest'; END IF;

  _progress := CASE _template_id
    WHEN 'a-join' THEN (
      SELECT count(*)::int FROM public.participations WHERE user_id = _uid
    )
    WHEN 'a-project' THEN (
      SELECT count(*)::int FROM public.started_projects WHERE user_id = _uid
    )
    WHEN 'a-ai' THEN (
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM public.recommendations
         WHERE user_id = _uid AND source = 'ai'
      ) THEN 1 ELSE 0 END
    )
    WHEN 'a-profile' THEN (
      SELECT
        (CASE WHEN nullif(btrim(full_name), '') IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN cardinality(interests) >= 3 THEN 1 ELSE 0 END) +
        (CASE WHEN cardinality(skills) >= 1 THEN 1 ELSE 0 END) +
        (CASE WHEN nullif(btrim(goal), '') IS NOT NULL THEN 1 ELSE 0 END)
      FROM public.profiles WHERE id = _uid
    )
    ELSE NULL
  END;

  IF _progress IS NULL THEN RAISE EXCEPTION 'quest has no trusted progress source'; END IF;

  INSERT INTO public.user_quests (user_id, template_id, period_key, progress)
  VALUES (_uid, _template_id, 'permanent', LEAST(_progress, _target))
  ON CONFLICT (user_id, template_id, period_key)
  DO UPDATE SET
    progress = GREATEST(public.user_quests.progress, LEAST(EXCLUDED.progress, _target)),
    updated_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END
$$;

REVOKE ALL ON FUNCTION public.sync_quest_progress(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_quest_progress(text) TO authenticated;

-- Daily quest progress is event-derived.  The browser may report a concrete
-- opportunity becoming visible, but it cannot send an arbitrary progress
-- delta. AI refreshes are recorded only by the service-role edge function.
CREATE TABLE IF NOT EXISTS public.quest_activity_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_kind text NOT NULL CHECK (event_kind IN ('opportunity_view', 'ai_refresh')),
  reference_id text NOT NULL,
  period_day date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_kind, reference_id, period_day)
);
ALTER TABLE public.quest_activity_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quest_activity_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.quest_activity_events TO service_role;

CREATE OR REPLACE FUNCTION public.record_opportunity_view(_opportunity_id uuid)
RETURNS public.user_quests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _day date := timezone('Asia/Yerevan', now())::date;
  _target int;
  _progress int;
  _row public.user_quests;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.opportunities WHERE id = _opportunity_id) THEN
    RAISE EXCEPTION 'opportunity not found';
  END IF;

  INSERT INTO public.quest_activity_events
    (user_id, event_kind, reference_id, period_day)
  VALUES (_uid, 'opportunity_view', _opportunity_id::text, _day)
  ON CONFLICT (user_id, event_kind, reference_id, period_day) DO NOTHING;

  SELECT target INTO _target FROM public.quest_templates
   WHERE id = 'd-explore-3' AND active = true AND kind = 'daily';
  IF _target IS NULL THEN RAISE EXCEPTION 'daily quest is unavailable'; END IF;
  SELECT count(*)::int INTO _progress FROM public.quest_activity_events
   WHERE user_id = _uid AND event_kind = 'opportunity_view' AND period_day = _day;

  INSERT INTO public.user_quests (user_id, template_id, period_key, progress)
  VALUES (_uid, 'd-explore-3', _day::text, LEAST(_progress, _target))
  ON CONFLICT (user_id, template_id, period_key)
  DO UPDATE SET
    progress = GREATEST(public.user_quests.progress, EXCLUDED.progress),
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END
$$;

REVOKE ALL ON FUNCTION public.record_opportunity_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_opportunity_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_ai_refresh(_user_id uuid, _request_id text)
RETURNS public.user_quests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _day date := timezone('Asia/Yerevan', now())::date;
  _target int;
  _row public.user_quests;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF _user_id IS NULL OR length(COALESCE(_request_id, '')) NOT BETWEEN 1 AND 128 THEN
    RAISE EXCEPTION 'invalid event';
  END IF;

  INSERT INTO public.quest_activity_events
    (user_id, event_kind, reference_id, period_day)
  VALUES (_user_id, 'ai_refresh', _request_id, _day)
  ON CONFLICT (user_id, event_kind, reference_id, period_day) DO NOTHING;

  SELECT target INTO _target FROM public.quest_templates
   WHERE id = 'd-ai-ideas' AND active = true AND kind = 'daily';
  IF _target IS NULL THEN RAISE EXCEPTION 'daily quest is unavailable'; END IF;

  INSERT INTO public.user_quests (user_id, template_id, period_key, progress)
  VALUES (_user_id, 'd-ai-ideas', _day::text, LEAST(1, _target))
  ON CONFLICT (user_id, template_id, period_key)
  DO UPDATE SET
    progress = GREATEST(public.user_quests.progress, EXCLUDED.progress),
    updated_at = now()
  RETURNING * INTO _row;
  RETURN _row;
END
$$;

REVOKE ALL ON FUNCTION public.record_ai_refresh(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_refresh(uuid, text) TO service_role;

-- Keep evidence uploads bounded and let students clean up failed submissions
-- inside their own storage prefix.
UPDATE storage.buckets
   SET file_size_limit = 10485760,
       allowed_mime_types = ARRAY[
         'image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'
       ]::text[]
 WHERE id = 'quest-evidence';

DROP POLICY IF EXISTS "quest evidence: delete own" ON storage.objects;
CREATE POLICY "quest evidence: delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'quest-evidence'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

UPDATE storage.buckets
   SET file_size_limit = 26214400,
       allowed_mime_types = ARRAY[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'video/mp4', 'video/webm', 'video/quicktime'
       ]::text[]
 WHERE id = 'post-media';

UPDATE storage.buckets
   SET file_size_limit = 26214400,
       allowed_mime_types = ARRAY[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'video/mp4', 'video/webm', 'video/quicktime',
         'application/pdf', 'text/plain'
       ]::text[]
 WHERE id = 'project-media';

-- Pending/rejected post uploads are private to their owner and admins. Media
-- becomes community-readable only after the referenced post is approved.
DROP POLICY IF EXISTS "Authenticated can read post media" ON storage.objects;
DROP POLICY IF EXISTS "post media: authorized read" ON storage.objects;
CREATE POLICY "post media: authorized read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.posts post
         WHERE post.status = 'approved' AND name = ANY(post.media_urls)
      )
    )
  );

-- New project uploads include {project_id}/{user_id}/... so a member cannot
-- overwrite or delete another member's files.
DROP POLICY IF EXISTS "project_media_insert" ON storage.objects;
CREATE POLICY "project_media_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'project-media'
    AND public.is_project_member(auth.uid(), (storage.foldername(name))[1]::uuid)
    AND auth.uid()::text = (storage.foldername(name))[2]
  );
DROP POLICY IF EXISTS "project_media_delete_own" ON storage.objects;
CREATE POLICY "project_media_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'project-media'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

-- Defensive size/shape constraints also protect direct PostgREST callers.
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_content_bounds;
ALTER TABLE public.posts ADD CONSTRAINT posts_content_bounds CHECK (
  length(content) <= 4000
  AND length(COALESCE(title, '')) <= 120
  AND length(COALESCE(location, '')) <= 200
  AND cardinality(media_urls) <= 8
  AND cardinality(media_urls) = cardinality(media_types)
  AND cardinality(tags) <= 10
) NOT VALID;

ALTER TABLE public.post_comments DROP CONSTRAINT IF EXISTS post_comments_content_bounds;
ALTER TABLE public.post_comments ADD CONSTRAINT post_comments_content_bounds CHECK (
  length(btrim(content)) BETWEEN 1 AND 1000
) NOT VALID;

ALTER TABLE public.support_threads DROP CONSTRAINT IF EXISTS support_threads_subject_bounds;
ALTER TABLE public.support_threads ADD CONSTRAINT support_threads_subject_bounds CHECK (
  length(btrim(subject)) BETWEEN 1 AND 140
) NOT VALID;

ALTER TABLE public.schedule_events DROP CONSTRAINT IF EXISTS schedule_events_valid_times;
ALTER TABLE public.schedule_events ADD CONSTRAINT schedule_events_valid_times CHECK (
  length(btrim(title)) BETWEEN 1 AND 200
  AND length(COALESCE(description, '')) <= 4000
  AND ends_at > starts_at
) NOT VALID;

DROP POLICY IF EXISTS "own schedule" ON public.schedule_events;
DROP POLICY IF EXISTS "schedule select own" ON public.schedule_events;
DROP POLICY IF EXISTS "schedule insert own editable" ON public.schedule_events;
DROP POLICY IF EXISTS "schedule update own editable" ON public.schedule_events;
DROP POLICY IF EXISTS "schedule delete own editable" ON public.schedule_events;
CREATE POLICY "schedule select own" ON public.schedule_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "schedule insert own editable" ON public.schedule_events
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND source IN ('manual', 'ai')
  );
CREATE POLICY "schedule update own editable" ON public.schedule_events
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND source IN ('manual', 'ai'))
  WITH CHECK (user_id = auth.uid() AND source IN ('manual', 'ai'));
CREATE POLICY "schedule delete own editable" ON public.schedule_events
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND source IN ('manual', 'ai'));

CREATE OR REPLACE FUNCTION public.validate_project_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  NEW.user_id := _uid;
  NEW.content := btrim(COALESCE(NEW.content, ''));
  IF length(NEW.content) > 4000
     OR cardinality(COALESCE(NEW.media_urls, '{}')) > 8
     OR cardinality(COALESCE(NEW.media_urls, '{}')) <> cardinality(COALESCE(NEW.media_types, '{}'))
     OR (NEW.content = '' AND cardinality(COALESCE(NEW.media_urls, '{}')) = 0) THEN
    RAISE EXCEPTION 'invalid project message';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(NEW.media_urls, '{}'::text[])) submitted(path)
     WHERE split_part(submitted.path, '/', 1) <> NEW.project_id::text
        OR split_part(submitted.path, '/', 2) <> _uid::text
        OR NOT EXISTS (
          SELECT 1 FROM storage.objects object
           WHERE object.bucket_id = 'project-media' AND object.name = submitted.path
        )
  ) THEN
    RAISE EXCEPTION 'invalid project media';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS project_messages_validate_insert ON public.project_messages;
CREATE TRIGGER project_messages_validate_insert
  BEFORE INSERT ON public.project_messages
  FOR EACH ROW EXECUTE FUNCTION public.validate_project_message();

CREATE OR REPLACE FUNCTION public.claim_quest(_template_id text, _period text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tpl public.quest_templates;
  _row public.user_quests;
  _expected_period text;
  _new_xp int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _tpl FROM public.quest_templates WHERE id = _template_id AND active = true;
  IF _tpl.id IS NULL THEN RAISE EXCEPTION 'unknown template'; END IF;
  IF _tpl.requires_evidence THEN RAISE EXCEPTION 'this quest requires evidence submission'; END IF;

  _expected_period := CASE
    WHEN _tpl.kind = 'activity' THEN 'permanent'
    ELSE (timezone('Asia/Yerevan', now())::date)::text
  END;
  IF _period IS DISTINCT FROM _expected_period THEN RAISE EXCEPTION 'invalid quest period'; END IF;

  SELECT * INTO _row FROM public.user_quests
   WHERE user_id = _uid AND template_id = _template_id AND period_key = _expected_period
   FOR UPDATE;
  IF _row.id IS NULL OR _row.progress < _tpl.target THEN RAISE EXCEPTION 'quest not complete'; END IF;
  IF _row.awarded THEN RETURN jsonb_build_object('already', true, 'xp', 0); END IF;

  UPDATE public.user_quests
     SET awarded = true, awarded_at = now(), updated_at = now()
   WHERE id = _row.id;
  UPDATE public.profiles SET xp = xp + _tpl.xp WHERE id = _uid
    RETURNING xp INTO _new_xp;

  RETURN jsonb_build_object('already', false, 'xp', _tpl.xp, 'total_xp', _new_xp);
END
$$;

REVOKE ALL ON FUNCTION public.claim_quest(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_quest(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_quest(
  _template_id text, _period text, _content text, _media text[]
)
RETURNS public.quest_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _tpl public.quest_templates;
  _row public.quest_submissions;
  _expected_period text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _tpl FROM public.quest_templates WHERE id = _template_id AND active = true;
  IF _tpl.id IS NULL THEN RAISE EXCEPTION 'unknown quest'; END IF;
  IF NOT _tpl.requires_evidence THEN RAISE EXCEPTION 'quest does not accept evidence'; END IF;

  _expected_period := CASE
    WHEN _tpl.kind = 'activity' THEN 'permanent'
    ELSE (timezone('Asia/Yerevan', now())::date)::text
  END;
  IF _period IS DISTINCT FROM _expected_period THEN RAISE EXCEPTION 'invalid quest period'; END IF;
  IF length(btrim(COALESCE(_content, ''))) < 5 AND cardinality(COALESCE(_media, '{}')) = 0 THEN
    RAISE EXCEPTION 'evidence is required';
  END IF;
  IF length(COALESCE(_content, '')) > 4000 OR cardinality(COALESCE(_media, '{}')) > 8 THEN
    RAISE EXCEPTION 'evidence is too large';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM unnest(COALESCE(_media, '{}'::text[])) AS submitted(path)
     WHERE split_part(submitted.path, '/', 1) <> _uid::text
        OR NOT EXISTS (
          SELECT 1 FROM storage.objects object
           WHERE object.bucket_id = 'quest-evidence'
             AND object.name = submitted.path
        )
  ) THEN
    RAISE EXCEPTION 'invalid evidence file';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quest_submissions
     WHERE user_id = _uid AND template_id = _template_id
       AND period_key = _expected_period AND status IN ('pending', 'approved')
  ) THEN RAISE EXCEPTION 'already submitted'; END IF;

  INSERT INTO public.quest_submissions (user_id, template_id, period_key, content, media_urls)
  VALUES (_uid, _template_id, _expected_period, btrim(COALESCE(_content, '')), COALESCE(_media, '{}'))
  RETURNING * INTO _row;

  INSERT INTO public.notifications (user_id, title, body, kind)
  SELECT user_id, 'Նոր քվեսթի ստուգում',
         'Ուսանողը ուղարկեց ապացույց ստուգման համար։', 'info'
    FROM public.user_roles WHERE role = 'admin';

  RETURN _row;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS quest_submissions_one_live_idx
  ON public.quest_submissions (user_id, template_id, period_key)
  WHERE status IN ('pending', 'approved');

REVOKE ALL ON FUNCTION public.submit_quest(text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_quest(text, text, text, text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_quest_submission(
  _id uuid, _approve boolean, _note text
)
RETURNS public.quest_submissions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.quest_submissions;
  _tpl public.quest_templates;
BEGIN
  IF _uid IS NULL OR NOT app_private.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'admin required';
  END IF;
  IF length(COALESCE(_note, '')) > 1000 THEN RAISE EXCEPTION 'review note is too large'; END IF;
  IF NOT _approve AND nullif(btrim(COALESCE(_note, '')), '') IS NULL THEN
    RAISE EXCEPTION 'rejection reason required';
  END IF;

  SELECT * INTO _row FROM public.quest_submissions WHERE id = _id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'submission not found'; END IF;
  IF _row.status <> 'pending' THEN RAISE EXCEPTION 'submission already reviewed'; END IF;
  SELECT * INTO _tpl FROM public.quest_templates WHERE id = _row.template_id;
  IF _tpl.id IS NULL THEN RAISE EXCEPTION 'quest not found'; END IF;

  IF _approve THEN
    UPDATE public.quest_submissions
       SET status = 'approved', reviewed_by = _uid,
           review_note = NULLIF(btrim(COALESCE(_note, '')), ''), reviewed_at = now()
     WHERE id = _id RETURNING * INTO _row;
    INSERT INTO public.user_quests
      (user_id, template_id, period_key, progress, awarded, awarded_at)
    VALUES (_row.user_id, _row.template_id, _row.period_key, _tpl.target, true, now())
    ON CONFLICT (user_id, template_id, period_key) DO UPDATE SET
      progress = _tpl.target, awarded = true, awarded_at = now(), updated_at = now();
    UPDATE public.profiles SET xp = xp + _tpl.xp WHERE id = _row.user_id;
    INSERT INTO public.notifications (user_id, title, body, kind)
    VALUES (_row.user_id, 'Քվեսթը հաստատվեց ✅',
            format('«%s» — +%s XP', _tpl.title, _tpl.xp), 'success');
  ELSE
    UPDATE public.quest_submissions
       SET status = 'rejected', reviewed_by = _uid,
           review_note = btrim(_note), reviewed_at = now()
     WHERE id = _id RETURNING * INTO _row;
    INSERT INTO public.notifications (user_id, title, body, kind)
    VALUES (_row.user_id, 'Քվեսթը մերժվեց', btrim(_note), 'warning');
  END IF;
  RETURN _row;
END
$$;

REVOKE ALL ON FUNCTION public.review_quest_submission(uuid, boolean, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_quest_submission(uuid, boolean, text)
  TO authenticated;

-- Remove the caller-controlled reroll ceiling.  A reroll day is Yerevan-local.
REVOKE ALL ON FUNCTION public.use_daily_reroll(int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.use_daily_reroll()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _day date := timezone('Asia/Yerevan', now())::date;
  _row public.user_quest_rerolls;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  INSERT INTO public.user_quest_rerolls (user_id, day, used, seed)
  VALUES (_uid, _day, 0, 1)
  ON CONFLICT (user_id, day) DO NOTHING;

  SELECT * INTO _row FROM public.user_quest_rerolls
   WHERE user_id = _uid AND day = _day FOR UPDATE;
  IF _row.used >= 3 THEN
    RETURN jsonb_build_object('ok', false, 'remaining', 0, 'seed', _row.seed);
  END IF;

  UPDATE public.user_quest_rerolls
     SET used = used + 1, seed = seed + 1
   WHERE user_id = _uid AND day = _day
   RETURNING * INTO _row;

  RETURN jsonb_build_object('ok', true, 'remaining', 3 - _row.used, 'seed', _row.seed);
END
$$;

REVOKE ALL ON FUNCTION public.use_daily_reroll() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.use_daily_reroll() TO authenticated;

-- -------------------------------------------------------------------------
-- Server-authoritative level reward catalog
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.level_reward_catalog (
  reward_key text PRIMARY KEY,
  level int NOT NULL CHECK (level BETWEEN 1 AND 100),
  min_xp int NOT NULL CHECK (min_xp >= 0),
  reward text NOT NULL,
  active boolean NOT NULL DEFAULT true
);
ALTER TABLE public.level_reward_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.level_reward_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.level_reward_catalog TO authenticated;
DROP POLICY IF EXISTS "read active level rewards" ON public.level_reward_catalog;
CREATE POLICY "read active level rewards" ON public.level_reward_catalog
  FOR SELECT TO authenticated USING (active = true);

INSERT INTO public.level_reward_catalog (reward_key, level, min_xp, reward) VALUES
  ('1:0', 1, 0, 'Առաջին մասնակցություն'),
  ('1:25', 1, 25, 'Լրացուցիչ AI սերունդ'),
  ('2:50', 2, 50, 'Ակտիվ սովորող'),
  ('2:100', 2, 100, 'Ստեղծագործ մտածող'),
  ('3:150', 3, 150, 'Նախագծի մեկնարկիչ'),
  ('3:250', 3, 250, 'Նորարարական մտածողություն'),
  ('4:350', 4, 350, 'Թիմի անդամ'),
  ('4:525', 4, 525, 'Անհատական խորհրդատվություն'),
  ('5:700', 5, 700, 'Ստեղծագործ մտածող'),
  ('5:950', 5, 950, 'Հետևողական ներդրող'),
  ('6:1200', 6, 1200, 'Նորարարական մտածողություն')
ON CONFLICT (reward_key) DO UPDATE SET
  level = EXCLUDED.level,
  min_xp = EXCLUDED.min_xp,
  reward = EXCLUDED.reward,
  active = true;

ALTER TABLE public.reward_claims ADD COLUMN IF NOT EXISTS reward_key text;
UPDATE public.reward_claims rc
   SET reward_key = COALESCE(
     (SELECT c.reward_key FROM public.level_reward_catalog c
       WHERE c.level = rc.level AND c.reward = rc.reward LIMIT 1),
     'legacy:' || rc.level::text
   )
 WHERE reward_key IS NULL;
ALTER TABLE public.reward_claims ALTER COLUMN reward_key SET NOT NULL;
ALTER TABLE public.reward_claims DROP CONSTRAINT IF EXISTS reward_claims_pkey;
ALTER TABLE public.reward_claims
  ADD CONSTRAINT reward_claims_pkey PRIMARY KEY (user_id, reward_key);

CREATE OR REPLACE FUNCTION public.claim_level_reward(
  _level int, _min_xp int, _reward text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _xp int;
  _catalog public.level_reward_catalog;
  _inserted boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _catalog FROM public.level_reward_catalog
   WHERE level = _level AND min_xp = _min_xp AND reward = _reward AND active = true;
  IF _catalog.reward_key IS NULL THEN RAISE EXCEPTION 'unknown reward'; END IF;

  SELECT xp INTO _xp FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _xp IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  IF _xp < _catalog.min_xp THEN RAISE EXCEPTION 'not enough xp'; END IF;

  INSERT INTO public.reward_claims (user_id, level, reward, reward_key)
  VALUES (_uid, _catalog.level, _catalog.reward, _catalog.reward_key)
  ON CONFLICT (user_id, reward_key) DO NOTHING
  RETURNING true INTO _inserted;

  RETURN jsonb_build_object(
    'ok', true,
    'already', COALESCE(NOT _inserted, true),
    'reward_key', _catalog.reward_key
  );
END
$$;

REVOKE ALL ON FUNCTION public.claim_level_reward(int, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_level_reward(int, int, text) TO authenticated;

-- -------------------------------------------------------------------------
-- Projects: all protected state and participant membership are RPC-only.
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated view active projects" ON public.started_projects;
CREATE POLICY "Authenticated view active projects" ON public.started_projects
  FOR SELECT TO authenticated USING (status = 'active');

CREATE OR REPLACE FUNCTION public.count_active_projects(_uid uuid)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _uid <> auth.uid() AND NOT app_private.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN (
    SELECT count(*)::int
      FROM public.started_projects sp
      JOIN public.project_participants pp ON pp.project_id = sp.id
     WHERE pp.user_id = _uid AND sp.status IN ('active', 'submitted')
  );
END
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_uid uuid, _pid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF _uid <> auth.uid() AND NOT app_private.has_role(auth.uid(), 'admin') THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.project_participants WHERE project_id = _pid AND user_id = _uid
  ) OR EXISTS (
    SELECT 1 FROM public.started_projects WHERE id = _pid AND user_id = _uid
  );
END
$$;

REVOKE ALL ON FUNCTION public.count_active_projects(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.count_active_projects(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.start_project(
  _title text, _short_description text, _full_description text,
  _matching_interests text[], _team_size text, _first_steps jsonb,
  _difficulty_tier text
)
RETURNS public.started_projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _cost int;
  _xp int;
  _row public.started_projects;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _difficulty_tier NOT IN ('easy', 'medium', 'hard') THEN RAISE EXCEPTION 'invalid tier'; END IF;
  IF length(btrim(COALESCE(_title, ''))) NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'invalid title'; END IF;
  IF length(COALESCE(_short_description, '')) > 500
     OR length(COALESCE(_full_description, '')) > 5000
     OR length(COALESCE(_team_size, '')) > 100
     OR cardinality(COALESCE(_matching_interests, '{}')) > 20
     OR pg_column_size(COALESCE(_first_steps, '[]'::jsonb)) > 32768 THEN
    RAISE EXCEPTION 'project input is too large';
  END IF;

  _cost := public.tier_cost(_difficulty_tier);
  SELECT xp INTO _xp FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _xp IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  -- The profile row lock serializes limit checks and XP debits per student.
  IF public.count_active_projects(_uid) >= 2 THEN
    RAISE EXCEPTION 'active project limit reached (max 2)';
  END IF;
  IF _xp < _cost THEN RAISE EXCEPTION 'not enough XP (need %)', _cost; END IF;

  UPDATE public.profiles SET xp = xp - _cost WHERE id = _uid;
  INSERT INTO public.started_projects (
    user_id, title, short_description, full_description, matching_interests,
    difficulty, team_size, first_steps, status, difficulty_tier,
    xp_cost, xp_reward_standard, xp_reward_exceptional
  ) VALUES (
    _uid, btrim(_title), COALESCE(_short_description, ''), COALESCE(_full_description, ''),
    COALESCE(_matching_interests, '{}'), _difficulty_tier, COALESCE(_team_size, ''),
    COALESCE(_first_steps, '[]'::jsonb), 'active', _difficulty_tier, _cost,
    public.tier_reward(_difficulty_tier, false), public.tier_reward(_difficulty_tier, true)
  ) RETURNING * INTO _row;

  INSERT INTO public.project_participants (project_id, user_id, role)
  VALUES (_row.id, _uid, 'owner');
  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (_uid, 'Նախագիծը մեկնարկեց 🚀',
          format('«%s» — %s XP պահեստավորված', _row.title, _cost), 'success');
  RETURN _row;
END
$$;

CREATE OR REPLACE FUNCTION public.join_project(_project_id uuid)
RETURNS public.project_participants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _proj public.started_projects;
  _xp int;
  _row public.project_participants;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _proj FROM public.started_projects WHERE id = _project_id FOR SHARE;
  IF _proj.id IS NULL THEN RAISE EXCEPTION 'project not found'; END IF;
  IF _proj.status <> 'active' THEN RAISE EXCEPTION 'project not joinable'; END IF;

  SELECT * INTO _row FROM public.project_participants
   WHERE project_id = _project_id AND user_id = _uid;
  IF _row.id IS NOT NULL THEN RETURN _row; END IF;

  SELECT xp INTO _xp FROM public.profiles WHERE id = _uid FOR UPDATE;
  IF _xp IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;
  IF public.count_active_projects(_uid) >= 2 THEN
    RAISE EXCEPTION 'active project limit reached (max 2)';
  END IF;
  IF _xp < _proj.xp_cost THEN RAISE EXCEPTION 'not enough XP (need %)', _proj.xp_cost; END IF;

  INSERT INTO public.project_participants (project_id, user_id, role)
  VALUES (_project_id, _uid, 'member')
  ON CONFLICT (project_id, user_id) DO NOTHING
  RETURNING * INTO _row;
  IF _row.id IS NULL THEN
    SELECT * INTO _row FROM public.project_participants
     WHERE project_id = _project_id AND user_id = _uid;
    RETURN _row;
  END IF;
  UPDATE public.profiles SET xp = xp - _proj.xp_cost WHERE id = _uid;
  RETURN _row;
END
$$;

CREATE OR REPLACE FUNCTION public.submit_project(_project_id uuid)
RETURNS public.started_projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.started_projects;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.started_projects
     SET status = 'submitted', submitted_at = now()
   WHERE id = _project_id AND user_id = _uid AND status = 'active'
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'only the owner can submit an active project'; END IF;

  INSERT INTO public.notifications (user_id, title, body, kind)
  SELECT pp.user_id, 'Նախագիծը ուղարկվեց ստուգման',
         format('«%s» սպասում է ադմինի վերանայմանը։', _row.title), 'info'
    FROM public.project_participants pp WHERE pp.project_id = _project_id;
  RETURN _row;
END
$$;

CREATE OR REPLACE FUNCTION public.review_project(
  _project_id uuid, _approve boolean, _exceptional boolean DEFAULT false,
  _rating int DEFAULT NULL, _reason text DEFAULT NULL
)
RETURNS public.started_projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.started_projects;
  _award int;
BEGIN
  IF _uid IS NULL OR NOT app_private.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'admin required'; END IF;
  IF _rating IS NOT NULL AND _rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'invalid rating'; END IF;
  IF NOT _approve AND nullif(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'rejection reason required';
  END IF;

  SELECT * INTO _row FROM public.started_projects WHERE id = _project_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _row.status <> 'submitted' THEN RAISE EXCEPTION 'only submitted projects can be reviewed'; END IF;

  IF _approve THEN
    _award := CASE WHEN _exceptional THEN _row.xp_reward_exceptional ELSE _row.xp_reward_standard END;
    UPDATE public.started_projects
       SET status = 'approved', approved_at = now(), reviewed_at = now(), reviewed_by = _uid,
           quality = CASE WHEN _exceptional THEN 'exceptional' ELSE 'standard' END,
           admin_rating = _rating, rejection_reason = NULL, progress = 100
     WHERE id = _project_id RETURNING * INTO _row;
    UPDATE public.profiles p SET xp = p.xp + _award
      FROM public.project_participants pp
     WHERE pp.project_id = _project_id AND pp.user_id = p.id;
    INSERT INTO public.notifications (user_id, title, body, kind)
    SELECT pp.user_id,
           CASE WHEN _exceptional THEN 'Բացառիկ կատարում 🌟' ELSE 'Նախագիծը հաստատվեց ✅' END,
           format('«%s» — +%s XP', _row.title, _award), 'success'
      FROM public.project_participants pp WHERE pp.project_id = _project_id;
  ELSE
    UPDATE public.started_projects
       SET status = 'rejected', reviewed_at = now(), reviewed_by = _uid,
           rejection_reason = btrim(_reason), quality = NULL, admin_rating = _rating
     WHERE id = _project_id RETURNING * INTO _row;
    INSERT INTO public.notifications (user_id, title, body, kind)
    SELECT pp.user_id, 'Նախագիծը մերժվեց', btrim(_reason), 'warning'
      FROM public.project_participants pp WHERE pp.project_id = _project_id;
  END IF;
  RETURN _row;
END
$$;

CREATE OR REPLACE FUNCTION public.cancel_project(_project_id uuid)
RETURNS public.started_projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.started_projects;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _row FROM public.started_projects WHERE id = _project_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _row.user_id <> _uid AND NOT app_private.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _row.status NOT IN ('active', 'submitted') THEN RAISE EXCEPTION 'cannot cancel'; END IF;
  UPDATE public.started_projects
     SET status = 'cancelled', cancelled_at = now()
   WHERE id = _project_id RETURNING * INTO _row;
  RETURN _row;
END
$$;

-- Keep execute rights explicit after the replacements above.
REVOKE ALL ON FUNCTION public.start_project(text,text,text,text[],text,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.join_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_project(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_project(uuid,boolean,boolean,int,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_project(text,text,text,text[],text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_project(uuid,boolean,boolean,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_project(uuid) TO authenticated;

-- -------------------------------------------------------------------------
-- Support: sender identity and thread state are server-derived.
-- -------------------------------------------------------------------------
ALTER TABLE public.support_messages ALTER COLUMN sender_role SET DEFAULT 'user';

CREATE OR REPLACE FUNCTION public.canonicalize_support_sender()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  NEW.sender_id := _uid;
  NEW.sender_role := CASE
    WHEN app_private.has_role(_uid, 'admin') THEN 'admin'
    ELSE 'user'
  END;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS support_messages_canonical_sender ON public.support_messages;
CREATE TRIGGER support_messages_canonical_sender
  BEFORE INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.canonicalize_support_sender();

REVOKE INSERT ON public.support_messages FROM anon, authenticated;
DROP POLICY IF EXISTS "send messages in own thread or as admin" ON public.support_messages;

CREATE OR REPLACE FUNCTION public.send_support_message(_thread_id uuid, _content text)
RETURNS public.support_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _thread public.support_threads;
  _role text;
  _row public.support_messages;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(btrim(COALESCE(_content, ''))) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'invalid message';
  END IF;
  SELECT * INTO _thread FROM public.support_threads WHERE id = _thread_id FOR SHARE;
  IF _thread.id IS NULL THEN RAISE EXCEPTION 'thread not found'; END IF;
  _role := CASE WHEN app_private.has_role(_uid, 'admin') THEN 'admin' ELSE 'user' END;
  IF _role = 'user' AND _thread.user_id <> _uid THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _thread.status = 'closed' THEN RAISE EXCEPTION 'thread is closed'; END IF;

  INSERT INTO public.support_messages (thread_id, sender_id, sender_role, content)
  VALUES (_thread_id, _uid, _role, btrim(_content))
  RETURNING * INTO _row;
  RETURN _row;
END
$$;

REVOKE ALL ON FUNCTION public.send_support_message(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_support_message(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_support_thread(_subject text, _first_message text)
RETURNS public.support_threads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _thread public.support_threads;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF length(btrim(COALESCE(_subject, ''))) NOT BETWEEN 1 AND 140
     OR length(btrim(COALESCE(_first_message, ''))) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'invalid support request';
  END IF;
  IF (
    SELECT count(*) FROM public.support_threads
     WHERE user_id = _uid AND created_at > now() - interval '1 hour'
  ) >= 10 THEN
    RAISE EXCEPTION 'too many support requests';
  END IF;

  INSERT INTO public.support_threads (user_id, subject)
  VALUES (_uid, btrim(_subject))
  RETURNING * INTO _thread;

  INSERT INTO public.support_messages (thread_id, sender_id, sender_role, content)
  VALUES (_thread.id, _uid, 'user', btrim(_first_message));
  RETURN _thread;
END
$$;

REVOKE ALL ON FUNCTION public.create_support_thread(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_support_thread(text, text) TO authenticated;

REVOKE INSERT, UPDATE ON public.support_threads FROM anon, authenticated;
DROP POLICY IF EXISTS "users create own threads" ON public.support_threads;
DROP POLICY IF EXISTS "admins update threads" ON public.support_threads;

CREATE OR REPLACE FUNCTION public.set_support_thread_status(_thread_id uuid, _status text)
RETURNS public.support_threads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.support_threads;
BEGIN
  IF _uid IS NULL OR NOT app_private.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'admin required'; END IF;
  IF _status NOT IN ('open', 'answered', 'closed') THEN RAISE EXCEPTION 'invalid status'; END IF;
  UPDATE public.support_threads
     SET status = _status, updated_at = now()
   WHERE id = _thread_id
   RETURNING * INTO _row;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'thread not found'; END IF;
  RETURN _row;
END
$$;

REVOKE ALL ON FUNCTION public.set_support_thread_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_support_thread_status(uuid, text) TO authenticated;

-- -------------------------------------------------------------------------
-- Untrusted text/media inputs: enforce the same bounds at the database edge.
-- -------------------------------------------------------------------------
UPDATE storage.buckets
   SET file_size_limit = 26214400,
       allowed_mime_types = ARRAY[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'video/mp4', 'video/webm', 'video/quicktime'
       ]::text[]
 WHERE id = 'post-media';
UPDATE storage.buckets
   SET file_size_limit = 26214400,
       allowed_mime_types = ARRAY[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'video/mp4', 'video/webm', 'video/quicktime',
         'application/pdf', 'text/plain'
       ]::text[]
 WHERE id = 'project-media';

DROP POLICY IF EXISTS "Authenticated can read post media" ON storage.objects;
DROP POLICY IF EXISTS "post media: approved, own, or admin read" ON storage.objects;
CREATE POLICY "post media: approved, own, or admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin')
      OR EXISTS (
        SELECT 1 FROM public.posts post
         WHERE post.status = 'approved' AND name = ANY(post.media_urls)
      )
    )
  );

DROP POLICY IF EXISTS "project media: delete own uploads" ON storage.objects;
CREATE POLICY "project media: delete own uploads" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'project-media' AND owner_id = auth.uid()::text);

CREATE OR REPLACE FUNCTION public.validate_profile_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF length(COALESCE(NEW.full_name, '')) > 120
     OR length(COALESCE(NEW.phone, '')) > 40
     OR length(COALESCE(NEW.school, '')) > 200
     OR length(COALESCE(NEW.bio, '')) > 2000
     OR length(COALESCE(NEW.goal, '')) > 1000
     OR length(COALESCE(NEW.availability, '')) > 120
     OR length(COALESCE(NEW.preferred_project_type, '')) > 120
     OR cardinality(COALESCE(NEW.interests, '{}'::text[])) > 30
     OR cardinality(COALESCE(NEW.skills, '{}'::text[])) > 30
     OR cardinality(COALESCE(NEW.learning_areas, '{}'::text[])) > 30
     OR EXISTS (
       SELECT 1 FROM unnest(
         COALESCE(NEW.interests, '{}'::text[])
         || COALESCE(NEW.skills, '{}'::text[])
         || COALESCE(NEW.learning_areas, '{}'::text[])
       ) item WHERE length(item) > 100
     )
  THEN RAISE EXCEPTION 'profile input is too large'; END IF;
  IF NEW.age IS NOT NULL AND NEW.age NOT BETWEEN 10 AND 100 THEN
    RAISE EXCEPTION 'invalid age';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS profiles_validate_input ON public.profiles;
CREATE TRIGGER profiles_validate_input
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_input();

CREATE OR REPLACE FUNCTION public.validate_post_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _path text;
BEGIN
  NEW.content := btrim(COALESCE(NEW.content, ''));
  IF length(NEW.content) > 10000
     OR length(COALESCE(NEW.title, '')) > 200
     OR length(COALESCE(NEW.location, '')) > 200
     OR cardinality(COALESCE(NEW.tags, '{}'::text[])) > 10
     OR EXISTS (
       SELECT 1 FROM unnest(COALESCE(NEW.tags, '{}'::text[])) tag
        WHERE length(tag) > 60
     )
  THEN RAISE EXCEPTION 'post input is too large'; END IF;
  IF cardinality(COALESCE(NEW.media_urls, '{}'::text[])) > 8
     OR cardinality(COALESCE(NEW.media_urls, '{}'::text[]))
        <> cardinality(COALESCE(NEW.media_types, '{}'::text[]))
     OR EXISTS (
       SELECT 1 FROM unnest(COALESCE(NEW.media_types, '{}'::text[])) media_type
        WHERE media_type NOT IN ('image', 'video')
     )
  THEN RAISE EXCEPTION 'invalid post media'; END IF;
  IF NEW.content = '' AND cardinality(COALESCE(NEW.media_urls, '{}'::text[])) = 0 THEN
    RAISE EXCEPTION 'post content is required';
  END IF;
  FOREACH _path IN ARRAY COALESCE(NEW.media_urls, '{}'::text[]) LOOP
    IF split_part(_path, '/', 1) <> NEW.author_id::text
       OR NOT EXISTS (
         SELECT 1 FROM storage.objects object
          WHERE object.bucket_id = 'post-media'
            AND object.name = _path
            AND object.owner_id = NEW.author_id::text
       )
    THEN RAISE EXCEPTION 'invalid post media path'; END IF;
  END LOOP;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.validate_post_input() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS posts_validate_input ON public.posts;
CREATE TRIGGER posts_validate_input
  BEFORE INSERT OR UPDATE OF title, content, media_urls, media_types, tags, location
  ON public.posts FOR EACH ROW EXECUTE FUNCTION public.validate_post_input();

CREATE OR REPLACE FUNCTION public.validate_project_message_input()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _path text;
BEGIN
  NEW.content := btrim(COALESCE(NEW.content, ''));
  IF length(NEW.content) > 4000
     OR cardinality(COALESCE(NEW.media_urls, '{}'::text[])) > 8
     OR cardinality(COALESCE(NEW.media_urls, '{}'::text[]))
        <> cardinality(COALESCE(NEW.media_types, '{}'::text[]))
     OR EXISTS (
       SELECT 1 FROM unnest(COALESCE(NEW.media_types, '{}'::text[])) media_type
        WHERE media_type NOT IN ('image', 'video', 'file')
     )
  THEN RAISE EXCEPTION 'invalid project message'; END IF;
  IF NEW.content = '' AND cardinality(COALESCE(NEW.media_urls, '{}'::text[])) = 0 THEN
    RAISE EXCEPTION 'message content is required';
  END IF;
  FOREACH _path IN ARRAY COALESCE(NEW.media_urls, '{}'::text[]) LOOP
    IF split_part(_path, '/', 1) <> NEW.project_id::text
       OR NOT EXISTS (
         SELECT 1 FROM storage.objects object
          WHERE object.bucket_id = 'project-media'
            AND object.name = _path
            AND object.owner_id = NEW.user_id::text
       )
    THEN RAISE EXCEPTION 'invalid project media path'; END IF;
  END LOOP;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.validate_project_message_input()
  FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS project_messages_validate_input ON public.project_messages;
CREATE TRIGGER project_messages_validate_input
  BEFORE INSERT OR UPDATE OF content, media_urls, media_types
  ON public.project_messages FOR EACH ROW
  EXECUTE FUNCTION public.validate_project_message_input();

CREATE OR REPLACE FUNCTION public.validate_post_comment_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.content := btrim(COALESCE(NEW.content, ''));
  IF length(NEW.content) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'invalid comment';
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS post_comments_validate_input ON public.post_comments;
CREATE TRIGGER post_comments_validate_input
  BEFORE INSERT OR UPDATE OF content ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.validate_post_comment_input();

CREATE OR REPLACE FUNCTION public.validate_support_thread_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.subject := btrim(COALESCE(NEW.subject, ''));
  IF length(NEW.subject) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid support subject';
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS support_threads_validate_input ON public.support_threads;
CREATE TRIGGER support_threads_validate_input
  BEFORE INSERT OR UPDATE OF subject ON public.support_threads
  FOR EACH ROW EXECUTE FUNCTION public.validate_support_thread_input();

CREATE OR REPLACE FUNCTION public.validate_schedule_event_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.source NOT IN ('manual', 'ai')
       AND auth.role() = 'authenticated'
       AND current_user <> 'postgres'
    THEN RAISE EXCEPTION 'managed event is read-only'; END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' AND auth.role() = 'authenticated' THEN
    IF NEW.source NOT IN ('manual', 'ai') THEN NEW.source := 'manual'; END IF;
    NEW.external_id := NULL;
  ELSIF TG_OP = 'UPDATE' AND auth.role() = 'authenticated' THEN
    IF OLD.source NOT IN ('manual', 'ai') AND current_user <> 'postgres' THEN
      RAISE EXCEPTION 'managed event is read-only';
    END IF;
    NEW.user_id := OLD.user_id;
    NEW.source := OLD.source;
    NEW.external_id := OLD.external_id;
  END IF;

  NEW.title := btrim(COALESCE(NEW.title, ''));
  IF length(NEW.title) NOT BETWEEN 1 AND 200
     OR length(COALESCE(NEW.description, '')) > 4000
     OR length(COALESCE(NEW.location, '')) > 300
     OR length(COALESCE(NEW.recurrence, '')) > 100
     OR NEW.ends_at <= NEW.starts_at
     OR (NEW.reminder_minutes IS NOT NULL AND NEW.reminder_minutes NOT BETWEEN 0 AND 10080)
  THEN RAISE EXCEPTION 'invalid schedule event'; END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS schedule_events_validate_input ON public.schedule_events;
CREATE TRIGGER schedule_events_validate_input
  BEFORE INSERT OR UPDATE OR DELETE ON public.schedule_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_schedule_event_input();

-- -------------------------------------------------------------------------
-- OAuth secrets: move tokens out of the browser-readable public relation.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('recommendations', 'project_detail', 'admin_insights', 'chat')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_events_user_window_idx
  ON public.ai_usage_events (user_id, kind, created_at DESC);
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;

ALTER TABLE public.ai_usage_events DROP CONSTRAINT IF EXISTS ai_usage_events_kind_check;
ALTER TABLE public.ai_usage_events ADD CONSTRAINT ai_usage_events_kind_check
  CHECK (kind IN ('recommendations', 'project_detail', 'admin_insights', 'chat'));

CREATE OR REPLACE FUNCTION public.consume_ai_quota(
  _user_id uuid, _kind text, _hourly_limit int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _recent int;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF _user_id IS NULL
     OR _kind NOT IN ('recommendations', 'project_detail', 'admin_insights')
     OR _hourly_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'invalid quota request';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || ':' || _kind, 0));
  SELECT count(*)::int INTO _recent FROM public.ai_usage_events
   WHERE user_id = _user_id AND kind = _kind
     AND created_at >= now() - interval '1 hour';
  IF _recent >= _hourly_limit THEN RETURN false; END IF;

  INSERT INTO public.ai_usage_events (user_id, kind) VALUES (_user_id, _kind);
  DELETE FROM public.ai_usage_events
   WHERE user_id = _user_id AND created_at < now() - interval '7 days';
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid, text, int)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text, int) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_chat_quota()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _limit int := 30;
  _used int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text || ':chat', 0));
  SELECT count(*)::int INTO _used FROM public.ai_usage_events
   WHERE user_id = _uid AND kind = 'chat'
     AND created_at >= now() - interval '1 hour';
  IF _used >= _limit THEN
    RETURN jsonb_build_object('ok', false, 'limit', _limit, 'remaining', 0, 'retry_after', 3600);
  END IF;
  INSERT INTO public.ai_usage_events (user_id, kind) VALUES (_uid, 'chat');
  DELETE FROM public.ai_usage_events
   WHERE user_id = _uid AND created_at < now() - interval '7 days';
  RETURN jsonb_build_object(
    'ok', true, 'limit', _limit, 'remaining', GREATEST(0, _limit - _used - 1)
  );
END
$$;

REVOKE ALL ON FUNCTION public.consume_chat_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_chat_quota() TO authenticated;

CREATE TABLE IF NOT EXISTS app_private.user_integration_tokens (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  access_token text NOT NULL,
  refresh_token text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);
REVOKE ALL ON app_private.user_integration_tokens FROM PUBLIC, anon, authenticated;

INSERT INTO app_private.user_integration_tokens
  (user_id, provider, access_token, refresh_token, updated_at)
SELECT user_id, provider, access_token, refresh_token, updated_at
  FROM public.user_integrations
 WHERE access_token IS NOT NULL
ON CONFLICT (user_id, provider) DO UPDATE SET
  access_token = EXCLUDED.access_token,
  refresh_token = COALESCE(EXCLUDED.refresh_token, app_private.user_integration_tokens.refresh_token),
  updated_at = EXCLUDED.updated_at;

DROP POLICY IF EXISTS "own integrations read" ON public.user_integrations;
REVOKE ALL ON public.user_integrations FROM anon, authenticated;
ALTER TABLE public.user_integrations DROP COLUMN IF EXISTS access_token;
ALTER TABLE public.user_integrations DROP COLUMN IF EXISTS refresh_token;

CREATE OR REPLACE FUNCTION public.store_google_integration(
  _user_id uuid,
  _access_token text,
  _refresh_token text,
  _expires_at timestamptz,
  _calendar_id text DEFAULT 'primary'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service role required'; END IF;
  IF _user_id IS NULL OR nullif(_access_token, '') IS NULL THEN RAISE EXCEPTION 'invalid token payload'; END IF;

  INSERT INTO public.user_integrations
    (user_id, provider, expires_at, calendar_id, status, updated_at)
  VALUES (_user_id, 'google', _expires_at, COALESCE(_calendar_id, 'primary'), 'connected', now())
  ON CONFLICT (user_id, provider) DO UPDATE SET
    expires_at = EXCLUDED.expires_at,
    calendar_id = EXCLUDED.calendar_id,
    status = 'connected',
    updated_at = now();

  INSERT INTO app_private.user_integration_tokens
    (user_id, provider, access_token, refresh_token, updated_at)
  VALUES (_user_id, 'google', _access_token, _refresh_token, now())
  ON CONFLICT (user_id, provider) DO UPDATE SET
    access_token = EXCLUDED.access_token,
    refresh_token = COALESCE(EXCLUDED.refresh_token, app_private.user_integration_tokens.refresh_token),
    updated_at = now();
END
$$;

REVOKE ALL ON FUNCTION public.store_google_integration(uuid,text,text,timestamptz,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_google_integration(uuid,text,text,timestamptz,text)
  TO service_role;

-- -------------------------------------------------------------------------
-- Post moderation: authors can write content, never moderation columns.
-- Any edit to a published/rejected post goes back through review.
-- -------------------------------------------------------------------------
REVOKE INSERT, UPDATE ON public.posts FROM anon, authenticated;
GRANT INSERT (author_id, title, content, media_urls, media_types, tags, location)
  ON public.posts TO authenticated;
GRANT UPDATE (title, content, media_urls, media_types, tags, location)
  ON public.posts TO authenticated;

CREATE OR REPLACE FUNCTION public.posts_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, app_private
AS $$
DECLARE
  _content_changed boolean;
BEGIN
  NEW.updated_at := now();
  _content_changed :=
    NEW.content IS DISTINCT FROM OLD.content OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.media_urls IS DISTINCT FROM OLD.media_urls OR
    NEW.media_types IS DISTINCT FROM OLD.media_types OR
    NEW.tags IS DISTINCT FROM OLD.tags OR
    NEW.location IS DISTINCT FROM OLD.location;

  IF _content_changed AND NOT app_private.has_role(auth.uid(), 'admin') THEN
    NEW.status := 'pending';
    NEW.rejection_reason := NULL;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.approved_at := NULL;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.moderate_post(
  _post_id uuid, _approve boolean, _reason text DEFAULT NULL
)
RETURNS public.posts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.posts;
BEGIN
  IF _uid IS NULL OR NOT app_private.has_role(_uid, 'admin') THEN
    RAISE EXCEPTION 'admin required';
  END IF;
  IF length(COALESCE(_reason, '')) > 1000 THEN RAISE EXCEPTION 'reason is too large'; END IF;
  IF NOT _approve AND nullif(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'rejection reason required';
  END IF;

  SELECT * INTO _row FROM public.posts WHERE id = _post_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'post not found'; END IF;
  IF _row.status <> 'pending' THEN RAISE EXCEPTION 'post is not pending review'; END IF;

  UPDATE public.posts
     SET status = CASE
           WHEN _approve THEN 'approved'::public.post_status
           ELSE 'rejected'::public.post_status
         END,
         rejection_reason = CASE WHEN _approve THEN NULL ELSE btrim(_reason) END,
         reviewed_by = _uid,
         reviewed_at = now(),
         approved_at = CASE WHEN _approve THEN now() ELSE NULL END
   WHERE id = _post_id
   RETURNING * INTO _row;

  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (
    _row.author_id,
    CASE WHEN _approve THEN 'Քո գրառումը հաստատվեց' ELSE 'Քո գրառումը մերժվեց' END,
    CASE WHEN _approve THEN 'Այն այժմ տեսանելի է հանրային ֆիդում։' ELSE btrim(_reason) END,
    CASE WHEN _approve THEN 'success' ELSE 'warning' END
  );
  RETURN _row;
END
$$;

REVOKE ALL ON FUNCTION public.moderate_post(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_post(uuid, boolean, text) TO authenticated;

-- Limit aggregate helpers to their owner/admin; both are SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_user_rank(_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _uid <> auth.uid() AND NOT app_private.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT COUNT(*) FILTER (WHERE sp.status = 'approved'),
         COUNT(*) FILTER (WHERE sp.status = 'approved' AND sp.quality = 'exceptional'),
         COUNT(*) FILTER (WHERE sp.status IN ('approved', 'rejected', 'submitted')),
         AVG(sp.admin_rating) FILTER (WHERE sp.admin_rating IS NOT NULL)
    INTO _completed, _exceptional, _submitted, _avg_rating
    FROM public.started_projects sp
    JOIN public.project_participants pp ON pp.project_id = sp.id
   WHERE pp.user_id = _uid;
  SELECT COUNT(*) INTO _badges FROM public.achievements WHERE user_id = _uid;
  SELECT
    COALESCE((SELECT COUNT(*) FROM public.participations WHERE user_id = _uid AND joined_at > now() - interval '30 days'), 0) +
    COALESCE((SELECT COUNT(*) FROM public.posts WHERE author_id = _uid AND created_at > now() - interval '30 days'), 0) +
    COALESCE((SELECT COUNT(*) FROM public.post_comments WHERE user_id = _uid AND created_at > now() - interval '30 days'), 0)
    INTO _activity;
  _reliability := CASE WHEN _submitted > 0 THEN _completed::numeric / _submitted ELSE 0 END;
  _score := (_completed * 30) + (_exceptional * 20) + (COALESCE(_avg_rating, 0) * 15)
          + (LEAST(_activity, 30) * 0.5) + (_reliability * 10) + (_badges * 10);
  _tier := CASE
    WHEN _score >= 1500 THEN 'Diamond'
    WHEN _score >= 900 THEN 'Platinum'
    WHEN _score >= 500 THEN 'Gold'
    WHEN _score >= 200 THEN 'Silver'
    WHEN _score >= 50 THEN 'Bronze'
    ELSE 'Unranked' END;
  RETURN jsonb_build_object(
    'score', ROUND(_score)::int, 'tier', _tier, 'completed', _completed,
    'exceptional', _exceptional, 'avg_rating', COALESCE(ROUND(_avg_rating, 2), 0),
    'activity', _activity, 'reliability', ROUND(_reliability, 2), 'badges', _badges
  );
END
$$;

REVOKE ALL ON FUNCTION public.get_user_rank(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_rank(uuid) TO authenticated;

-- Project evidence is append-only and accepts new messages only while work or
-- review is active. Members cannot erase the review trail afterward.
REVOKE DELETE ON public.project_messages FROM anon, authenticated;
DROP POLICY IF EXISTS "messages_delete" ON public.project_messages;
DROP POLICY IF EXISTS "messages_insert" ON public.project_messages;
CREATE POLICY "messages_insert" ON public.project_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_project_member(auth.uid(), project_id)
    AND EXISTS (
      SELECT 1 FROM public.started_projects candidate
       WHERE candidate.id = project_messages.project_id
         AND candidate.status IN ('active', 'submitted')
    )
  );

-- -------------------------------------------------------------------------
-- Agent chat persistence: bounded, deduplicated, and RPC-only.
-- -------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.agent_threads FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.agent_messages FROM anon, authenticated;

WITH duplicate_messages AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY thread_id, ai_message_id
           ORDER BY created_at, id
         ) AS duplicate_number
    FROM public.agent_messages
   WHERE ai_message_id IS NOT NULL
)
DELETE FROM public.agent_messages message
 USING duplicate_messages duplicate
 WHERE message.id = duplicate.id
   AND duplicate.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS agent_messages_thread_ai_message_idx
  ON public.agent_messages (thread_id, ai_message_id)
  WHERE ai_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_agent_thread()
RETURNS public.agent_threads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.agent_threads;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_uid::text || ':agent-thread', 0));

  SELECT * INTO _row
    FROM public.agent_threads
   WHERE user_id = _uid
   ORDER BY updated_at DESC
   LIMIT 1;

  IF _row.id IS NULL THEN
    INSERT INTO public.agent_threads (user_id)
    VALUES (_uid)
    RETURNING * INTO _row;
  END IF;
  RETURN _row;
END
$$;

CREATE OR REPLACE FUNCTION public.save_agent_message(
  _thread_id uuid,
  _role text,
  _parts jsonb,
  _ai_message_id text DEFAULT NULL
)
RETURNS public.agent_messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.agent_messages;
  _message_count int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _role NOT IN ('user', 'assistant')
     OR _parts IS NULL
     OR jsonb_typeof(_parts) <> 'array'
     OR octet_length(_parts::text) > 131072
     OR length(COALESCE(_ai_message_id, '')) > 200 THEN
    RAISE EXCEPTION 'invalid agent message';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.agent_threads
     WHERE id = _thread_id AND user_id = _uid
  ) THEN RAISE EXCEPTION 'thread not found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_thread_id::text || ':agent-message', 0));
  IF _ai_message_id IS NOT NULL THEN
    SELECT * INTO _row FROM public.agent_messages
     WHERE thread_id = _thread_id AND ai_message_id = _ai_message_id;
    IF _row.id IS NOT NULL THEN RETURN _row; END IF;
  END IF;

  SELECT count(*)::int INTO _message_count
    FROM public.agent_messages WHERE thread_id = _thread_id;
  IF _message_count >= 500 THEN RAISE EXCEPTION 'thread message limit reached'; END IF;

  INSERT INTO public.agent_messages (thread_id, role, parts, ai_message_id)
  VALUES (_thread_id, _role, _parts, _ai_message_id)
  RETURNING * INTO _row;

  UPDATE public.agent_threads SET updated_at = now() WHERE id = _thread_id;
  RETURN _row;
END
$$;

CREATE OR REPLACE FUNCTION public.reset_agent_thread(_thread_id uuid)
RETURNS public.agent_threads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.agent_threads;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _row FROM public.agent_threads
   WHERE id = _thread_id AND user_id = _uid
   FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'thread not found'; END IF;

  DELETE FROM public.agent_messages WHERE thread_id = _thread_id;
  UPDATE public.agent_threads SET updated_at = now()
   WHERE id = _thread_id RETURNING * INTO _row;
  RETURN _row;
END
$$;

REVOKE ALL ON FUNCTION public.ensure_agent_thread() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_agent_message(uuid, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reset_agent_thread(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_agent_thread() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_agent_message(uuid, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_agent_thread(uuid) TO authenticated;

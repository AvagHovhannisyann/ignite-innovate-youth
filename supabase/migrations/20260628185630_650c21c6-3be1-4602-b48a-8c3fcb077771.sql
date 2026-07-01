
-- ============ QUEST EVIDENCE ============
ALTER TABLE public.quest_templates
  ADD COLUMN IF NOT EXISTS requires_evidence boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS evidence_prompt text;

DO $$ BEGIN
  CREATE TYPE public.quest_submission_status AS ENUM ('pending','approved','rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS public.quest_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id text NOT NULL REFERENCES public.quest_templates(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  content text NOT NULL DEFAULT '',
  media_urls text[] NOT NULL DEFAULT '{}',
  status public.quest_submission_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.quest_submissions TO authenticated;
GRANT ALL ON public.quest_submissions TO service_role;
ALTER TABLE public.quest_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own submissions select" ON public.quest_submissions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "own submissions insert" ON public.quest_submissions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin update submissions" ON public.quest_submissions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.submit_quest(_template_id text, _period text, _content text, _media text[])
RETURNS public.quest_submissions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _tpl public.quest_templates; _row public.quest_submissions;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _tpl FROM public.quest_templates WHERE id=_template_id AND active=true;
  IF _tpl.id IS NULL THEN RAISE EXCEPTION 'unknown quest'; END IF;
  IF EXISTS(SELECT 1 FROM public.quest_submissions WHERE user_id=_uid AND template_id=_template_id AND period_key=_period AND status IN ('pending','approved')) THEN
    RAISE EXCEPTION 'already submitted';
  END IF;
  INSERT INTO public.quest_submissions(user_id,template_id,period_key,content,media_urls)
  VALUES (_uid,_template_id,_period,COALESCE(_content,''),COALESCE(_media,'{}')) RETURNING * INTO _row;
  -- notify admins
  INSERT INTO public.notifications(user_id,title,body,kind)
  SELECT user_id,'Նոր քվեսթի ստուգում','Ուսանողը ուղարկեց ապացույց ստուգման համար։','info'
  FROM public.user_roles WHERE role='admin';
  RETURN _row;
END $$;

CREATE OR REPLACE FUNCTION public.review_quest_submission(_id uuid, _approve boolean, _note text)
RETURNS public.quest_submissions LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _row public.quest_submissions; _tpl public.quest_templates; _new_xp int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.has_role(_uid,'admin') THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT * INTO _row FROM public.quest_submissions WHERE id=_id FOR UPDATE;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF _row.status<>'pending' THEN RAISE EXCEPTION 'already reviewed'; END IF;
  SELECT * INTO _tpl FROM public.quest_templates WHERE id=_row.template_id;
  IF _approve THEN
    UPDATE public.quest_submissions SET status='approved',reviewed_by=_uid,review_note=_note,reviewed_at=now() WHERE id=_id RETURNING * INTO _row;
    INSERT INTO public.user_quests(user_id,template_id,period_key,progress,awarded,awarded_at)
    VALUES (_row.user_id,_row.template_id,_row.period_key,_tpl.target,true,now())
    ON CONFLICT (user_id,template_id,period_key) DO UPDATE SET progress=_tpl.target,awarded=true,awarded_at=now();
    UPDATE public.profiles SET xp=COALESCE(xp,0)+_tpl.xp WHERE id=_row.user_id RETURNING xp INTO _new_xp;
    INSERT INTO public.notifications(user_id,title,body,kind)
    VALUES (_row.user_id,'Քվեսթը հաստատվեց ✅', format('«%s» — +%s XP', _tpl.title, _tpl.xp),'success');
  ELSE
    UPDATE public.quest_submissions SET status='rejected',reviewed_by=_uid,review_note=_note,reviewed_at=now() WHERE id=_id RETURNING * INTO _row;
    INSERT INTO public.notifications(user_id,title,body,kind)
    VALUES (_row.user_id,'Քվեսթը մերժվեց', COALESCE(_note,'Պատճառ նշված չէ։'),'warning');
  END IF;
  RETURN _row;
END $$;

-- patch claim_quest to refuse evidence quests
CREATE OR REPLACE FUNCTION public.claim_quest(_template_id text, _period text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _tpl public.quest_templates; _row public.user_quests; _new_xp int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _tpl FROM public.quest_templates WHERE id=_template_id AND active=true;
  IF _tpl.id IS NULL THEN RAISE EXCEPTION 'unknown template'; END IF;
  IF _tpl.requires_evidence THEN RAISE EXCEPTION 'this quest requires evidence submission'; END IF;
  SELECT * INTO _row FROM public.user_quests WHERE user_id=_uid AND template_id=_template_id AND period_key=_period FOR UPDATE;
  IF _row.id IS NULL OR _row.progress < _tpl.target THEN RAISE EXCEPTION 'quest not complete'; END IF;
  IF _row.awarded THEN RETURN jsonb_build_object('already',true,'xp',0); END IF;
  UPDATE public.user_quests SET awarded=true, awarded_at=now() WHERE id=_row.id;
  UPDATE public.profiles SET xp=COALESCE(xp,0)+_tpl.xp WHERE id=_uid RETURNING xp INTO _new_xp;
  RETURN jsonb_build_object('already',false,'xp',_tpl.xp,'total_xp',_new_xp);
END $$;

-- ============ SCHEDULE ============
CREATE TABLE IF NOT EXISTS public.schedule_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  location text,
  kind text NOT NULL DEFAULT 'other',
  color text,
  source text NOT NULL DEFAULT 'manual',
  external_id text,
  all_day boolean NOT NULL DEFAULT false,
  ics_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS schedule_events_user_idx ON public.schedule_events(user_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_events TO authenticated;
GRANT ALL ON public.schedule_events TO service_role;
ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own schedule" ON public.schedule_events FOR ALL TO authenticated
  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

-- per-user secret token for ics feed; stored on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ics_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS profiles_ics_token_idx ON public.profiles(ics_token);

CREATE TABLE IF NOT EXISTS public.user_integrations (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  calendar_id text,
  status text NOT NULL DEFAULT 'connected',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, provider)
);
GRANT SELECT ON public.user_integrations TO authenticated;
GRANT ALL ON public.user_integrations TO service_role;
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own integrations read" ON public.user_integrations FOR SELECT TO authenticated USING (user_id=auth.uid());

-- ============ AGENT THREADS / MESSAGES ============
CREATE TABLE IF NOT EXISTS public.agent_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Իմ AI օգնականը',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_threads_user_idx ON public.agent_threads(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_threads TO authenticated;
GRANT ALL ON public.agent_threads TO service_role;
ALTER TABLE public.agent_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own threads" ON public.agent_threads FOR ALL TO authenticated
  USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

CREATE TABLE IF NOT EXISTS public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.agent_threads(id) ON DELETE CASCADE,
  role text NOT NULL,
  parts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_messages_thread_idx ON public.agent_messages(thread_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.agent_messages TO authenticated;
GRANT ALL ON public.agent_messages TO service_role;
ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own thread messages" ON public.agent_messages FOR ALL TO authenticated
  USING (EXISTS(SELECT 1 FROM public.agent_threads t WHERE t.id=thread_id AND t.user_id=auth.uid()))
  WITH CHECK (EXISTS(SELECT 1 FROM public.agent_threads t WHERE t.id=thread_id AND t.user_id=auth.uid()));

-- ============ AI-RELAYED SUPPORT TAG ============
ALTER TABLE public.support_threads
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'user';
-- origin: 'user' | 'ai_relay'

-- ============ updated_at triggers ============
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS schedule_events_touch ON public.schedule_events;
CREATE TRIGGER schedule_events_touch BEFORE UPDATE ON public.schedule_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS agent_threads_touch ON public.agent_threads;
CREATE TRIGGER agent_threads_touch BEFORE UPDATE ON public.agent_threads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

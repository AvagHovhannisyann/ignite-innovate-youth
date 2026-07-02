-- ============================================================
-- Combined one-shot setup for a fresh Supabase project.
-- Generated from supabase/migrations/*.sql (in order) plus the
-- storage buckets/policies that Lovable had created via tooling.
-- Paste into the Supabase dashboard SQL editor and run once.
-- ============================================================

-- ------------------------------------------------------------
-- 20260509104202_9a9b4c5b-55e9-4f8b-bcc4-ab7a48105d6b.sql
-- ------------------------------------------------------------

-- Roles enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  age INT,
  email TEXT,
  phone TEXT,
  school TEXT,
  bio TEXT,
  interests TEXT[] DEFAULT '{}',
  skills TEXT[] DEFAULT '{}',
  learning_areas TEXT[] DEFAULT '{}',
  goal TEXT,
  preferred_project_type TEXT,
  availability TEXT,
  level INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Recommendations cache (AI output per user)
CREATE TABLE public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  data JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own recs" ON public.recommendations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own recs" ON public.recommendations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own recs" ON public.recommendations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins read recs" ON public.recommendations FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Started projects (student-initiated)
CREATE TABLE public.started_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  short_description TEXT,
  full_description TEXT,
  matching_interests TEXT[] DEFAULT '{}',
  difficulty TEXT,
  team_size TEXT,
  first_steps JSONB DEFAULT '[]',
  progress INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.started_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own projects" ON public.started_projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own projects" ON public.started_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own projects" ON public.started_projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins view all projects" ON public.started_projects FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Opportunities (admin-managed but seeded; readable by all auth users)
CREATE TABLE public.opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  date DATE,
  duration TEXT,
  difficulty TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authed can view opportunities" ON public.opportunities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage opportunities" ON public.opportunities FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Participations (student joined an opportunity)
CREATE TABLE public.participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, opportunity_id)
);
ALTER TABLE public.participations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own participations" ON public.participations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users join opportunities" ON public.participations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all participations" ON public.participations FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Achievements
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge)
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own achievements" ON public.achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own achievements" ON public.achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all achievements" ON public.achievements FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Profile auto-creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), NEW.email);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed opportunities
INSERT INTO public.opportunities (title, category, description, duration, difficulty, tags) VALUES
('AI Intro Class', 'Technology', 'Learn the basics of artificial intelligence and how it shapes the future.', '2h', 'Beginner', ARRAY['artificial intelligence','technology']),
('Design Masterclass', 'Design', 'Hands-on session on visual design fundamentals and modern UI.', '3h', 'Intermediate', ARRAY['design','art']),
('Media Creation Workshop', 'Media', 'Create short videos and visual stories for social platforms.', '4h', 'Beginner', ARRAY['media','content creation','filmmaking']),
('Youth Business Discussion', 'Business', 'Open discussion on starting your first venture as a teenager.', '1.5h', 'Beginner', ARRAY['business','entrepreneurship']),
('Armenian History Research Club', 'History', 'Weekly club exploring Armenian historical narratives.', 'Recurring', 'Beginner', ARRAY['history','research']),
('Public Speaking Workshop', 'Communication', 'Build confidence on stage and in conversations.', '2h', 'Beginner', ARRAY['public speaking','leadership']),
('Environmental Action Day', 'Community', 'Hands-on cleanup and awareness in Ejmiatsin.', '5h', 'Beginner', ARRAY['environment','volunteering']),
('Startup Idea Lab', 'Innovation', 'Brainstorm and validate startup ideas with mentors.', '3h', 'Intermediate', ARRAY['entrepreneurship','innovation','business']),
('Photography Session', 'Art', 'Outdoor photography practice and composition basics.', '2h', 'Beginner', ARRAY['photography','art']),
('Community Leadership Meeting', 'Leadership', 'Plan upcoming youth-led initiatives together.', '1.5h', 'Intermediate', ARRAY['leadership','community service']);

-- ------------------------------------------------------------
-- 20260509104713_ccce9246-7fa8-4abd-8c29-68c568956fbd.sql
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;

-- ------------------------------------------------------------
-- 20260523131050_3269a694-db2e-4df7-a0fe-01326210ded9.sql
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
-- ------------------------------------------------------------
-- 20260527110339_2d0d095d-2d1b-4c2b-a1e1-444388f000b3.sql
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    email = COALESCE(public.profiles.email, EXCLUDED.email),
    updated_at = now();

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
-- ------------------------------------------------------------
-- 20260527110417_4e5362c3-e601-4078-b140-f995cf8dc124.sql
-- ------------------------------------------------------------
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
-- ------------------------------------------------------------
-- 20260527133825_a9e7b66e-ce77-48a9-a1c3-08f9c8f34dac.sql
-- ------------------------------------------------------------

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;
END $$;

CREATE POLICY "Users delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 20260627134109_a86317c0-1be4-4e5b-84e5-4441420ec51a.sql
-- ------------------------------------------------------------

-- ============ Catalog ============
CREATE TABLE public.quest_templates (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('activity','daily')),
  title text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'Sparkles',
  tint text NOT NULL DEFAULT 'purple',
  target int NOT NULL CHECK (target > 0),
  xp int NOT NULL CHECK (xp >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.quest_templates TO authenticated, anon;
GRANT ALL ON public.quest_templates TO service_role;
ALTER TABLE public.quest_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read active templates" ON public.quest_templates
  FOR SELECT USING (active = true);
CREATE POLICY "Admins manage templates" ON public.quest_templates
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ Per-user quest state ============
-- period_key: 'permanent' for activity quests, ISO date 'YYYY-MM-DD' for daily
CREATE TABLE public.user_quests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id text NOT NULL REFERENCES public.quest_templates(id) ON DELETE CASCADE,
  period_key text NOT NULL DEFAULT 'permanent',
  progress int NOT NULL DEFAULT 0,
  awarded boolean NOT NULL DEFAULT false,
  awarded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, template_id, period_key)
);
CREATE INDEX user_quests_user_idx ON public.user_quests(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_quests TO authenticated;
GRANT ALL ON public.user_quests TO service_role;
ALTER TABLE public.user_quests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own quest state" ON public.user_quests
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own quest state" ON public.user_quests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own quest state" ON public.user_quests
  FOR UPDATE USING (auth.uid() = user_id);

-- ============ Daily reroll tracker ============
CREATE TABLE public.user_quest_rerolls (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  used int NOT NULL DEFAULT 0,
  seed int NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_quest_rerolls TO authenticated;
GRANT ALL ON public.user_quest_rerolls TO service_role;
ALTER TABLE public.user_quest_rerolls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rerolls" ON public.user_quest_rerolls
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ Reward claims ============
CREATE TABLE public.reward_claims (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level int NOT NULL,
  reward text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, level)
);
GRANT SELECT, INSERT ON public.reward_claims TO authenticated;
GRANT ALL ON public.reward_claims TO service_role;
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own claims" ON public.reward_claims
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own claims" ON public.reward_claims
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============ Functions ============

-- Advance progress for a (template, period). Caps at template.target.
CREATE OR REPLACE FUNCTION public.increment_quest_progress(
  _template_id text, _period text, _delta int DEFAULT 1
) RETURNS public.user_quests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _tgt int;
  _row public.user_quests;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT target INTO _tgt FROM public.quest_templates WHERE id = _template_id AND active = true;
  IF _tgt IS NULL THEN RAISE EXCEPTION 'unknown template %', _template_id; END IF;

  INSERT INTO public.user_quests (user_id, template_id, period_key, progress)
  VALUES (_uid, _template_id, _period, LEAST(GREATEST(_delta,0), _tgt))
  ON CONFLICT (user_id, template_id, period_key)
  DO UPDATE SET
    progress = LEAST(public.user_quests.progress + GREATEST(_delta,0), _tgt),
    updated_at = now()
  RETURNING * INTO _row;

  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.increment_quest_progress(text,text,int) TO authenticated;

-- Claim XP for a completed quest (idempotent per period).
CREATE OR REPLACE FUNCTION public.claim_quest(_template_id text, _period text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _tpl public.quest_templates;
  _row public.user_quests;
  _new_xp int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO _tpl FROM public.quest_templates WHERE id = _template_id AND active = true;
  IF _tpl.id IS NULL THEN RAISE EXCEPTION 'unknown template'; END IF;

  SELECT * INTO _row FROM public.user_quests
   WHERE user_id = _uid AND template_id = _template_id AND period_key = _period
   FOR UPDATE;
  IF _row.id IS NULL OR _row.progress < _tpl.target THEN
    RAISE EXCEPTION 'quest not complete';
  END IF;
  IF _row.awarded THEN
    RETURN jsonb_build_object('already', true, 'xp', 0);
  END IF;

  UPDATE public.user_quests SET awarded = true, awarded_at = now() WHERE id = _row.id;
  UPDATE public.profiles SET xp = COALESCE(xp,0) + _tpl.xp WHERE id = _uid
    RETURNING xp INTO _new_xp;

  RETURN jsonb_build_object('already', false, 'xp', _tpl.xp, 'total_xp', _new_xp);
END $$;
GRANT EXECUTE ON FUNCTION public.claim_quest(text,text) TO authenticated;

-- Consume a daily reroll; returns remaining count and new seed.
CREATE OR REPLACE FUNCTION public.use_daily_reroll(_max int DEFAULT 3)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.user_quest_rerolls;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  INSERT INTO public.user_quest_rerolls(user_id, day, used, seed)
  VALUES (_uid, CURRENT_DATE, 0, 1)
  ON CONFLICT (user_id, day) DO NOTHING;

  SELECT * INTO _row FROM public.user_quest_rerolls
   WHERE user_id = _uid AND day = CURRENT_DATE FOR UPDATE;
  IF _row.used >= _max THEN
    RETURN jsonb_build_object('ok', false, 'remaining', 0, 'seed', _row.seed);
  END IF;

  UPDATE public.user_quest_rerolls
     SET used = used + 1, seed = seed + 1
   WHERE user_id = _uid AND day = CURRENT_DATE
   RETURNING * INTO _row;

  RETURN jsonb_build_object('ok', true, 'remaining', _max - _row.used, 'seed', _row.seed);
END $$;
GRANT EXECUTE ON FUNCTION public.use_daily_reroll(int) TO authenticated;

-- Claim a reward at a level milestone (idempotent).
CREATE OR REPLACE FUNCTION public.claim_level_reward(_level int, _min_xp int, _reward text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _xp int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT COALESCE(xp,0) INTO _xp FROM public.profiles WHERE id = _uid;
  IF _xp < _min_xp THEN RAISE EXCEPTION 'not enough xp'; END IF;

  INSERT INTO public.reward_claims(user_id, level, reward)
  VALUES (_uid, _level, _reward)
  ON CONFLICT (user_id, level) DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION public.claim_level_reward(int,int,text) TO authenticated;

-- ============ Seed quest catalog ============
INSERT INTO public.quest_templates(id,kind,title,description,icon,tint,target,xp) VALUES
  ('a-join','activity','Համայնքի որս','Միացիր 3 հնարավորության','Compass','blue',3,300),
  ('a-project','activity','Մեկնարկիչ','Սկսիր 1 նախագիծ','Rocket','purple',1,200),
  ('a-ai','activity','AI ստրատեգ','Ստեղծիր անհատական AI առաջարկներ','Lightbulb','yellow',1,150),
  ('a-profile','activity','Պատրաստ պրոֆիլ','Լրացրու պրոֆիլի 4 դաշտը','Star','pink',4,100),
  ('d-explore-3','daily','Բացահայտիր','Դիտիր 3 նոր հնարավորություն','Compass','blue',3,80),
  ('d-ai-ideas','daily','AI մտքեր','Թարմացրու AI առաջարկները','Sparkles','purple',1,60),
  ('d-share','daily','Կիսվիր','Պատմիր ընկերոջը հարթակի մասին','Users','pink',1,50),
  ('d-lesson','daily','Սովորիր','Դիտիր մեկ մաստեր-դաս','GraduationCap','yellow',1,70),
  ('d-streak','daily','Շարունակական','Մուտք գործիր 2 օր անընդմեջ','Flame','pink',2,90),
  ('d-event','daily','Միջոցառման որս','Նշիր 1 հետաքրքիր միջոցառում','Calendar','blue',1,60)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 20260627134122_e96f7506-df4a-47ea-b5b5-3a788b6f008a.sql
-- ------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.increment_quest_progress(text,text,int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_quest(text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.use_daily_reroll(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_level_reward(int,int,text) FROM PUBLIC;

-- ------------------------------------------------------------
-- 20260627183323_b4619533-9c5d-46cf-a1f8-cffe25bd3cdf.sql
-- ------------------------------------------------------------
DELETE FROM public.opportunities
WHERE title IN (
  'AI Intro Class',
  'Design Masterclass',
  'Media Creation Workshop',
  'Youth Business Discussion',
  'Armenian History Research Club',
  'Public Speaking Workshop',
  'Environmental Action Day',
  'Startup Idea Lab',
  'Photography Session',
  'Community Leadership Meeting'
);
-- ------------------------------------------------------------
-- 20260627184641_c9e95af0-ff65-4e4d-bc0c-7a1afb54b1ce.sql
-- ------------------------------------------------------------

-- Post moderation status enum
CREATE TYPE public.post_status AS ENUM ('pending', 'approved', 'rejected');

-- Posts table
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  content text NOT NULL DEFAULT '',
  media_urls text[] NOT NULL DEFAULT '{}',
  media_types text[] NOT NULL DEFAULT '{}',
  tags text[] NOT NULL DEFAULT '{}',
  location text,
  status public.post_status NOT NULL DEFAULT 'pending',
  rejection_reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read approved posts"
  ON public.posts FOR SELECT TO authenticated
  USING (status = 'approved' OR author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can create their own posts"
  ON public.posts FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "Users can edit their own posts (resets to pending)"
  ON public.posts FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can delete their own posts"
  ON public.posts FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX posts_status_created_at_idx ON public.posts (status, created_at DESC);
CREATE INDEX posts_author_idx ON public.posts (author_id, created_at DESC);

-- Likes
CREATE TABLE public.post_likes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read likes" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users like as themselves" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users unlike themselves" ON public.post_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Comments
CREATE TABLE public.post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read comments on approved posts"
  ON public.post_comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND (p.status = 'approved' OR p.author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Users comment as themselves on approved posts"
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.status = 'approved'));
CREATE POLICY "Users delete own comments"
  ON public.post_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX post_comments_post_idx ON public.post_comments (post_id, created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.posts_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  -- If author edits a rejected post, send it back to pending
  IF TG_OP = 'UPDATE' AND OLD.status = 'rejected' AND (NEW.content IS DISTINCT FROM OLD.content OR NEW.title IS DISTINCT FROM OLD.title OR NEW.media_urls IS DISTINCT FROM OLD.media_urls OR NEW.tags IS DISTINCT FROM OLD.tags OR NEW.location IS DISTINCT FROM OLD.location) AND NEW.status = OLD.status THEN
    NEW.status = 'pending';
    NEW.rejection_reason = NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.posts_set_updated_at();

-- Moderation RPC
CREATE OR REPLACE FUNCTION public.moderate_post(_post_id uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS public.posts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.posts;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'admin required'; END IF;
  UPDATE public.posts
     SET status = CASE WHEN _approve THEN 'approved'::public.post_status ELSE 'rejected'::public.post_status END,
         rejection_reason = CASE WHEN _approve THEN NULL ELSE _reason END,
         reviewed_by = _uid,
         reviewed_at = now(),
         approved_at = CASE WHEN _approve THEN now() ELSE approved_at END
   WHERE id = _post_id
   RETURNING * INTO _row;

  INSERT INTO public.notifications (user_id, title, body, type, link)
  VALUES (
    _row.author_id,
    CASE WHEN _approve THEN 'Քո գրառումը հաստատվեց' ELSE 'Քո գրառումը մերժվեց' END,
    CASE WHEN _approve THEN 'Այն այժմ տեսանելի է հանրային ֆիդում։' ELSE COALESCE(_reason, 'Մերժման պատճառ նշված չէ։') END,
    CASE WHEN _approve THEN 'post_approved' ELSE 'post_rejected' END,
    '/profile?tab=posts'
  );

  RETURN _row;
END $$;
GRANT EXECUTE ON FUNCTION public.moderate_post(uuid, boolean, text) TO authenticated;

-- ------------------------------------------------------------
-- 20260627184706_0821b7a5-bce3-4eb7-b164-6f61458fd79b.sql
-- ------------------------------------------------------------

CREATE POLICY "Authenticated can read post media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'post-media');
CREATE POLICY "Users upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ------------------------------------------------------------
-- 20260627184738_544a2cf5-a2de-4b2b-9f90-f0c6a7b009bd.sql
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.moderate_post(_post_id uuid, _approve boolean, _reason text DEFAULT NULL)
RETURNS public.posts LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.posts;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF NOT public.has_role(_uid, 'admin') THEN RAISE EXCEPTION 'admin required'; END IF;
  UPDATE public.posts
     SET status = CASE WHEN _approve THEN 'approved'::public.post_status ELSE 'rejected'::public.post_status END,
         rejection_reason = CASE WHEN _approve THEN NULL ELSE _reason END,
         reviewed_by = _uid,
         reviewed_at = now(),
         approved_at = CASE WHEN _approve THEN now() ELSE approved_at END
   WHERE id = _post_id
   RETURNING * INTO _row;

  INSERT INTO public.notifications (user_id, title, body, kind)
  VALUES (
    _row.author_id,
    CASE WHEN _approve THEN 'Քո գրառումը հաստատվեց' ELSE 'Քո գրառումը մերժվեց' END,
    CASE WHEN _approve THEN 'Այն այժմ տեսանելի է հանրային ֆիդում։' ELSE COALESCE(_reason, 'Մերժման պատճառ նշված չէ։') END,
    CASE WHEN _approve THEN 'success' ELSE 'warning' END
  );

  RETURN _row;
END $$;

-- ------------------------------------------------------------
-- 20260627190800_5cf573ae-6302-4feb-acae-f28a47495b11.sql
-- ------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
-- ------------------------------------------------------------
-- 20260628142138_f72ef985-4427-48b3-8efe-8e4b301ea31e.sql
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 20260628181333_bcf689ce-0848-44ca-93ff-6e85e38a6607.sql
-- ------------------------------------------------------------

-- Support threads
CREATE TABLE public.support_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL DEFAULT 'Աջակցության հարցում',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','answered','closed')),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.support_threads TO authenticated;
GRANT ALL ON public.support_threads TO service_role;

ALTER TABLE public.support_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own threads" ON public.support_threads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users create own threads" ON public.support_threads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins update threads" ON public.support_threads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE INDEX idx_support_threads_user ON public.support_threads(user_id, last_message_at DESC);
CREATE INDEX idx_support_threads_status ON public.support_threads(status, last_message_at DESC);

-- Support messages
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.support_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('user','admin')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view messages of own thread or admin" ON public.support_messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
  );

CREATE POLICY "send messages in own thread or as admin" ON public.support_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.support_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
    )
  );

CREATE INDEX idx_support_messages_thread ON public.support_messages(thread_id, created_at);

-- Trigger: bump thread last_message_at + status + notify the other side
CREATE OR REPLACE FUNCTION public.on_support_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _thread public.support_threads;
  _admin uuid;
BEGIN
  SELECT * INTO _thread FROM public.support_threads WHERE id = NEW.thread_id;

  UPDATE public.support_threads
     SET last_message_at = NEW.created_at,
         updated_at = now(),
         status = CASE
           WHEN NEW.sender_role = 'admin' THEN 'answered'
           WHEN NEW.sender_role = 'user' THEN 'open'
           ELSE status END
   WHERE id = NEW.thread_id;

  IF NEW.sender_role = 'admin' THEN
    -- notify thread owner
    INSERT INTO public.notifications (user_id, title, body, kind)
    VALUES (_thread.user_id, 'Աջակցության պատասխան', left(NEW.content, 140), 'info');
  ELSE
    -- notify all admins
    FOR _admin IN SELECT user_id FROM public.user_roles WHERE role = 'admin' LOOP
      INSERT INTO public.notifications (user_id, title, body, kind)
      VALUES (_admin, 'Նոր աջակցության հարցում', left(NEW.content, 140), 'info');
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER trg_support_message_after_insert
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.on_support_message();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_threads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;

-- ------------------------------------------------------------
-- 20260628185630_650c21c6-3be1-4602-b48a-8c3fcb077771.sql
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- 20260628190203_6e7715e4-00b0-4716-ba27-ff6104e1d6b0.sql
-- ------------------------------------------------------------

CREATE POLICY "qe own upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='quest-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "qe own read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='quest-evidence' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

-- ------------------------------------------------------------
-- Storage buckets (previously created via Lovable tooling).
-- All are private: the app reads files through signed URLs.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES
  ('post-media', 'post-media', false),
  ('project-media', 'project-media', false),
  ('quest-evidence', 'quest-evidence', false)
ON CONFLICT (id) DO NOTHING;

-- quest-evidence policies (post/project-media policies live in migrations):
-- students manage files inside their own {user_id}/ folder, admins can read all.
CREATE POLICY "quest evidence: own uploads" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quest-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "quest evidence: read own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'quest-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "quest evidence: admin read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'quest-evidence' AND public.has_role(auth.uid(), 'admin'));


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

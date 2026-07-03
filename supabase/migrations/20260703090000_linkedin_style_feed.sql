-- LinkedIn-style feed account setup and richer engagement primitives.
CREATE TABLE IF NOT EXISTS public.feed_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline text,
  about text,
  avatar_url text,
  banner_url text,
  website_url text,
  feed_topics text[] NOT NULL DEFAULT '{}',
  looking_for text[] NOT NULL DEFAULT '{}',
  setup_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feed_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_profiles TO authenticated;
GRANT ALL ON public.feed_profiles TO service_role;

DROP POLICY IF EXISTS "Authenticated can read feed profiles" ON public.feed_profiles;
CREATE POLICY "Authenticated can read feed profiles" ON public.feed_profiles FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users manage own feed profile" ON public.feed_profiles;
CREATE POLICY "Users manage own feed profile" ON public.feed_profiles FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.feed_follows (
  follower_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
ALTER TABLE public.feed_follows ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.feed_follows TO authenticated;
GRANT ALL ON public.feed_follows TO service_role;
DROP POLICY IF EXISTS "Authenticated can read follows" ON public.feed_follows;
CREATE POLICY "Authenticated can read follows" ON public.feed_follows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users manage own follows" ON public.feed_follows;
CREATE POLICY "Users manage own follows" ON public.feed_follows FOR ALL TO authenticated USING (follower_id = auth.uid()) WITH CHECK (follower_id = auth.uid());
CREATE INDEX IF NOT EXISTS feed_follows_following_idx ON public.feed_follows (following_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.post_saves (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE public.post_saves ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.post_saves TO authenticated;
GRANT ALL ON public.post_saves TO service_role;
DROP POLICY IF EXISTS "Authenticated can read saves" ON public.post_saves;
CREATE POLICY "Authenticated can read saves" ON public.post_saves FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users save as themselves" ON public.post_saves;
CREATE POLICY "Users save as themselves" ON public.post_saves FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users unsave themselves" ON public.post_saves;
CREATE POLICY "Users unsave themselves" ON public.post_saves FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.post_reposts (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.post_reposts TO authenticated;
GRANT ALL ON public.post_reposts TO service_role;
DROP POLICY IF EXISTS "Authenticated can read reposts" ON public.post_reposts;
CREATE POLICY "Authenticated can read reposts" ON public.post_reposts FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users repost as themselves" ON public.post_reposts;
CREATE POLICY "Users repost as themselves" ON public.post_reposts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users remove own repost" ON public.post_reposts;
CREATE POLICY "Users remove own repost" ON public.post_reposts FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'students' CHECK (visibility IN ('public', 'students', 'connections'));
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS dwell_ms bigint NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS posts_status_approved_at_idx ON public.posts (status, approved_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS posts_tags_idx ON public.posts USING gin (tags);

CREATE OR REPLACE FUNCTION public.feed_profiles_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS feed_profiles_updated_at ON public.feed_profiles;
CREATE TRIGGER feed_profiles_updated_at BEFORE UPDATE ON public.feed_profiles FOR EACH ROW EXECUTE FUNCTION public.feed_profiles_set_updated_at();

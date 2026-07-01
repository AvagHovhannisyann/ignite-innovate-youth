
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

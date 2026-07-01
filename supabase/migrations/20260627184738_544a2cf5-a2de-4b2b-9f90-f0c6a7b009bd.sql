
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

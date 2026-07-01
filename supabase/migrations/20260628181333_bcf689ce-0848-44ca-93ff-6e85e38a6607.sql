
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

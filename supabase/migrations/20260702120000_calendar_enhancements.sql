-- ============================================================
-- Calendar enhancements
--   - per-event reminders + recurrence
--   - honest updated_at
--   - auto-mirror joined opportunities into the personal calendar
-- Idempotent and purely additive: safe to run more than once (also lives in
-- combined-setup.sql). The unused schedule_events.ics_token column is left in
-- place (harmless, nullable) rather than dropped, so this migration never
-- destroys data.
-- ============================================================

ALTER TABLE public.schedule_events ADD COLUMN IF NOT EXISTS reminder_minutes int;
ALTER TABLE public.schedule_events ADD COLUMN IF NOT EXISTS recurrence text;

-- Keep updated_at accurate on every edit (drag/resize/edit-sheet all UPDATE).
CREATE OR REPLACE FUNCTION public.touch_schedule_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS schedule_events_touch ON public.schedule_events;
CREATE TRIGGER schedule_events_touch
  BEFORE UPDATE ON public.schedule_events
  FOR EACH ROW EXECUTE FUNCTION public.touch_schedule_updated_at();

-- Dedupe auto-fed events by their external source id.
CREATE UNIQUE INDEX IF NOT EXISTS schedule_events_external_uidx
  ON public.schedule_events(user_id, source, external_id)
  WHERE external_id IS NOT NULL;

-- When a student joins an opportunity that has a date, mirror it into their
-- calendar as a read-only all-day event; remove it when they leave.
CREATE OR REPLACE FUNCTION public.sync_participation_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _opp record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT id, title, description, date INTO _opp
      FROM public.opportunities WHERE id = NEW.opportunity_id;
    IF _opp.date IS NOT NULL THEN
      INSERT INTO public.schedule_events
        (user_id, title, description, starts_at, ends_at, kind, source, external_id, all_day)
      VALUES
        (NEW.user_id, _opp.title, _opp.description,
         _opp.date::timestamptz, (_opp.date + 1)::timestamptz,
         'opportunity', 'opportunity', _opp.id::text, true)
      ON CONFLICT (user_id, source, external_id) WHERE external_id IS NOT NULL
      DO NOTHING;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM public.schedule_events
      WHERE user_id = OLD.user_id
        AND source = 'opportunity'
        AND external_id = OLD.opportunity_id::text;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS participations_sync_event ON public.participations;
CREATE TRIGGER participations_sync_event
  AFTER INSERT OR DELETE ON public.participations
  FOR EACH ROW EXECUTE FUNCTION public.sync_participation_event();

-- Backfill: mirror existing joined opportunities that have a date.
INSERT INTO public.schedule_events
  (user_id, title, description, starts_at, ends_at, kind, source, external_id, all_day)
SELECT p.user_id, o.title, o.description,
       o.date::timestamptz, (o.date + 1)::timestamptz,
       'opportunity', 'opportunity', o.id::text, true
FROM public.participations p
JOIN public.opportunities o ON o.id = p.opportunity_id
WHERE o.date IS NOT NULL
ON CONFLICT (user_id, source, external_id) WHERE external_id IS NOT NULL
DO NOTHING;

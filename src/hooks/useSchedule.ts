import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fromRow, type CalEvent, type EventKind } from "@/lib/calendar";

export type EventDraft = {
  title: string;
  description?: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  kind: EventKind;
  location?: string | null;
  reminderMinutes?: number | null;
};

function toRow(userId: string, d: EventDraft) {
  const row: Record<string, unknown> = {
    user_id: userId,
    title: d.title,
    description: d.description || null,
    starts_at: d.start.toISOString(),
    ends_at: d.end.toISOString(),
    all_day: d.allDay,
    kind: d.kind,
    location: d.location || null,
    source: "manual",
  };
  // Only send reminder_minutes when set, so the app keeps working before the
  // calendar migration adds that column.
  if (d.reminderMinutes != null) row.reminder_minutes = d.reminderMinutes;
  return row;
}

/** Loads the user's events and exposes optimistic create/update/delete. */
export function useSchedule(userId: string | undefined) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("schedule_events")
      .select("*")
      .eq("user_id", userId)
      .order("starts_at");
    if (error) {
      setError(error.message);
      return;
    }
    setEvents((data || []).map(fromRow));
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("schedule_events")
        .select("*")
        .eq("user_id", userId)
        .order("starts_at");
      if (cancelled) return;
      if (error) setError(error.message);
      else setEvents((data || []).map(fromRow));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const create = useCallback(
    async (draft: EventDraft): Promise<CalEvent | null> => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("schedule_events")
        .insert(toRow(userId, draft) as any)
        .select()
        .single();
      if (error) throw error;
      const ev = fromRow(data);
      setEvents((p) => [...p, ev].sort((a, b) => a.start.getTime() - b.start.getTime()));
      return ev;
    },
    [userId],
  );

  /** Optimistic patch of start/end/etc; rolls back on failure. */
  const update = useCallback(
    async (id: string, patch: Partial<EventDraft>) => {
      const prev = events;
      const row: Record<string, unknown> = {};
      if (patch.title !== undefined) row.title = patch.title;
      if (patch.description !== undefined) row.description = patch.description || null;
      if (patch.start !== undefined) row.starts_at = patch.start.toISOString();
      if (patch.end !== undefined) row.ends_at = patch.end.toISOString();
      if (patch.allDay !== undefined) row.all_day = patch.allDay;
      if (patch.kind !== undefined) row.kind = patch.kind;
      if (patch.location !== undefined) row.location = patch.location || null;
      if (patch.reminderMinutes !== undefined && patch.reminderMinutes != null)
        row.reminder_minutes = patch.reminderMinutes;

      setEvents((list) =>
        list
          .map((e) =>
            e.id === id
              ? {
                  ...e,
                  ...(patch.title !== undefined ? { title: patch.title } : {}),
                  ...(patch.description !== undefined ? { description: patch.description ?? null } : {}),
                  ...(patch.start !== undefined ? { start: patch.start } : {}),
                  ...(patch.end !== undefined ? { end: patch.end } : {}),
                  ...(patch.allDay !== undefined ? { allDay: patch.allDay } : {}),
                  ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
                  ...(patch.location !== undefined ? { location: patch.location ?? null } : {}),
                  ...(patch.reminderMinutes !== undefined
                    ? { reminderMinutes: patch.reminderMinutes ?? null }
                    : {}),
                }
              : e,
          )
          .sort((a, b) => a.start.getTime() - b.start.getTime()),
      );

      const { error } = await supabase.from("schedule_events").update(row as any).eq("id", id);
      if (error) {
        setEvents(prev); // rollback
        throw error;
      }
    },
    [events],
  );

  /** Optimistic delete; returns a restore fn for undo. */
  const remove = useCallback(
    async (id: string): Promise<() => Promise<void>> => {
      const target = events.find((e) => e.id === id);
      setEvents((list) => list.filter((e) => e.id !== id));
      const { error } = await supabase.from("schedule_events").delete().eq("id", id);
      if (error) {
        if (target) setEvents((list) => [...list, target].sort((a, b) => a.start.getTime() - b.start.getTime()));
        throw error;
      }
      return async () => {
        if (!target || !userId) return;
        const { data } = await supabase
          .from("schedule_events")
          .insert(
            toRow(userId, {
              title: target.title,
              description: target.description,
              start: target.start,
              end: target.end,
              allDay: target.allDay,
              kind: target.kind,
              location: target.location,
              reminderMinutes: target.reminderMinutes,
            }) as any,
          )
          .select()
          .single();
        if (data) setEvents((list) => [...list, fromRow(data)].sort((a, b) => a.start.getTime() - b.start.getTime()));
      };
    },
    [events, userId],
  );

  return { events, loading, error, reload, create, update, remove, setEvents };
}

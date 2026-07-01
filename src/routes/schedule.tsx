import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  Plus,
  Calendar as CalIcon,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Loader2,
} from "lucide-react";

export const Route = createFileRoute("/schedule")({ component: SchedulePage });

type Event = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  location: string | null;
  kind: string;
  source: string;
};

const KIND_COLOR: Record<string, string> = {
  study: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  project: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
  meeting: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  quest: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  other: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
};

function startOfWeek(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x;
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat("hy-AM", { timeZone: "Asia/Yerevan", ...options }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatDayKey(date: Date) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Yerevan",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function formatDayNumber(date: Date) {
  return formatDate(date, { day: "numeric" });
}

function todayInputValue() {
  return formatDayKey(new Date());
}

function SchedulePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [icsToken, setIcsToken] = useState<string>("");
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    setWeekStart(startOfWeek(new Date()));
    setOrigin(window.location.origin);
  }, []);

  // Close the add-event dialog with Escape.
  useEffect(() => {
    if (!showAdd) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowAdd(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showAdd]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    (async () => {
      try {
        const [{ data: ev, error: eventsError }, { data: profile, error: profileError }] =
          await Promise.all([
            supabase.from("schedule_events").select("*").eq("user_id", user.id).order("starts_at"),
            supabase.from("profiles").select("ics_token").eq("id", user.id).maybeSingle(),
          ]);
        if (eventsError) console.error(eventsError);
        if (profileError) console.error(profileError);
        setEvents((ev || []) as any);
        setIcsToken(profile?.ics_token || "");
      } catch (e) {
        console.error(e);
        setEvents([]);
      } finally {
        setBusy(false);
      }
    })();
  }, [user, loading, nav]);

  const days = useMemo(
    () =>
      weekStart
        ? Array.from({ length: 7 }, (_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            return d;
          })
        : [],
    [weekStart],
  );
  const weekEvents = useMemo(
    () =>
      events.filter((e) => {
        if (!weekStart) return false;
        const s = new Date(e.starts_at).getTime();
        const end = weekStart.getTime() + 7 * 86400000;
        return s >= weekStart.getTime() && s < end;
      }),
    [events, weekStart],
  );

  async function addEvent(form: FormData) {
    const title = String(form.get("title") || "").trim();
    const date = String(form.get("date") || "");
    const start = String(form.get("start") || "");
    const end = String(form.get("end") || "");
    const kind = String(form.get("kind") || "other");
    const location = String(form.get("location") || "");
    if (!title || !date || !start || !end) return;
    const { data, error } = await supabase
      .from("schedule_events")
      .insert({
        user_id: user!.id,
        title,
        kind,
        location: location || null,
        starts_at: new Date(`${date}T${start}`).toISOString(),
        ends_at: new Date(`${date}T${end}`).toISOString(),
        source: "manual",
      })
      .select()
      .single();
    if (error) {
      toast.error("Չհաջողվեց պահպանել իրադարձությունը");
      return;
    }
    setEvents((p) => [...p, data as any].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    setShowAdd(false);
    toast.success("Իրադարձությունն ավելացվեց");
  }

  // Optimistic delete with undo: remove immediately, restore on error or undo.
  async function deleteEvent(id: string) {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    const restore = () =>
      setEvents((p) => [...p, ev].sort((a, b) => a.starts_at.localeCompare(b.starts_at)));
    setEvents((p) => p.filter((e) => e.id !== id));
    const { error } = await supabase.from("schedule_events").delete().eq("id", id);
    if (error) {
      restore();
      toast.error("Չհաջողվեց ջնջել");
      return;
    }
    toast("Իրադարձությունը ջնջվեց", {
      action: {
        label: "Վերադարձնել",
        onClick: async () => {
          const { data } = await supabase
            .from("schedule_events")
            .insert({
              user_id: user!.id,
              title: ev.title,
              description: ev.description,
              starts_at: ev.starts_at,
              ends_at: ev.ends_at,
              location: ev.location,
              kind: ev.kind,
              source: ev.source,
            })
            .select()
            .single();
          if (data)
            setEvents((p) =>
              [...p, data as any].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
            );
          else toast.error("Չհաջողվեց վերադարձնել");
        },
      },
    });
  }

  const icsUrl = icsToken && origin ? `${origin}/api/public/ics/${icsToken}.ics` : "";

  if (loading || !weekStart) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Բեռնվում է…
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto p-3 sm:p-6 pb-24 md:pb-6 space-y-4 min-w-0 overflow-x-hidden">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setWeekStart((w) => {
                  const d = new Date(w!);
                  d.setDate(d.getDate() - 7);
                  return d;
                })
              }
              className="min-w-[44px] min-h-[44px] grid place-items-center rounded-lg hover:bg-secondary text-sm"
              aria-label="Նախորդ շաբաթ"
            >
              ‹
            </button>
            <div className="text-sm font-medium">
              {formatDate(weekStart, { day: "numeric", month: "long" })} –{" "}
              {formatDate(new Date(weekStart.getTime() + 6 * 86400000), {
                day: "numeric",
                month: "long",
              })}
            </div>
            <button
              onClick={() =>
                setWeekStart((w) => {
                  const d = new Date(w!);
                  d.setDate(d.getDate() + 7);
                  return d;
                })
              }
              className="min-w-[44px] min-h-[44px] grid place-items-center rounded-lg hover:bg-secondary text-sm"
              aria-label="Հաջորդ շաբաթ"
            >
              ›
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="px-3 min-h-[44px] rounded-lg hover:bg-secondary text-sm"
            >
              Այսօր
            </button>
          </div>
          <div className="flex gap-2">
            {icsUrl && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(icsUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/70 text-sm"
                title="Բաժանորդագրման հղում օրացույցի համար"
              >
                {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {copied ? "Պատճենված է" : "Բաժանորդագրվել"}
                </span>
              </button>
            )}
            <button
              disabled
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary text-muted-foreground text-sm opacity-60 cursor-not-allowed"
              title="Շուտով՝ ադմինը պետք է կարգավորի Google OAuth"
            >
              <ExternalLink className="w-4 h-4" /> Google Calendar
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> Ավելացնել
            </button>
          </div>
        </div>

        {busy ? (
          <div className="flex items-center justify-center h-60 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Բեռնվում է…
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {days.map((d) => {
              const dayKey = formatDayKey(d);
              const dayEvents = weekEvents.filter(
                (e) => formatDayKey(new Date(e.starts_at)) === dayKey,
              );
              const isToday = dayKey === formatDayKey(new Date());
              return (
                <div
                  key={d.toISOString()}
                  className={`card-base p-2 min-h-[200px] ${isToday ? "ring-2 ring-primary/40" : ""}`}
                >
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {formatDate(d, { weekday: "short" })}
                  </div>
                  <div className="text-lg font-semibold mb-2">{formatDayNumber(d)}</div>
                  <div className="space-y-1.5">
                    {dayEvents.length === 0 && (
                      <div className="text-xs text-muted-foreground/60">—</div>
                    )}
                    {dayEvents.map((e) => (
                      <div
                        key={e.id}
                        className={`group rounded-lg border p-2 text-xs ${KIND_COLOR[e.kind] || KIND_COLOR.other}`}
                      >
                        <div className="font-medium truncate">{e.title}</div>
                        <div className="opacity-80">
                          {formatDate(new Date(e.starts_at), {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                        {e.location && <div className="opacity-70 truncate">📍 {e.location}</div>}
                        <button
                          onClick={() => deleteEvent(e.id)}
                          className="opacity-0 group-hover:opacity-100 mt-1 inline-flex items-center gap-1 text-[10px] hover:underline"
                        >
                          <Trash2 className="w-3 h-3" /> ջնջել
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {icsUrl && (
          <div className="card-base p-3 text-xs text-muted-foreground">
            <CalIcon className="w-3.5 h-3.5 inline mr-1" />
            Բաժանորդագրման հղում Google/Apple/Outlook օրացույցների համար.{" "}
            <code className="bg-secondary px-1 rounded">{icsUrl}</code>
          </div>
        )}
      </div>

      {showAdd && (
        <div
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
          onClick={() => setShowAdd(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              addEvent(new FormData(e.currentTarget));
            }}
            className="bg-background rounded-2xl p-5 w-full max-w-md space-y-3 shadow-xl"
          >
            <h3 className="font-semibold text-lg">Նոր իրադարձություն</h3>
            <input
              name="title"
              required
              placeholder="Վերնագիր"
              className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/40"
            />
            <div className="grid grid-cols-3 gap-2">
              <input
                name="date"
                type="date"
                required
                defaultValue={todayInputValue()}
                className="px-3 py-2 rounded-lg border border-border bg-secondary/40 text-sm"
              />
              <input
                name="start"
                type="time"
                required
                defaultValue="09:00"
                className="px-3 py-2 rounded-lg border border-border bg-secondary/40 text-sm"
              />
              <input
                name="end"
                type="time"
                required
                defaultValue="10:00"
                className="px-3 py-2 rounded-lg border border-border bg-secondary/40 text-sm"
              />
            </div>
            <select
              name="kind"
              defaultValue="study"
              className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/40"
            >
              <option value="study">Ուսում</option>
              <option value="project">Նախագիծ</option>
              <option value="meeting">Հանդիպում</option>
              <option value="quest">Քվեստ</option>
              <option value="other">Այլ</option>
            </select>
            <input
              name="location"
              placeholder="Վայր (ոչ պարտադիր)"
              className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/40"
            />
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="px-3 py-2 rounded-lg hover:bg-secondary text-sm"
              >
                Չեղարկել
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
              >
                Պահպանել
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSchedule, type EventDraft } from "@/hooks/useSchedule";
import { toast } from "sonner";
import {
  addDays,
  fmtDayMonth,
  fmtFullDate,
  fmtMonthYear,
  startOfWeek,
  weekDays,
  KIND_META,
  KIND_ORDER,
  type CalEvent,
} from "@/lib/calendar";
import { TimeGrid } from "@/components/calendar/TimeGrid";
import { MonthView } from "@/components/calendar/MonthView";
import { AgendaView } from "@/components/calendar/AgendaView";
import { EventSheet, type SheetTarget } from "@/components/calendar/EventSheet";
import { SubscribeMenu } from "@/components/calendar/SubscribeMenu";
import { ChevronLeft, ChevronRight, Plus, Loader2, Link2 } from "lucide-react";

export const Route = createFileRoute("/schedule")({ component: SchedulePage });

type View = "month" | "week" | "day" | "agenda";
const VIEW_LABEL: Record<View, string> = {
  month: "Ամիս",
  week: "Շաբաթ",
  day: "Օր",
  agenda: "Ցուցակ",
};

function SchedulePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const isMobile = useIsMobile();
  const { events, loading: eventsLoading, create, update, remove } = useSchedule(user?.id);

  const [view, setView] = useState<View>("week");
  const [viewTouched, setViewTouched] = useState(false);
  const [anchor, setAnchor] = useState(() => new Date());
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [icsToken, setIcsToken] = useState("");
  const [origin, setOrigin] = useState("");
  const [googleStatus, setGoogleStatus] = useState<
    "unknown" | "available" | "connected" | "unconfigured"
  >("unknown");
  const jumpRef = useRef<HTMLInputElement>(null);

  // Default to the agenda view on phones (until the user picks one).
  useEffect(() => {
    if (!viewTouched) setView(isMobile ? "agenda" : "week");
  }, [isMobile, viewTouched]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    supabase
      .from("profiles")
      .select("ics_token")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setIcsToken(data?.ics_token || ""));
    // Feature-detect the Google Calendar integration (Phase 4, flagged by env).
    supabase.auth.getSession().then(({ data }) => {
      const jwt = data.session?.access_token;
      fetch("/api/google/status", {
        headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined,
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) =>
          setGoogleStatus(
            d?.connected ? "connected" : d?.configured ? "available" : "unconfigured",
          ),
        )
        .catch(() => setGoogleStatus("unconfigured"));
    });
    // Toast on return from the Google consent flow.
    const g = new URLSearchParams(window.location.search).get("google");
    if (g === "connected") toast.success("Google Calendar-ը միացված է");
    else if (g === "error") toast.error("Google Calendar-ի միացումը չհաջողվեց");
    if (g) window.history.replaceState({}, "", "/schedule");
  }, [user, loading, nav]);

  async function connectGoogle() {
    const { data } = await supabase.auth.getSession();
    const jwt = data.session?.access_token;
    if (!jwt) return;
    const res = await fetch("/api/google/connect", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) {
      toast.error("Google Calendar-ը դեռ կարգավորված չէ");
      return;
    }
    const { url } = await res.json();
    if (url) window.location.href = url;
  }

  // Keyboard shortcuts: t=today, n=new, ←/→ navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el && /INPUT|TEXTAREA|SELECT/.test(el.tagName)) return;
      if (e.key === "t") setAnchor(new Date());
      else if (e.key === "n") openCreate(new Date(new Date().setMinutes(0, 0, 0)));
      else if (e.key === "ArrowLeft") shift(-1);
      else if (e.key === "ArrowRight") shift(1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const days = useMemo(() => {
    if (view === "week") return weekDays(anchor);
    if (view === "day") return [anchor];
    return [];
  }, [view, anchor]);

  const title = useMemo(() => {
    if (view === "month") return fmtMonthYear(anchor);
    if (view === "day") return fmtFullDate(anchor);
    if (view === "week") {
      const s = startOfWeek(anchor);
      return `${fmtDayMonth(s)} – ${fmtDayMonth(addDays(s, 6))}`;
    }
    return "Առաջիկա";
  }, [view, anchor]);

  function shift(dir: number) {
    setAnchor((a) => {
      if (view === "month") {
        const d = new Date(a);
        d.setMonth(d.getMonth() + dir);
        return d;
      }
      if (view === "week") return addDays(a, dir * 7);
      if (view === "day") return addDays(a, dir);
      return addDays(a, dir * 7);
    });
  }

  function openCreate(start: Date, end?: Date, allDay?: boolean) {
    setSheet({ mode: "create", start, end: end || new Date(start.getTime() + 60 * 60000), allDay });
  }

  async function onSave(draft: EventDraft, id?: string) {
    try {
      if (id) {
        await update(id, draft);
        toast.success("Պահպանված է");
      } else {
        await create(draft);
        toast.success("Իրադարձությունն ավելացվեց");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Չհաջողվեց պահպանել");
      throw e;
    }
  }

  async function onDelete(id: string) {
    try {
      const restore = await remove(id);
      toast("Իրադարձությունը ջնջվեց", {
        action: { label: "Վերադարձնել", onClick: () => void restore() },
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Չհաջողվեց ջնջել");
    }
  }

  async function onDragUpdate(id: string, patch: { start: Date; end: Date }) {
    try {
      await update(id, patch);
    } catch (e: any) {
      toast.error(e?.message ?? "Չհաջողվեց տեղափոխել");
    }
  }

  const icsUrl = icsToken && origin ? `${origin}/api/public/ics/${icsToken}.ics` : "";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Բեռնվում է…
      </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto p-3 sm:p-6 pb-24 md:pb-6 space-y-3 min-w-0 overflow-x-hidden">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              onClick={() => shift(-1)}
              className="min-w-[40px] min-h-[40px] grid place-items-center rounded-lg hover:bg-secondary"
              aria-label="Նախորդ"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => shift(1)}
              className="min-w-[40px] min-h-[40px] grid place-items-center rounded-lg hover:bg-secondary"
              aria-label="Հաջորդ"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setAnchor(new Date())}
              className="px-3 min-h-[40px] rounded-lg hover:bg-secondary text-sm font-medium"
            >
              Այսօր
            </button>
            <h1 className="font-display text-lg sm:text-xl font-semibold ml-1 truncate min-w-0">
              {title}
            </h1>
            {/* hidden jump-to-date */}
            <div className="relative">
              <button
                onClick={() => jumpRef.current?.showPicker?.()}
                className="min-w-[40px] min-h-[40px] grid place-items-center rounded-lg hover:bg-secondary"
                aria-label="Ընտրել ամսաթիվ"
              >
                <Link2 className="w-4 h-4 rotate-45 opacity-0 absolute" />
                📅
              </button>
              <input
                ref={jumpRef}
                type="date"
                className="absolute inset-0 opacity-0 w-0 h-0"
                onChange={(e) => e.target.value && setAnchor(new Date(e.target.value + "T00:00"))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="hidden sm:flex items-center rounded-lg border border-border p-0.5 bg-card">
              {(["month", "week", "day", "agenda"] as View[]).map((v) => (
                <button
                  key={v}
                  onClick={() => {
                    setView(v);
                    setViewTouched(true);
                  }}
                  className={`px-2.5 min-h-[36px] rounded-md text-xs font-medium transition-colors ${
                    view === v ? "bg-primary text-primary-foreground" : "hover:bg-secondary"
                  }`}
                >
                  {VIEW_LABEL[v]}
                </button>
              ))}
            </div>
            <select
              value={view}
              onChange={(e) => {
                setView(e.target.value as View);
                setViewTouched(true);
              }}
              className="sm:hidden px-2 min-h-[40px] rounded-lg border border-border bg-card text-sm"
            >
              {(["agenda", "day", "week", "month"] as View[]).map((v) => (
                <option key={v} value={v}>
                  {VIEW_LABEL[v]}
                </option>
              ))}
            </select>

            <SubscribeMenu httpsUrl={icsUrl} />
            {googleStatus === "available" && (
              <button
                onClick={connectGoogle}
                className="hidden md:inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg bg-secondary hover:bg-secondary/70 text-sm"
              >
                <span>📅</span> Google
              </button>
            )}
            {googleStatus === "connected" && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg bg-success/10 text-success text-sm">
                <span>📅</span> Google ✓
              </span>
            )}
            <button
              onClick={() => openCreate(new Date(new Date().setMinutes(0, 0, 0)))}
              className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
            >
              <Plus className="w-4 h-4" /> <span className="hidden min-[420px]:inline">Ավելացնել</span>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {KIND_ORDER.map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={`w-2 h-2 rounded-full ${KIND_META[k].dot}`} /> {KIND_META[k].label}
            </span>
          ))}
        </div>

        {/* Views */}
        {eventsLoading ? (
          <div className="flex items-center justify-center h-60 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Բեռնվում է…
          </div>
        ) : view === "month" ? (
          <MonthView
            anchor={anchor}
            events={events}
            onOpen={(e) => setSheet({ mode: "edit", event: e })}
            onCreateOnDay={(day) => openCreate(new Date(new Date(day).setHours(9, 0, 0, 0)))}
            onPickDay={(day) => {
              setAnchor(day);
              setView("day");
              setViewTouched(true);
            }}
          />
        ) : view === "agenda" ? (
          <AgendaView
            anchor={anchor}
            events={events}
            onOpen={(e) => setSheet({ mode: "edit", event: e })}
            onCreateOnDay={(day) => openCreate(new Date(new Date(day).setHours(9, 0, 0, 0)))}
          />
        ) : (
          <TimeGrid
            days={days}
            events={events}
            onCreate={(s, e) => openCreate(s, e)}
            onUpdate={onDragUpdate}
            onOpen={(e) => setSheet({ mode: "edit", event: e })}
          />
        )}

        {googleStatus === "unconfigured" && (
          <p className="text-[11px] text-muted-foreground">
            💡 Խորհուրդ․ սեղմիր «Բաժանորդագրվել»՝ այս օրացույցը Google/Apple/Outlook-ում ավտոմատ
            համաժամեցնելու համար։
          </p>
        )}
      </div>

      <EventSheet target={sheet} onClose={() => setSheet(null)} onSave={onSave} onDelete={onDelete} />
    </>
  );
}

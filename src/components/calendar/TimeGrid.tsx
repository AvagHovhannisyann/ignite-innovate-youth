import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addDays,
  allDayEventsForDay,
  dayKey,
  fmtTime,
  fmtWeekday,
  isToday,
  KIND_META,
  layoutDay,
  minutesSinceMidnight,
  snapMinutes,
  startOfDay,
  timedEventsForDay,
  isReadOnly,
  type CalEvent,
} from "@/lib/calendar";

const HOUR_H = 48; // px per hour
const DAY_MIN = 24 * 60;
const GRID_H = 24 * HOUR_H;

type DragState = null | {
  mode: "create" | "move" | "resize";
  id?: string;
  dayIndex: number;
  startMin: number;
  endMin: number;
  grabOffsetMin?: number; // for move: pointer offset from event start
  moved: boolean;
};

export function TimeGrid({
  days,
  events,
  onCreate,
  onUpdate,
  onOpen,
  onOpenAllDay,
}: {
  days: Date[];
  events: CalEvent[];
  onCreate: (start: Date, end: Date) => void;
  onUpdate: (id: string, patch: { start: Date; end: Date }) => void;
  onOpen: (e: CalEvent) => void;
  onOpenAllDay?: (day: Date) => void;
}) {
  const colsRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState>(null);
  // Whether the last completed gesture actually dragged — the trailing click
  // event fires after `drag` is reset, so a state flag can't suppress it.
  const didDragRef = useRef(false);
  const [, force] = useState(0);

  // Auto-scroll so ~7:00 is near the top on first mount.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_H - 8;
  }, []);

  // Re-render the "now" line every minute.
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 60000);
    return () => clearInterval(t);
  }, []);

  const pointerMinutes = useCallback((clientY: number): number => {
    // colsRef sits inside the scroll container, so its rect is already
    // scroll-adjusted (viewport-relative).
    const rect = colsRef.current!.getBoundingClientRect();
    const y = clientY - rect.top;
    const raw = (y / GRID_H) * DAY_MIN;
    return Math.max(0, Math.min(DAY_MIN, snapMinutes(raw)));
  }, []);
  const pointerDayIndex = useCallback(
    (clientX: number): number => {
      const el = colsRef.current!;
      const rect = el.getBoundingClientRect();
      const w = rect.width / days.length;
      return Math.max(0, Math.min(days.length - 1, Math.floor((clientX - rect.left) / w)));
    },
    [days.length],
  );

  // ---- gesture lifecycle ----
  useEffect(() => {
    if (!drag) return;
    function move(e: PointerEvent) {
      setDrag((d) => {
        if (!d) return d;
        const min = pointerMinutes(e.clientY);
        if (d.mode === "create") {
          return { ...d, endMin: Math.max(min, d.startMin + 15), moved: true };
        }
        if (d.mode === "resize") {
          return { ...d, endMin: Math.max(min, d.startMin + 15), moved: true };
        }
        // move
        const dur = d.endMin - d.startMin;
        let s = min - (d.grabOffsetMin ?? 0);
        s = Math.max(0, Math.min(DAY_MIN - dur, snapMinutes(s)));
        const di = days.length > 1 ? pointerDayIndex(e.clientX) : d.dayIndex;
        return { ...d, startMin: s, endMin: s + dur, dayIndex: di, moved: true };
      });
    }
    function up() {
      setDrag((d) => {
        if (!d) return null;
        didDragRef.current = d.moved;
        const day = startOfDay(days[d.dayIndex]);
        const start = new Date(day.getTime() + d.startMin * 60000);
        const end = new Date(day.getTime() + d.endMin * 60000);
        if (d.mode === "create") {
          onCreate(start, end);
        } else if (d.id && d.moved) {
          // a click without movement is handled by onClick → onOpen
          onUpdate(d.id, { start, end });
        }
        return null;
      });
    }
    function cancel() {
      // touch scroll took over — abandon the gesture without committing
      didDragRef.current = false;
      setDrag(null);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
    };
  }, [drag, days, onCreate, onUpdate, pointerDayIndex, pointerMinutes]);

  function startCreate(e: React.PointerEvent, dayIndex: number) {
    if (e.button !== 0) return;
    const min = pointerMinutes(e.clientY);
    setDrag({ mode: "create", dayIndex, startMin: min, endMin: min + 60, moved: false });
  }
  function startMove(e: React.PointerEvent, ev: CalEvent, dayIndex: number) {
    e.stopPropagation();
    if (isReadOnly(ev)) {
      onOpen(ev);
      return;
    }
    const s = minutesSinceMidnight(ev.start);
    const eMin = Math.min(DAY_MIN, s + Math.round((ev.end.getTime() - ev.start.getTime()) / 60000));
    const grab = pointerMinutes(e.clientY) - s;
    setDrag({
      mode: "move",
      id: ev.id,
      dayIndex,
      startMin: s,
      endMin: eMin,
      grabOffsetMin: grab,
      moved: false,
    });
  }
  function startResize(e: React.PointerEvent, ev: CalEvent, dayIndex: number) {
    e.stopPropagation();
    const s = minutesSinceMidnight(ev.start);
    const eMin = Math.min(DAY_MIN, s + Math.round((ev.end.getTime() - ev.start.getTime()) / 60000));
    setDrag({ mode: "resize", id: ev.id, dayIndex, startMin: s, endMin: eMin, moved: false });
  }

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const nowMin = minutesSinceMidnight(new Date());
  const maxAllDay = Math.max(0, ...days.map((d) => allDayEventsForDay(events, d).length));

  return (
    <div className="card-base overflow-hidden">
      {/* Header: weekday labels */}
      <div
        className="grid border-b border-border"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
      >
        <div />
        {days.map((d) => (
          <div
            key={dayKey(d)}
            className={`py-2 text-center border-l border-border ${isToday(d) ? "bg-primary/5" : ""}`}
          >
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {fmtWeekday(d)}
            </div>
            <div
              className={`text-lg font-semibold leading-none mt-0.5 ${
                isToday(d) ? "text-primary" : ""
              }`}
            >
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* All-day lane */}
      {maxAllDay > 0 && (
        <div
          className="grid border-b border-border bg-secondary/30"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
        >
          <div className="text-[9px] text-muted-foreground grid place-items-center">Ամբողջ օր</div>
          {days.map((d) => {
            const ad = allDayEventsForDay(events, d);
            return (
              <div key={dayKey(d)} className="border-l border-border p-1 space-y-1 min-h-[28px]">
                {ad.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onOpen(ev)}
                    className={`w-full text-left truncate rounded px-1.5 py-0.5 text-[11px] border ${
                      KIND_META[ev.kind]?.bar || KIND_META.other.bar
                    }`}
                  >
                    {ev.title}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="max-h-[62vh] overflow-y-auto">
        <div
          className="grid"
          style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0,1fr))` }}
        >
          {/* hour gutter */}
          <div className="relative" style={{ height: GRID_H }}>
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted-foreground"
                style={{ top: h * HOUR_H }}
              >
                {h > 0 ? `${String(h).padStart(2, "0")}:00` : ""}
              </div>
            ))}
          </div>

          {/* day columns */}
          <div
            ref={colsRef}
            className="relative col-start-2 -col-end-1 grid"
            style={{
              gridColumn: `2 / span ${days.length}`,
              gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))`,
              height: GRID_H,
            }}
          >
            {days.map((day, di) => {
              const timed = timedEventsForDay(events, day);
              const laid = layoutDay(timed, day);
              const showDrag = drag && drag.dayIndex === di;
              return (
                <div
                  key={dayKey(day)}
                  className="relative border-l border-border"
                  onPointerDown={(e) => startCreate(e, di)}
                  style={{ touchAction: "pan-y" }}
                >
                  {/* hour lines */}
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="absolute inset-x-0 border-t border-border/60"
                      style={{ top: h * HOUR_H }}
                    />
                  ))}

                  {/* now line */}
                  {isToday(day) && (
                    <div
                      className="absolute inset-x-0 z-20 pointer-events-none"
                      style={{ top: (nowMin / DAY_MIN) * GRID_H }}
                    >
                      <div className="h-0.5 bg-red-500" />
                      <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500" />
                    </div>
                  )}

                  {/* events */}
                  {laid.map(({ event, col, cols }) => {
                    const s = minutesSinceMidnight(event.start);
                    const dur = Math.max(
                      15,
                      Math.round((event.end.getTime() - event.start.getTime()) / 60000),
                    );
                    const top = (s / DAY_MIN) * GRID_H;
                    const height = (dur / DAY_MIN) * GRID_H;
                    const isDragged = drag?.id === event.id;
                    const meta = KIND_META[event.kind] || KIND_META.other;
                    const ro = isReadOnly(event);
                    return (
                      <div
                        key={event.id}
                        onPointerDown={(e) => startMove(e, event, di)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!didDragRef.current) onOpen(event);
                          didDragRef.current = false;
                        }}
                        className={`absolute rounded-md border px-1.5 py-0.5 overflow-hidden shadow-sm ${meta.bar} ${
                          ro ? "opacity-90" : "cursor-grab active:cursor-grabbing"
                        } ${isDragged ? "opacity-70 ring-2 ring-white/60 z-30" : "z-10"}`}
                        style={{
                          top,
                          height: Math.max(16, height - 2),
                          left: `calc(${(col / cols) * 100}% + 2px)`,
                          width: `calc(${100 / cols}% - 4px)`,
                          touchAction: "none",
                        }}
                        title={event.title}
                      >
                        <div className="text-[11px] font-semibold leading-tight truncate">
                          {event.title}
                        </div>
                        {height > 28 && (
                          <div className="text-[10px] opacity-90 leading-tight truncate">
                            {fmtTime(event.start)}
                          </div>
                        )}
                        {!ro && (
                          <div
                            onPointerDown={(e) => startResize(e, event, di)}
                            className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                            style={{ touchAction: "none" }}
                          />
                        )}
                      </div>
                    );
                  })}

                  {/* live drag preview */}
                  {showDrag && drag && (
                    <div
                      className="absolute left-0.5 right-0.5 rounded-md bg-primary/30 border-2 border-primary z-40 pointer-events-none"
                      style={{
                        top: (drag.startMin / DAY_MIN) * GRID_H,
                        height: ((drag.endMin - drag.startMin) / DAY_MIN) * GRID_H,
                      }}
                    >
                      <div className="text-[10px] font-semibold text-primary px-1 pt-0.5">
                        {String(Math.floor(drag.startMin / 60)).padStart(2, "0")}:
                        {String(drag.startMin % 60).padStart(2, "0")}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

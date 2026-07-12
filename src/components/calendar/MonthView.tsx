import { useMemo } from "react";
import {
  eventsForDay,
  fmtTime,
  fmtWeekday,
  isSameMonth,
  isToday,
  KIND_META,
  monthGrid,
  startOfWeek,
  addDays,
  dayKey,
  type CalEvent,
} from "@/lib/calendar";

export function MonthView({
  anchor,
  events,
  onOpen,
  onCreateOnDay,
  onPickDay,
}: {
  anchor: Date;
  events: CalEvent[];
  onOpen: (e: CalEvent) => void;
  onCreateOnDay: (day: Date) => void;
  onPickDay: (day: Date) => void;
}) {
  const cells = useMemo(() => monthGrid(anchor), [anchor]);
  const weekdayHeads = useMemo(() => {
    const s = startOfWeek(new Date());
    return Array.from({ length: 7 }, (_, i) => fmtWeekday(addDays(s, i)));
  }, []);

  return (
    <div className="card-base overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {weekdayHeads.map((w) => (
          <div
            key={w}
            className="py-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 auto-rows-fr">
        {cells.map((day) => {
          const dayEvents = eventsForDay(events, day);
          const inMonth = isSameMonth(day, anchor);
          const today = isToday(day);
          return (
            <button
              key={dayKey(day)}
              onDoubleClick={() => onCreateOnDay(day)}
              onClick={() => onPickDay(day)}
              className={`text-left border-b border-l border-border min-h-[92px] sm:min-h-[110px] p-1.5 first:border-l-0 [&:nth-child(7n+1)]:border-l-0 transition-colors hover:bg-secondary/40 ${
                inMonth ? "" : "bg-secondary/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-grid place-items-center w-6 h-6 rounded-full text-xs font-semibold ${
                    today
                      ? "bg-primary text-primary-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/60"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(ev);
                    }}
                    className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        KIND_META[ev.kind]?.dot || KIND_META.other.dot
                      }`}
                    />
                    <span className="text-[10px] leading-tight truncate">
                      {!ev.allDay && (
                        <span className="text-muted-foreground">{fmtTime(ev.start)} </span>
                      )}
                      {ev.title}
                    </span>
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-muted-foreground pl-1">
                    +{dayEvents.length - 3} ևս
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

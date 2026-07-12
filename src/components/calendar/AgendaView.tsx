import { useMemo } from "react";
import {
  addDays,
  eventsForDay,
  fmtFullDate,
  fmtTime,
  isToday,
  KIND_META,
  startOfDay,
  dayKey,
  type CalEvent,
} from "@/lib/calendar";
import { CalendarPlus, MapPin } from "lucide-react";

/** Upcoming events grouped by day — the mobile-friendly default view. */
export function AgendaView({
  anchor,
  events,
  onOpen,
  onCreateOnDay,
  days = 30,
}: {
  anchor: Date;
  events: CalEvent[];
  onOpen: (e: CalEvent) => void;
  onCreateOnDay: (day: Date) => void;
  days?: number;
}) {
  const groups = useMemo(() => {
    const start = startOfDay(anchor);
    const out: { day: Date; items: CalEvent[] }[] = [];
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      const items = eventsForDay(events, d);
      if (items.length) out.push({ day: d, items });
    }
    return out;
  }, [anchor, events, days]);

  if (!groups.length) {
    return (
      <div className="card-base p-8 text-center">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-secondary grid place-items-center mb-3">
          <CalendarPlus className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="font-semibold">Առաջիկա իրադարձություններ չկան</div>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Ավելացրու առաջին իրադարձությունը կամ միացիր հնարավորությանը։
        </p>
        <button
          onClick={() => onCreateOnDay(new Date())}
          className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg bg-primary text-primary-foreground text-sm font-medium"
        >
          <CalendarPlus className="w-4 h-4" /> Ավելացնել իրադարձություն
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(({ day, items }) => (
        <div key={dayKey(day)} className="card-base p-3 sm:p-4">
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`font-semibold ${isToday(day) ? "text-primary" : ""}`}>
              {isToday(day) ? "Այսօր" : fmtFullDate(day)}
            </span>
            {isToday(day) && (
              <span className="text-xs text-muted-foreground">{fmtFullDate(day)}</span>
            )}
          </div>
          <div className="space-y-1.5">
            {items.map((ev) => {
              const meta = KIND_META[ev.kind] || KIND_META.other;
              return (
                <button
                  key={ev.id}
                  onClick={() => onOpen(ev)}
                  className="w-full text-left grid grid-cols-[auto_minmax(0,1fr)] gap-3 items-start rounded-xl p-2.5 hover:bg-secondary/50 transition-colors min-h-[44px]"
                >
                  <div className="w-16 shrink-0 text-right">
                    {ev.allDay ? (
                      <span className="text-[11px] text-muted-foreground">Ամբողջ օր</span>
                    ) : (
                      <>
                        <div className="text-sm font-semibold leading-tight">
                          {fmtTime(ev.start)}
                        </div>
                        <div className="text-[11px] text-muted-foreground leading-tight">
                          {fmtTime(ev.end)}
                        </div>
                      </>
                    )}
                  </div>
                  <div className="min-w-0 flex items-start gap-2">
                    <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                    <div className="min-w-0">
                      <div className="font-medium leading-tight break-words">{ev.title}</div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                        <span>{meta.label}</span>
                        {ev.location && (
                          <span className="inline-flex items-center gap-0.5">
                            <MapPin className="w-3 h-3" /> {ev.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

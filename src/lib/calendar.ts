// Calendar engine: timezone-local date math, grid builders, and overlap layout.
// All times are handled in the viewer's local timezone (correct for a personal
// calendar); the ICS feed serializes to UTC separately.

import {
  BookOpen,
  Rocket,
  Users,
  Trophy,
  Compass,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

export type EventKind = "study" | "project" | "meeting" | "quest" | "opportunity" | "other";
export type EventSource = "manual" | "ai" | "quest" | "project" | "opportunity" | "google";

export type CalEvent = {
  id: string;
  title: string;
  description: string | null;
  start: Date;
  end: Date;
  allDay: boolean;
  kind: EventKind;
  color: string | null;
  location: string | null;
  source: EventSource;
  externalId: string | null;
  reminderMinutes: number | null;
};

/** DB row shape (snake_case) → domain event. */
export function fromRow(r: any): CalEvent {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? null,
    start: new Date(r.starts_at),
    end: new Date(r.ends_at),
    allDay: !!r.all_day,
    kind: (r.kind ?? "other") as EventKind,
    color: r.color ?? null,
    location: r.location ?? null,
    source: (r.source ?? "manual") as EventSource,
    externalId: r.external_id ?? null,
    reminderMinutes: r.reminder_minutes ?? null,
  };
}

export const KIND_META: Record<
  EventKind,
  { label: string; icon: LucideIcon; dot: string; chip: string; bar: string }
> = {
  study: {
    label: "Ուսում",
    icon: BookOpen,
    dot: "bg-blue-500",
    chip: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
    bar: "bg-blue-500/85 border-blue-600/40 text-white",
  },
  project: {
    label: "Նախագիծ",
    icon: Rocket,
    dot: "bg-purple-500",
    chip: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
    bar: "bg-purple-500/85 border-purple-600/40 text-white",
  },
  meeting: {
    label: "Հանդիպում",
    icon: Users,
    dot: "bg-orange-500",
    chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
    bar: "bg-orange-500/85 border-orange-600/40 text-white",
  },
  quest: {
    label: "Քվեստ",
    icon: Trophy,
    dot: "bg-emerald-500",
    chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    bar: "bg-emerald-500/85 border-emerald-600/40 text-white",
  },
  opportunity: {
    label: "Հնարավորություն",
    icon: Compass,
    dot: "bg-sky-500",
    chip: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
    bar: "bg-sky-500/85 border-sky-600/40 text-white",
  },
  other: {
    label: "Այլ",
    icon: CalendarDays,
    dot: "bg-slate-500",
    chip: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
    bar: "bg-slate-500/85 border-slate-600/40 text-white",
  },
};

export const KIND_ORDER: EventKind[] = [
  "study",
  "project",
  "meeting",
  "quest",
  "opportunity",
  "other",
];

/** Events the student cannot edit (mirrored from other systems). */
export function isReadOnly(e: CalEvent) {
  return e.source === "opportunity" || e.source === "quest" || e.source === "google";
}

// ---------------------------------------------------------------- date helpers

export const MS_DAY = 86400000;

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
export function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMinutes(d: Date, n: number) {
  return new Date(d.getTime() + n * 60000);
}
/** Monday-first week start. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  const day = (x.getDay() + 6) % 7;
  return addDays(x, -day);
}
export function startOfMonth(d: Date) {
  const x = startOfDay(d);
  x.setDate(1);
  return x;
}
export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
export function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
export function isToday(d: Date) {
  return isSameDay(d, new Date());
}
/** Local YYYY-MM-DD key (not UTC) for bucketing. */
export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
export function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}
/** Round minutes to the nearest `step` (default 15). */
export function snapMinutes(mins: number, step = 15) {
  return Math.round(mins / step) * step;
}

// ---------------------------------------------------------------- formatting
// Hard-coded Armenian names: Intl's "hy-AM" silently falls back to English on
// browsers built without the Armenian ICU locale, and the UI must stay Armenian.

const MONTHS_GEN = [
  "հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի",
  "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի",
];
const MONTHS_NOM = [
  "Հունվար", "Փետրվար", "Մարտ", "Ապրիլ", "Մայիս", "Հունիս",
  "Հուլիս", "Օգոստոս", "Սեպտեմբեր", "Հոկտեմբեր", "Նոյեմբեր", "Դեկտեմբեր",
];
// indexed by Date#getDay() (0 = Sunday)
const WEEKDAYS_LONG = [
  "կիրակի", "երկուշաբթի", "երեքշաբթի", "չորեքշաբթի", "հինգշաբթի", "ուրբաթ", "շաբաթ",
];
const WEEKDAYS_SHORT = ["Կիր", "Երկ", "Երք", "Չրք", "Հնգ", "Ուրբ", "Շբթ"];

const p2 = (n: number) => String(n).padStart(2, "0");

export function fmtTime(d: Date) {
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
export function fmtWeekday(d: Date, style: "short" | "long" = "short") {
  return style === "short" ? WEEKDAYS_SHORT[d.getDay()] : WEEKDAYS_LONG[d.getDay()];
}
export function fmtDayMonth(d: Date) {
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}
export function fmtMonthYear(d: Date) {
  return `${MONTHS_NOM[d.getMonth()]} ${d.getFullYear()}`;
}
export function fmtFullDate(d: Date) {
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}
/** For <input type="datetime-local"> value (local, no seconds). */
export function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}
export function toDateInput(d: Date) {
  return dayKey(d);
}
export function toTimeInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ---------------------------------------------------------------- grid builders

export function weekDays(anchor: Date): Date[] {
  const s = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

/** 6×7 month grid starting on the Monday on/before the 1st. */
export function monthGrid(anchor: Date): Date[] {
  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

// ---------------------------------------------------------------- filtering

/** A timed (non-all-day) event overlaps the given calendar day. */
export function timedEventsForDay(events: CalEvent[], day: Date): CalEvent[] {
  const s = startOfDay(day).getTime();
  const e = s + MS_DAY;
  return events
    .filter((ev) => !ev.allDay && ev.start.getTime() < e && ev.end.getTime() > s)
    .sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
}

export function allDayEventsForDay(events: CalEvent[], day: Date): CalEvent[] {
  const s = startOfDay(day).getTime();
  const e = s + MS_DAY;
  return events.filter((ev) => ev.allDay && ev.start.getTime() < e && ev.end.getTime() > s);
}

/** All events (timed + all-day) intersecting a day, for month cells / agenda. */
export function eventsForDay(events: CalEvent[], day: Date): CalEvent[] {
  const s = startOfDay(day).getTime();
  const e = s + MS_DAY;
  return events
    .filter((ev) => ev.start.getTime() < e && ev.end.getTime() > s)
    .sort((a, b) => {
      if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
      return a.start.getTime() - b.start.getTime();
    });
}

// ---------------------------------------------------------------- overlap layout

export type LaidOut = { event: CalEvent; col: number; cols: number };

/**
 * Assign side-by-side columns to overlapping timed events within one day.
 * Greedy interval-graph coloring: events that overlap share a "cluster" and
 * are split into the minimum number of columns.
 */
export function layoutDay(events: CalEvent[], day: Date): LaidOut[] {
  const dayStart = startOfDay(day).getTime();
  const dayEnd = dayStart + MS_DAY;
  const items = events
    .map((event) => ({
      event,
      s: Math.max(event.start.getTime(), dayStart),
      e: Math.min(event.end.getTime(), dayEnd),
    }))
    .sort((a, b) => a.s - b.s || a.e - b.e);

  const out: LaidOut[] = [];
  let cluster: typeof items = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    // assign each event the first free column
    const colEnds: number[] = [];
    const assigned: { event: CalEvent; col: number }[] = [];
    for (const it of cluster) {
      let col = colEnds.findIndex((end) => end <= it.s);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(it.e);
      } else {
        colEnds[col] = it.e;
      }
      assigned.push({ event: it.event, col });
    }
    const cols = colEnds.length;
    for (const a of assigned) out.push({ event: a.event, col: a.col, cols });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const it of items) {
    if (it.s >= clusterEnd && cluster.length) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  }
  flush();
  return out;
}

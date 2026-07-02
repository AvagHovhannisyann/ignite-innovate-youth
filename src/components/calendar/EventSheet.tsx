import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  KIND_META,
  KIND_ORDER,
  isReadOnly,
  toDateInput,
  toTimeInput,
  type CalEvent,
  type EventKind,
} from "@/lib/calendar";
import type { EventDraft } from "@/hooks/useSchedule";
import { Trash2, Bell, MapPin, Loader2 } from "lucide-react";

export type SheetTarget =
  | { mode: "create"; start: Date; end: Date; allDay?: boolean }
  | { mode: "edit"; event: CalEvent };

const REMINDERS: { v: number | null; label: string }[] = [
  { v: null, label: "Առանց" },
  { v: 10, label: "10 րոպե առաջ" },
  { v: 30, label: "30 րոպե առաջ" },
  { v: 60, label: "1 ժամ առաջ" },
  { v: 1440, label: "1 օր առաջ" },
];

function combine(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}`);
}

export function EventSheet({
  target,
  onClose,
  onSave,
  onDelete,
}: {
  target: SheetTarget | null;
  onClose: () => void;
  onSave: (draft: EventDraft, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [kind, setKind] = useState<EventKind>("study");
  const [location, setLocation] = useState("");
  const [reminder, setReminder] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const readOnly = target?.mode === "edit" && isReadOnly(target.event);

  useEffect(() => {
    if (!target) return;
    if (target.mode === "create") {
      setTitle("");
      setDescription("");
      setDate(toDateInput(target.start));
      setEndDate(toDateInput(target.end.getTime() > target.start.getTime() ? target.end : target.start));
      setStart(toTimeInput(target.start));
      setEnd(toTimeInput(target.end));
      setAllDay(!!target.allDay);
      setKind("study");
      setLocation("");
      setReminder(null);
    } else {
      const e = target.event;
      setTitle(e.title);
      setDescription(e.description || "");
      setDate(toDateInput(e.start));
      setEndDate(toDateInput(e.end));
      setStart(toTimeInput(e.start));
      setEnd(toTimeInput(e.end));
      setAllDay(e.allDay);
      setKind(e.kind === "opportunity" ? "other" : e.kind);
      setLocation(e.location || "");
      setReminder(e.reminderMinutes);
    }
  }, [target]);

  if (!target) return null;

  async function save() {
    if (!title.trim()) return;
    let s: Date, en: Date;
    if (allDay) {
      s = combine(date, "00:00");
      en = combine(endDate || date, "00:00");
      en.setDate(en.getDate() + 1); // exclusive end
    } else {
      s = combine(date, start);
      en = combine(date, end);
      if (en <= s) en = new Date(s.getTime() + 30 * 60000);
    }
    setBusy(true);
    try {
      await onSave(
        {
          title: title.trim(),
          description: description.trim() || null,
          start: s,
          end: en,
          allDay,
          kind,
          location: location.trim() || null,
          reminderMinutes: reminder,
        },
        target?.mode === "edit" ? target.event.id : undefined,
      );
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full px-3 py-2 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring text-sm disabled:opacity-60";

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? "Իրադարձություն"
              : target.mode === "create"
                ? "Նոր իրադարձություն"
                : "Խմբագրել իրադարձությունը"}
          </DialogTitle>
        </DialogHeader>

        {readOnly ? (
          <div className="space-y-2 text-sm">
            <div className="font-semibold text-base">{target.event.title}</div>
            {target.event.description && (
              <p className="text-muted-foreground break-words">{target.event.description}</p>
            )}
            {target.event.location && (
              <p className="inline-flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5" /> {target.event.location}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Այս իրադարձությունն ավտոմատ ավելացվել է և չի կարող խմբագրվել այստեղ։
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Վերնագիր"
              className={inputCls}
            />

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="w-4 h-4 accent-[var(--primary)]"
              />
              Ամբողջ օրվա իրադարձություն
            </label>

            {allDay ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Սկիզբ
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
                </label>
                <label className="text-xs text-muted-foreground">
                  Ավարտ
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={inputCls}
                  />
                </label>
              </div>
            ) : (
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2 items-end">
                <label className="text-xs text-muted-foreground">
                  Ամսաթիվ
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
                </label>
                <label className="text-xs text-muted-foreground">
                  Սկիզբ
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
                </label>
                <label className="text-xs text-muted-foreground">
                  Ավարտ
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
                </label>
              </div>
            )}

            <div>
              <div className="text-xs text-muted-foreground mb-1">Տեսակ</div>
              <div className="flex flex-wrap gap-1.5">
                {KIND_ORDER.filter((k) => k !== "opportunity").map((k) => {
                  const meta = KIND_META[k];
                  const on = kind === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setKind(k)}
                      className={`inline-flex items-center gap-1.5 px-2.5 min-h-[36px] rounded-full border text-xs transition-colors ${
                        on ? meta.chip : "border-border text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${meta.dot}`} /> {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Վայր (ոչ պարտադիր)"
                className={`${inputCls} pl-9`}
              />
            </div>

            <div className="relative">
              <Bell className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <select
                value={reminder ?? ""}
                onChange={(e) => setReminder(e.target.value === "" ? null : Number(e.target.value))}
                className={`${inputCls} pl-9 appearance-none`}
              >
                {REMINDERS.map((r) => (
                  <option key={r.label} value={r.v ?? ""}>
                    Հիշեցում՝ {r.label}
                  </option>
                ))}
              </select>
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Նշումներ (ոչ պարտադիր)"
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {target.mode === "edit" && !readOnly ? (
            <button
              onClick={async () => {
                setBusy(true);
                try {
                  await onDelete(target.event.id);
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg text-destructive hover:bg-destructive/10 text-sm disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" /> Ջնջել
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 min-h-[44px] rounded-lg hover:bg-secondary text-sm"
            >
              {readOnly ? "Փակել" : "Չեղարկել"}
            </button>
            {!readOnly && (
              <button
                onClick={save}
                disabled={busy || !title.trim()}
                className="inline-flex items-center gap-2 px-4 min-h-[44px] rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                Պահպանել
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

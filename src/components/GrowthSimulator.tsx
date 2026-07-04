import { useMemo, useState } from "react";
import { LEVELS } from "@/lib/constants";
import { Sparkles, Rocket, GraduationCap, Users, Check, Lock } from "lucide-react";

/** Weekly XP each activity earns — mirrors the real quest/participation rewards. */
const ACTIVITIES = [
  { id: "quests", label: "Ամենօրյա քվեստներ", xp: 35, icon: Sparkles },
  { id: "events", label: "Միջոցառումներ", xp: 25, icon: Users },
  { id: "classes", label: "Մաստեր-դասեր", xp: 20, icon: GraduationCap },
  { id: "project", label: "Ակտիվ նախագիծ", xp: 40, icon: Rocket },
] as const;

type ActivityId = (typeof ACTIVITIES)[number]["id"];

function weeksLabel(weeks: number): string {
  if (weeks <= 4) return `~${weeks} շաբաթում`;
  const months = Math.round(weeks / 4.345);
  return months <= 11 ? `~${months} ամսում` : `~${Math.round(months / 12)} տարում`;
}

/**
 * Interactive XP trajectory simulator: toggle weekly activities and watch the
 * six real platform levels light up with a projected arrival date.
 */
export function GrowthSimulator() {
  const [picked, setPicked] = useState<Set<ActivityId>>(new Set(["quests", "events"]));

  const weeklyXP = useMemo(
    () => ACTIVITIES.reduce((sum, a) => (picked.has(a.id) ? sum + a.xp : sum), 0),
    [picked],
  );

  const maxXP = LEVELS[LEVELS.length - 1].min;
  const horizonWeeks = 26; // visualize half a year of engagement
  const projectedXP = Math.min(weeklyXP * horizonWeeks, maxXP);
  const pct = maxXP ? Math.round((projectedXP / maxXP) * 100) : 0;

  function toggle(id: ActivityId) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="bento-tile p-5 sm:p-8">
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-8 items-start">
        {/* Controls */}
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-[0.22em] text-primary mb-3">
            Աճի սիմուլյատոր
          </div>
          <h3 className="font-display text-2xl sm:text-3xl mb-2">Ընտրիր քո շաբաթը</h3>
          <p className="text-sm text-muted-foreground mb-5">
            Ի՞նչ կանես ամեն շաբաթ։ Տես, թե որքան արագ կհասնես յուրաքանչյուր մակարդակին։
          </p>
          <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
            {ACTIVITIES.map((a) => {
              const on = picked.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(a.id)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all duration-300 ${
                    on
                      ? "border-primary/50 bg-primary/10 text-foreground shadow-soft"
                      : "border-border bg-card/60 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <span
                    className={`grid place-items-center w-7 h-7 rounded-lg shrink-0 transition-colors ${
                      on
                        ? "bg-gradient-hero text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    <a.icon className="w-3.5 h-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">{a.label}</span>
                  <span
                    className={`text-[11px] font-semibold shrink-0 ${on ? "text-primary" : ""}`}
                  >
                    +{a.xp}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-display text-4xl text-primary tabular-nums leading-none">{weeklyXP}</span>
            <span className="text-sm text-muted-foreground">XP / շաբաթ</span>
          </div>
        </div>

        {/* Projection road */}
        <div className="min-w-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
            <span>6 ամսվա կանխատեսում</span>
            <span className="font-semibold text-foreground">{projectedXP} XP</span>
          </div>
          <div className="relative h-2 rounded-full bg-secondary overflow-hidden mb-6">
            <div
              className="h-full rounded-full bg-gradient-brand transition-[width] duration-700 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
          <ol className="space-y-2.5">
            {LEVELS.map((lvl) => {
              const reached = weeklyXP > 0 && projectedXP >= lvl.min;
              const weeks = weeklyXP > 0 ? Math.max(1, Math.ceil(lvl.min / weeklyXP)) : null;
              return (
                <li
                  key={lvl.level}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 transition-all duration-500 ${
                    reached
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/60 bg-card/40 opacity-70"
                  }`}
                >
                  <span
                    className={`grid place-items-center w-8 h-8 rounded-full text-xs font-bold shrink-0 transition-colors duration-500 ${
                      reached
                        ? "bg-gradient-hero text-primary-foreground shadow-soft"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {reached ? <Check className="w-4 h-4" /> : lvl.level}
                  </span>
                  <span className="flex-1 min-w-0 text-sm font-medium leading-tight">
                    {lvl.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {lvl.min === 0 ? (
                      "մեկնարկ"
                    ) : reached && weeks ? (
                      weeksLabel(weeks)
                    ) : (
                      <Lock className="w-3.5 h-3.5 inline" aria-label="Դեռ հասանելի չէ" />
                    )}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

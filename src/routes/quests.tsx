import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { PageLoader } from "@/components/PageLoader";
import { LEVELS, levelFromXP, ALL_BADGES } from "@/lib/constants";
import {
  fetchQuestCatalog,
  fetchUserQuests,
  fetchTodayReroll,
  rerollDailyQuests,
  claimQuestXP,
  syncActivityProgress,
  claimLevelReward,
  fetchRewardClaims,
  todayKey,
  type DbQuest,
  type UserQuestRow,
} from "@/lib/quests";
import { toast } from "sonner";
import { burstConfettiFromElement } from "@/lib/confetti";
import {
  Loader2,
  RefreshCw,
  Lock,
  Check,
  Sparkles,
  Trophy,
  Rocket,
  Users,
  Compass,
  Lightbulb,
  Calendar,
  GraduationCap,
  Star,
  Flame,
  Gift,
  Zap,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { getErrorMessage } from "@/lib/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  Compass,
  Rocket,
  Lightbulb,
  Star,
  Sparkles,
  Users,
  GraduationCap,
  Flame,
  Calendar,
  Trophy,
};

export const Route = createFileRoute("/quests")({ component: QuestsPage });

type Quest = {
  id: string;
  type: "activity" | "daily";
  title: string;
  description: string;
  icon: LucideIcon;
  progress: number;
  target: number;
  xp: number;
  period: string;
  awarded: boolean;
  requiresEvidence: boolean;
  submissionStatus?: "pending" | "approved" | "rejected";
};

function pickDaily(catalog: DbQuest[], seed: number, count = 2): DbQuest[] {
  const daily = catalog.filter((q) => q.kind === "daily");
  const seededHash = (id: string) => {
    let hash = seed || 1;
    for (let i = 0; i < id.length; i += 1) hash = Math.imul(hash ^ id.charCodeAt(i), 16_777_619);
    return hash >>> 0;
  };
  const sorted = [...daily].sort((a, b) => {
    return seededHash(a.id) - seededHash(b.id);
  });
  return sorted.slice(0, count);
}

type Node = {
  level: number;
  xp: number;
  name: string;
  reward: string;
  rewardKind: "badge" | "perk" | "title" | "bonus";
  major: boolean;
};
const PERKS = [
  "Լրացուցիչ AI սերունդ",
  "Վաղ մուտք միջոցառումներին",
  "Առաջնահերթ թիմ ընտրություն",
  "Անհատական խորհրդատվություն",
];

function buildRoad(): Node[] {
  const nodes: Node[] = [];
  for (let i = 0; i < LEVELS.length; i++) {
    const lv = LEVELS[i];
    nodes.push({
      level: lv.level,
      xp: lv.min,
      name: lv.name,
      reward: ALL_BADGES[i % ALL_BADGES.length],
      rewardKind: i > 0 && i % 2 === 0 ? "perk" : "badge",
      major: true,
    });
    const next = LEVELS[i + 1];
    if (next) {
      const midXP = Math.round((lv.min + next.min) / 2);
      nodes.push({
        level: lv.level,
        xp: midXP,
        name: "Միջանկյալ",
        reward: i % 3 === 0 ? PERKS[i % PERKS.length] : ALL_BADGES[(i + 3) % ALL_BADGES.length],
        rewardKind: i % 3 === 0 ? "perk" : "title",
        major: false,
      });
    }
  }
  return nodes;
}

function QuestsPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [catalog, setCatalog] = useState<DbQuest[]>([]);
  const [userQuests, setUserQuests] = useState<UserQuestRow[]>([]);
  const [reroll, setReroll] = useState({ seed: 1, used: 0 });
  const [claims, setClaims] = useState<Set<string>>(new Set());
  const [submissions, setSubmissions] = useState<
    { template_id: string; period_key: string; status: "pending" | "approved" | "rejected" }[]
  >([]);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(
    async (uid: string) => {
      const [
        { data: prof },
        { data: parts },
        { data: sp },
        { data: rec },
        { data: subs },
        cat,
        uq,
        rr,
        cl,
      ] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).single(),
        supabase.from("participations").select("id").eq("user_id", uid),
        supabase.from("started_projects").select("id").eq("user_id", uid),
        supabase.from("recommendations").select("user_id").eq("user_id", uid).maybeSingle(),
        supabase
          .from("quest_submissions")
          .select("template_id,period_key,status")
          .eq("user_id", uid),
        fetchQuestCatalog(),
        fetchUserQuests(uid),
        fetchTodayReroll(uid),
        fetchRewardClaims(uid),
      ]);
      if (!prof?.onboarded) {
        nav({ to: "/onboarding" });
        return;
      }
      setProfile(prof);
      setCatalog(cat);
      setUserQuests(uq);
      setReroll({ seed: rr.seed, used: rr.used });
      setClaims(cl);
      setSubmissions(subs || []);

      const counts: Record<string, number> = {
        "a-join": Math.min((parts || []).length, 3),
        "a-project": Math.min((sp || []).length, 1),
        "a-ai": rec ? 1 : 0,
        "a-profile": prof
          ? [
              !!prof.full_name,
              (prof.interests || []).length >= 3,
              (prof.skills || []).length >= 1,
              !!prof.goal,
            ].filter(Boolean).length
          : 0,
      };
      const existingBy = new Map(
        uq.filter((r) => r.period_key === "permanent").map((r) => [r.template_id, r] as const),
      );
      let touched = false;
      for (const [tid, cur] of Object.entries(counts)) {
        const ex = existingBy.get(tid);
        const server = ex?.progress ?? 0;
        if (cur > server) {
          try {
            await syncActivityProgress(tid);
            touched = true;
          } catch (error: unknown) {
            console.error("Could not synchronize quest progress", error);
          }
        }
      }
      if (touched) setUserQuests(await fetchUserQuests(uid));
    },
    [nav],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    void reload(user.id);
  }, [user, loading, nav, reload]);

  const period = todayKey();
  const stateBy = useMemo(() => {
    const m = new Map<string, UserQuestRow>();
    for (const r of userQuests) m.set(`${r.template_id}::${r.period_key}`, r);
    return m;
  }, [userQuests]);
  const submissionBy = useMemo(() => {
    const map = new Map<string, "pending" | "approved" | "rejected">();
    for (const submission of submissions) {
      map.set(`${submission.template_id}::${submission.period_key}`, submission.status);
    }
    return map;
  }, [submissions]);

  const activityQuests: Quest[] = useMemo(() => {
    return catalog
      .filter((t) => t.kind === "activity")
      .map((t) => {
        const s = stateBy.get(`${t.id}::permanent`);
        return {
          id: t.id,
          type: "activity",
          title: t.title,
          description: t.description,
          icon: ICON_MAP[t.icon] || Sparkles,
          target: t.target,
          xp: t.xp,
          progress: Math.min(s?.progress ?? 0, t.target),
          awarded: !!s?.awarded,
          period: "permanent",
          requiresEvidence: t.requires_evidence,
          submissionStatus: submissionBy.get(`${t.id}::permanent`),
        };
      });
  }, [catalog, stateBy, submissionBy]);

  const dailyQuests: Quest[] = useMemo(() => {
    return pickDaily(catalog, reroll.seed).map((t) => {
      const s = stateBy.get(`${t.id}::${period}`);
      return {
        id: t.id,
        type: "daily",
        title: t.title,
        description: t.description,
        icon: ICON_MAP[t.icon] || Sparkles,
        target: t.target,
        xp: t.xp,
        progress: Math.min(s?.progress ?? 0, t.target),
        awarded: !!s?.awarded,
        period,
        requiresEvidence: t.requires_evidence,
        submissionStatus: submissionBy.get(`${t.id}::${period}`),
      };
    });
  }, [catalog, reroll.seed, stateBy, period, submissionBy]);

  async function doReroll() {
    if (!user) return;
    try {
      const res = await rerollDailyQuests();
      if (!res.ok) {
        toast.error("Այսօրվա թարմացումները սպառվել են");
        return;
      }
      setReroll({ seed: res.seed, used: 3 - res.remaining });
      toast.success(`Թարմացված է · մնաց ${res.remaining}`);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց թարմացնել"));
    }
  }

  async function onClaimQuest(q: Quest, sourceEl?: Element) {
    if (!user || q.awarded) return;
    if (q.requiresEvidence) {
      if (q.submissionStatus === "pending") {
        toast("Ապացույցն արդեն սպասում է ստուգման");
        return;
      }
      nav({ to: "/quest-submit", search: { template_id: q.id } });
      return;
    }
    if (q.progress < q.target) return;
    setBusy(q.id);
    try {
      const res = await claimQuestXP(q.id, q.period);
      if (res.already) toast("Արդեն ստացված է");
      else {
        if (sourceEl) burstConfettiFromElement(sourceEl);
        toast.success(`+${res.xp} XP!`);
      }
      await reload(user.id);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց ստանալ XP-ն"));
    } finally {
      setBusy(null);
    }
  }

  async function onClaimReward(node: Node, key: string, sourceEl?: Element) {
    if (!user) return;
    setBusy(`lv-${key}`);
    try {
      await claimLevelReward(node.level, node.xp, node.reward);
      if (sourceEl) burstConfettiFromElement(sourceEl);
      toast.success("Պարգևը ստացված է");
      setClaims(await fetchRewardClaims(user.id));
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց ստանալ պարգևը"));
    } finally {
      setBusy(null);
    }
  }

  const rerollsLeft = Math.max(0, 3 - reroll.used);

  if (loading || !profile) {
    return (
      <div className="min-h-dvh bg-gradient-soft">
        <Navbar />
        <PageLoader />
      </div>
    );
  }

  const lvl = levelFromXP(profile.xp || 0);
  const nextXP = lvl.next?.min ?? lvl.min;
  const road = buildRoad();
  const currentXP = profile.xp || 0;

  return (
    <div className="min-h-dvh bg-gradient-soft overflow-x-hidden">
      <Navbar />

      <main className="max-w-6xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-6 sm:py-10 pb-32 md:pb-10">
        {/* Header */}
        <header className="mb-6 sm:mb-8 animate-rise min-w-0">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold mb-2 max-w-full">
            <Trophy className="w-3.5 h-3.5 shrink-0" />{" "}
            <span className="break-words">Քվեստներ</span>
          </div>
          <h1 className="font-display text-2xl min-[380px]:text-3xl md:text-4xl font-bold leading-tight break-words">
            Քո առաքելությունները
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl break-words">
            Ավարտիր քվեստները, ստացիր XP և բացիր նոր մակարդակներ ու պարգևներ։
          </p>
        </header>

        {/* XP / Level summary */}
        <section className="card-base p-4 sm:p-7 mb-6 sm:mb-8 animate-rise overflow-hidden">
          <div className="grid grid-cols-1 min-[380px]:grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:flex sm:items-center gap-3 sm:gap-6">
            <div className="shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-hero grid place-items-center shadow-glow">
              <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-end justify-between gap-2 mb-1.5">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Մակարդակ {lvl.level}
                  </div>
                  <h2 className="font-display text-lg sm:text-2xl font-bold break-words leading-tight">
                    {lvl.name}
                  </h2>
                </div>
                <div className="shrink-0 inline-flex flex-wrap items-center justify-end gap-1 text-sm font-semibold text-primary max-w-[42%] min-[380px]:max-w-[42%]">
                  <Zap className="w-4 h-4" fill="currentColor" />
                  <span>{currentXP}</span>
                  <span className="text-muted-foreground font-normal">/ {nextXP}</span>
                </div>
              </div>
              <div className="h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-hero transition-all duration-700"
                  style={{ width: `${Math.max(2, lvl.progressPct)}%` }}
                />
              </div>
              {lvl.next && (
                <div className="text-xs text-muted-foreground mt-2">
                  Հաջորդը՝ <span className="text-foreground font-medium">{lvl.next.name}</span> · ևս{" "}
                  {lvl.next.min - currentXP} XP
                </div>
              )}
            </div>
            <Link
              to="/profile"
              className="hidden sm:inline-flex shrink-0 items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-secondary text-sm font-medium transition-base min-h-[44px]"
            >
              Պրոֆիլ
            </Link>
          </div>
        </section>

        {/* Quest Board header */}
        <section className="mb-8 sm:mb-12">
          <div className="grid grid-cols-1 min-[380px]:grid-cols-[minmax(0,1fr)_auto] sm:flex sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6 min-w-0">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                Սեզոն 1 · Թարմացվում է ամեն օր
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold break-words leading-tight">
                Քվեստների տախտակ
              </h2>
            </div>
            <button
              onClick={doReroll}
              disabled={rerollsLeft <= 0}
              className="btn btn-secondary w-full min-[380px]:w-auto"
            >
              <RefreshCw className="w-4 h-4" />
              <span className="hidden sm:inline">Թարմացնել</span>
              <span className="ml-0.5 px-2 py-0.5 rounded-full bg-secondary text-[11px] font-semibold">
                {rerollsLeft}
              </span>
            </button>
          </div>

          {/* Activity quests */}
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5" /> Մշտական
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {activityQuests.map((q, i) => (
              <QuestCard
                key={q.id}
                q={q}
                index={i}
                busy={busy === q.id}
                onClaim={(e) => onClaimQuest(q, e.currentTarget)}
              />
            ))}
          </div>

          {/* Daily quests */}
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <Flame className="w-3.5 h-3.5" /> Օրվա քվեստներ
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dailyQuests.map((q, i) => (
              <QuestCard
                key={`${q.id}-${q.period}`}
                q={q}
                index={i}
                busy={busy === q.id}
                onClaim={(e) => onClaimQuest(q, e.currentTarget)}
              />
            ))}
          </div>
        </section>

        {/* Reward Road */}
        <section>
          <div className="flex items-end justify-between mb-4 sm:mb-6 gap-3">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
                Առաջընթաց
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold break-words leading-tight">
                Պարգևների ճանապարհ
              </h2>
            </div>
          </div>

          {/* Desktop horizontal */}
          <div className="hidden md:block">
            <div className="card-base p-6 overflow-x-auto max-w-full">
              <div className="relative flex items-start gap-0 min-w-max py-2">
                {road.map((n, i) => {
                  const unlocked = currentXP >= n.xp;
                  const current = !unlocked && (i === 0 || currentXP >= road[i - 1].xp);
                  const key = `${n.level}:${n.xp}`;
                  const claimed = claims.has(key);
                  return (
                    <div key={i} className="relative flex items-start">
                      <RoadNode
                        node={n}
                        unlocked={unlocked}
                        current={current}
                        claimed={claimed}
                        busy={busy === `lv-${key}`}
                        onClaim={(e) => onClaimReward(n, key, e.currentTarget)}
                      />
                      {i < road.length - 1 && (
                        <div
                          className={`h-0.5 w-16 lg:w-20 mx-2 mt-7 rounded-full ${unlocked ? "bg-gradient-hero" : "bg-border"}`}
                        />
                      )}
                    </div>
                  );
                })}
                <div className="h-0.5 w-16 lg:w-20 mx-2 mt-7 rounded-full bg-border" />
                <BonusCard nextAt={LEVELS[LEVELS.length - 1].min + 800} currentXP={currentXP} />
              </div>
            </div>
          </div>

          {/* Mobile vertical */}
          <div className="md:hidden card-base p-3 min-[380px]:p-4 overflow-hidden">
            <ol className="relative pl-8 min-[380px]:pl-10">
              <div className="absolute left-[15px] min-[380px]:left-[19px] top-3 bottom-3 w-0.5 rounded-full bg-border" />
              {road.map((n, i) => {
                const unlocked = currentXP >= n.xp;
                const current = !unlocked && (i === 0 || currentXP >= road[i - 1].xp);
                const key = `${n.level}:${n.xp}`;
                const claimed = claims.has(key);
                return (
                  <li key={i} className="relative mb-4 last:mb-0">
                    <div className="absolute -left-8 min-[380px]:-left-10 top-0 scale-90 min-[380px]:scale-100 origin-top-left">
                      <NodeBadge level={n.level} unlocked={unlocked} current={current} />
                    </div>
                    <RewardRow
                      node={n}
                      unlocked={unlocked}
                      current={current}
                      claimed={claimed}
                      busy={busy === `lv-${key}`}
                      onClaim={(e) => onClaimReward(n, key, e.currentTarget)}
                    />
                  </li>
                );
              })}
              <li className="relative">
                <div className="absolute -left-8 min-[380px]:-left-10 top-0 scale-90 min-[380px]:scale-100 origin-top-left">
                  <div className="w-10 h-10 rounded-full grid place-items-center bg-gradient-warm shadow-soft text-accent-foreground">
                    <Gift className="w-5 h-5" />
                  </div>
                </div>
                <BonusCard
                  nextAt={LEVELS[LEVELS.length - 1].min + 800}
                  currentXP={currentXP}
                  compact
                />
              </li>
            </ol>
          </div>
        </section>
      </main>
    </div>
  );
}

function QuestCard({
  q,
  index,
  busy,
  onClaim,
}: {
  q: Quest;
  index: number;
  busy?: boolean;
  onClaim?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const done = q.progress >= q.target;
  const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
  const awaitingReview = q.submissionStatus === "pending";
  const Icon = q.icon;

  return (
    <article
      className="card-interactive p-4 sm:p-5 animate-rise min-w-0 overflow-hidden"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] min-[380px]:grid-cols-[auto_minmax(0,1fr)_auto] gap-3 sm:gap-4 items-start">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-hero grid place-items-center shadow-soft">
          <Icon className="w-6 h-6 text-primary-foreground" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-base break-words leading-snug">{q.title}</h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-snug mt-0.5 break-words">
            {q.description}
          </p>
        </div>
        <span className="col-start-2 min-[380px]:col-start-auto shrink-0 inline-flex items-center justify-self-start min-[380px]:justify-self-auto gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-accent text-accent-foreground">
          <Zap className="w-3 h-3" fill="currentColor" /> {q.xp} XP
        </span>
      </div>

      {q.requiresEvidence ? (
        <div className="mt-4 rounded-lg bg-secondary/55 px-3 py-2 text-xs text-muted-foreground">
          Այս քվեստը հաստատվում է քո ուղարկած նկարագրությամբ կամ ֆայլով։
        </div>
      ) : (
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Առաջընթաց</span>
            <span className="font-semibold">
              {q.progress} / {q.target}
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-hero transition-all duration-700"
              style={{ width: `${Math.max(2, pct)}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {q.awarded ? (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-success">
            <Check className="w-4 h-4" /> XP ստացված է
          </div>
        ) : awaitingReview ? (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            <Loader2 className="w-4 h-4" /> Սպասում է ստուգման
          </div>
        ) : q.requiresEvidence ? (
          <button
            onClick={onClaim}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-hero text-primary-foreground text-sm font-semibold shadow-soft hover:shadow-lift transition-base disabled:opacity-50 min-h-[44px]"
          >
            <Upload className="w-3.5 h-3.5" />
            {q.submissionStatus === "rejected" ? "Վերաուղարկել ապացույց" : "Ուղարկել ապացույց"}
          </button>
        ) : done ? (
          <button
            onClick={onClaim}
            disabled={busy}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-hero text-primary-foreground text-sm font-semibold shadow-soft hover:shadow-lift transition-base disabled:opacity-50 min-h-[44px]"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" fill="currentColor" />
            )}
            Ստանալ +{q.xp} XP
          </button>
        ) : (
          <span className="text-[11px] text-muted-foreground">Շարունակիր՝ XP ստանալու համար</span>
        )}
      </div>
    </article>
  );
}

function NodeBadge({
  level,
  unlocked,
  current,
}: {
  level: number;
  unlocked: boolean;
  current?: boolean;
}) {
  return (
    <div
      className={[
        "w-10 h-10 rounded-full grid place-items-center text-sm font-bold border-2 transition-base",
        unlocked
          ? "bg-gradient-hero text-primary-foreground border-primary/30 shadow-soft"
          : "bg-secondary text-muted-foreground border-border",
        current ? "ring-2 ring-accent ring-offset-2 ring-offset-background animate-pulse-soft" : "",
      ].join(" ")}
    >
      {unlocked ? <Check className="w-5 h-5" /> : level}
    </div>
  );
}

function RoadNode({
  node,
  unlocked,
  current,
  claimed,
  busy,
  onClaim,
}: {
  node: Node;
  unlocked: boolean;
  current?: boolean;
  claimed?: boolean;
  busy?: boolean;
  onClaim?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 shrink-0 w-44">
      <NodeBadge level={node.level} unlocked={unlocked} current={current} />
      <RewardCard
        node={node}
        unlocked={unlocked}
        current={current}
        claimed={claimed}
        busy={busy}
        onClaim={onClaim}
      />
    </div>
  );
}

function RewardCard({
  node,
  unlocked,
  current,
  claimed,
  busy,
  onClaim,
}: {
  node: Node;
  unlocked: boolean;
  current?: boolean;
  claimed?: boolean;
  busy?: boolean;
  onClaim?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div
      className={[
        "relative w-full rounded-xl border p-3 transition-base",
        unlocked ? "bg-card border-border shadow-soft" : "bg-secondary/60 border-border",
        current ? "ring-2 ring-accent/60" : "",
      ].join(" ")}
    >
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
        {node.rewardKind === "perk"
          ? "Արտոնություն"
          : node.rewardKind === "title"
            ? "Տիտղոս"
            : "Նշան"}
      </div>
      <div className="text-sm font-semibold leading-tight break-words min-h-[2.5rem]">
        {node.reward}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="inline-flex items-center gap-1 font-semibold text-primary">
          <Zap className="w-3 h-3" fill="currentColor" /> {node.xp} XP
        </span>
        {!unlocked && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      {unlocked &&
        (claimed ? (
          <div className="mt-2 text-[10px] inline-flex items-center gap-1 text-success font-semibold">
            <Check className="w-3 h-3" /> Ստացված
          </div>
        ) : (
          <button
            onClick={onClaim}
            disabled={busy}
            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-gradient-hero text-primary-foreground text-[11px] font-semibold hover:shadow-soft transition-base disabled:opacity-50 min-h-[44px]"
          >
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gift className="w-3 h-3" />}
            Ստանալ
          </button>
        ))}
    </div>
  );
}

function RewardRow({
  node,
  unlocked,
  current,
  claimed,
  busy,
  onClaim,
}: {
  node: Node;
  unlocked: boolean;
  current?: boolean;
  claimed?: boolean;
  busy?: boolean;
  onClaim?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div
      className={[
        "rounded-xl border p-3 transition-base",
        unlocked ? "bg-card border-border shadow-soft" : "bg-secondary/60 border-border",
        current ? "ring-2 ring-accent/60" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {node.rewardKind === "perk"
              ? "Արտոնություն"
              : node.rewardKind === "title"
                ? "Տիտղոս"
                : "Նշան"}{" "}
            · {node.xp} XP
          </div>
          <div className="font-semibold text-sm leading-tight mt-0.5 break-words">
            {node.reward}
          </div>
        </div>
        {unlocked ? (
          <Check className="w-5 h-5 text-success shrink-0" />
        ) : (
          <Lock className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
        )}
      </div>
      {unlocked && !claimed && (
        <button
          onClick={onClaim}
          disabled={busy}
          className="mt-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-hero text-primary-foreground text-[11px] font-semibold hover:shadow-soft transition-base disabled:opacity-50 min-h-[44px]"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gift className="w-3 h-3" />}
          Ստանալ
        </button>
      )}
      {unlocked && claimed && (
        <div className="mt-2 text-[10px] inline-flex items-center gap-1 text-success font-semibold">
          <Check className="w-3 h-3" /> Ստացված
        </div>
      )}
    </div>
  );
}

function BonusCard({
  nextAt,
  currentXP,
  compact,
}: {
  nextAt: number;
  currentXP: number;
  compact?: boolean;
}) {
  const remaining = Math.max(0, nextAt - currentXP);
  const unlocked = remaining === 0;
  return (
    <div
      className={[
        compact ? "w-full" : "w-56 shrink-0 mt-[3.25rem]",
        "rounded-xl p-4 bg-gradient-warm text-accent-foreground shadow-soft",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 mb-1">
        <Gift className="w-4 h-4" />
        <span className="text-[10px] uppercase tracking-widest font-bold">Բոնուս</span>
      </div>
      <div className="font-semibold text-sm leading-tight">
        {unlocked ? "Ստացիր բոնուս նշանը" : "Ամեն հաջորդ 800 XP-ի համար"}
      </div>
      <div className="mt-2 text-xs opacity-90">
        {unlocked ? (
          "Պատրաստ է"
        ) : (
          <>
            Մնում է <span className="font-bold">{remaining} XP</span>
          </>
        )}
      </div>
    </div>
  );
}

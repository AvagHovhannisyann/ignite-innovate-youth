import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { callAI } from "@/lib/ai";
import { levelFromXP } from "@/lib/constants";
import { fmtDayMonth, fmtTime } from "@/lib/calendar";
import { trackGlow } from "@/lib/glow";
import { burstConfetti } from "@/lib/confetti";
import { useLevelUpCelebration } from "@/hooks/use-level-up";
import { CountUp } from "@/components/CountUp";
import {
  Sparkles,
  Loader2,
  Lightbulb,
  Calendar,
  GraduationCap,
  Trophy,
  RefreshCw,
  Rocket,
  Target,
  Zap,
  CheckCircle2,
  Clock,
  Users,
  Wrench,
  BookOpen,
  Heart,
  Wallet,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({ component: Dashboard });

function Dashboard() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [recs, setRecs] = useState<any>(null);
  const [recsMeta, setRecsMeta] = useState<{
    aiUsed: boolean;
    model: string;
    generatedAt: string;
  } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(false);
  const [startedProjects, setStartedProjects] = useState<any[]>([]);
  const [participations, setParticipations] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);

  useLevelUpCelebration(user?.id, profile?.xp);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    (async () => {
      // Fetch profile + all secondary data in parallel — show UI as soon as available.
      const [{ data: prof }, { data: cached }, { data: sp }, { data: parts }, { data: ach }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase.from("recommendations").select("*").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("started_projects")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("participations")
            .select("*, opportunities(title,category,date)")
            .eq("user_id", user.id)
            .order("joined_at", { ascending: false }),
          supabase.from("achievements").select("*").eq("user_id", user.id),
        ]);
      if (!prof?.onboarded) {
        nav({ to: "/onboarding" });
        return;
      }
      setProfile(prof);
      setStartedProjects(sp || []);
      setParticipations(parts || []);
      setAchievements(ach || []);
      if (cached) {
        setRecs(cached.data);
        setRecsMeta({
          aiUsed: cached.source === "ai",
          model: cached.source,
          generatedAt: cached.generated_at,
        });
        // A previous generation failed and cached an empty ("not-generated")
        // result — the AI may be healthy now, so retry once per browser
        // session instead of leaving the student stuck on a blank section.
        if (cached.source !== "ai" && !sessionStorage.getItem("ai-recs-retried")) {
          sessionStorage.setItem("ai-recs-retried", "1");
          void generate(prof);
        }
      } else {
        void generate(prof);
      }
    })();
  }, [user, loading, nav]);

  async function generate(prof = profile) {
    if (!prof || !user) return;
    setGenerating(true);
    setGenError(false);
    try {
      const { result, aiUsed, model, generatedAt } = await callAI("recommendations", {
        profile: prof,
      });
      setRecs(result);
      setRecsMeta({ aiUsed, model, generatedAt });
      await supabase.from("recommendations").upsert(
        {
          user_id: user.id,
          data: result,
          source: aiUsed ? "ai" : "not-generated",
          generated_at: generatedAt,
        },
        { onConflict: "user_id" },
      );
      if (aiUsed) {
        burstConfetti(window.innerWidth / 2, 180, 36);
        await supabase
          .from("notifications")
          .insert({
            user_id: user.id,
            title: "Նոր առաջարկները պատրաստ են",
            body: "Ստուգիր քո անհատականացված դասերն ու նախագծերը։",
            kind: "info",
          });
      }
    } catch (e) {
      console.error(e);
      setGenError(true);
    } finally {
      setGenerating(false);
    }
  }

  function openSuggested(idx: number) {
    if (!recs?.suggestedProjects?.[idx]) return;
    sessionStorage.setItem("ai-project", JSON.stringify(recs.suggestedProjects[idx]));
    nav({ to: "/projects/$id", params: { id: "ai" } });
  }

  if (loading || !profile)
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );

  const lvl = levelFromXP(profile.xp || 0);

  return (
    <div className="min-h-dvh bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-7xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-5 sm:py-8 pb-40 md:pb-8 overflow-hidden">
        {/* Header — greeting + XP ring bento */}
        <div
          className="bento-tile relative p-4 sm:p-6 md:p-8 mb-5 sm:mb-6 animate-rise"
          onMouseMove={trackGlow}
        >
          <div className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="min-w-0">
              <div className="text-xs sm:text-sm text-muted-foreground">{greeting()}</div>
              <h1 className="font-display text-2xl sm:text-3xl mt-1 leading-tight break-words max-w-full">
                {profile.full_name || "Ուսանող"}
              </h1>
              {profile.goal && (
                <p className="text-sm text-muted-foreground mt-2 flex items-start gap-1.5">
                  <Target className="w-3.5 h-3.5 mt-0.5 shrink-0" />{" "}
                  <span className="break-words">{profile.goal}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-3 min-w-0">
                {(profile.interests || []).slice(0, 6).map((i: string) => (
                  <span
                    key={i}
                    className="max-w-full text-[11px] sm:text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground break-words"
                  >
                    {i}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Rocket className="w-3.5 h-3.5 text-primary" />{" "}
                  <CountUp to={startedProjects.length} eager /> նախագիծ
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Trophy className="w-3.5 h-3.5 text-accent" />{" "}
                  <CountUp to={achievements.length} eager /> նշան
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Calendar className="w-3.5 h-3.5 text-success" />{" "}
                  <CountUp to={participations.length} eager /> մասնակցություն
                </span>
              </div>
            </div>
            <Link
              to="/profile"
              hash="xp-history"
              className="flex items-center gap-4 shrink-0 rounded-2xl -m-2 p-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
              title="Տես XP պատմությունը"
            >
              <XPRing pct={lvl.progressPct} level={lvl.level} />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-primary tabular-nums">
                  <CountUp to={profile.xp || 0} eager suffix=" XP" />
                </div>
                <div className="font-semibold text-sm leading-tight">{lvl.name}</div>
                {lvl.next && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Հաջորդը՝ {lvl.next.name}
                    <span className="block"><span className="tabular-nums">{lvl.next.min - (profile.xp || 0)}</span> XP մնաց</span>
                  </div>
                )}
              </div>
            </Link>
          </div>
        </div>

        <UpNext userId={user!.id} />

        {genError && (
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/25 text-sm text-destructive">
            <span>AI-ի հետ կապն ընդհատվեց, հավանաբար ծանրաբեռնվածության պատճառով։</span>
            <button
              onClick={() => generate()}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/15 hover:bg-destructive/25 font-medium disabled:opacity-50 shrink-0"
            >
              {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Կրկին փորձել
            </button>
          </div>
        )}

        {/* AI status */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6 px-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground min-w-0">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${recsMeta?.aiUsed ? "bg-success/10 border-success/30 text-success" : "bg-secondary border-border"}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${recsMeta?.aiUsed ? "bg-success" : "bg-muted-foreground"}`}
              />
              {recsMeta?.aiUsed ? "AI-ն միացված է" : "AI առաջարկներ չկան"}
            </span>
            {recsMeta && (
              <span className="break-words">
                Թարմացված է՝ {new Date(recsMeta.generatedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <button
            onClick={() => generate()}
            disabled={generating}
            className="btn btn-secondary w-full sm:w-auto min-w-0"
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            )}{" "}
            <span className="break-words min-w-0">Թարմացնել AI առաջարկները</span>
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-5 sm:gap-6 min-w-0 max-w-full overflow-hidden">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6 min-w-0 max-w-full overflow-hidden">
            <Card title="AI նախագծային գաղափարներ" icon={Lightbulb} accent delay={60}>
              {generating && !recs ? (
                <Skeleton />
              ) : (
                <div className="space-y-4">
                  {(recs?.suggestedProjects || []).map((p: any, i: number) => (
                    <ProjectIdeaCard key={i} project={p} onOpen={() => openSuggested(i)} />
                  ))}
                  {recs?.suggestedProjects?.length === 0 && (
                    <p className="text-sm text-muted-foreground">Դեռ առաջարկներ չկան։</p>
                  )}
                </div>
              )}
            </Card>

            {startedProjects.length > 0 && (
              <Card title="Քո ակտիվ նախագծերը" icon={Rocket} delay={120}>
                <div className="space-y-2">
                  {startedProjects.map((p) => (
                    <Link
                      key={p.id}
                      to="/projects/$id"
                      params={{ id: p.id }}
                      className="grid grid-cols-1 min-[460px]:grid-cols-[minmax(0,1fr)_auto] min-[460px]:items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary/50 transition-colors min-w-0 overflow-hidden text-left"
                    >
                      <div className="min-w-0">
                        <div className="font-medium break-words">{p.title}</div>
                        <div className="text-xs text-muted-foreground break-words">
                          {p.short_description}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full min-[460px]:w-24">
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-hero"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{p.progress}%</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}

            <Card title="Առաջարկվող դասեր" icon={GraduationCap} delay={180}>
              <List
                items={(recs?.recommendedLessons || []).map((l: any) => ({
                  title: l.title,
                  sub: l.reason,
                  badge: l.difficulty,
                }))}
              />
            </Card>

            <Card title="Միջոցառումներ և մաստեր-դասեր" icon={Calendar} delay={240}>
              <List
                items={[
                  ...(recs?.recommendedEvents || []).map((e: any) => ({
                    title: e.title,
                    sub: e.reason,
                    badge: e.date,
                  })),
                  ...(recs?.recommendedMasterclasses || []).map((m: any) => ({
                    title: m.title,
                    sub: m.reason,
                    badge: m.skillFocus,
                  })),
                ]}
              />
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 min-w-0 max-w-full overflow-hidden">
            <Card title="Աճի առաջարկներ" icon={Zap} delay={120}>
              <div className="space-y-2">
                {(recs?.growthSuggestions || []).map((g: any, i: number) => (
                  <div
                    key={i}
                    className="bg-card border border-border rounded-xl p-3 min-w-0 overflow-hidden"
                  >
                    <div className="font-medium text-sm break-words">{g.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 break-words">
                      {g.description}
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Ձեռքբերումներ" icon={Trophy} delay={200}>
              {achievements.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Ստացիր նշաններ՝ միանալով հնարավորություններին և սկսելով նախագծեր։
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {achievements.map((a) => (
                    <span
                      key={a.id}
                      className="max-w-full inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full bg-accent text-accent-foreground break-words"
                    >
                      <CheckCircle2 className="w-3 h-3 shrink-0" /> {a.badge}
                    </span>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Վերջին ակտիվությունը" icon={Calendar} delay={280}>
              {participations.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Մասնակցություններ դեռ չկան։{" "}
                  <Link to="/opportunities" className="text-primary hover:underline">
                    Գտիր հնարավորություններ →
                  </Link>
                </p>
              ) : (
                <ul className="space-y-2">
                  {participations.slice(0, 5).map((p) => (
                    <li
                      key={p.id}
                      className="text-sm grid grid-cols-[minmax(0,1fr)_auto] gap-2 min-w-0"
                    >
                      <span className="break-words min-w-0">{p.opportunities?.title}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {new Date(p.joined_at).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Բարի գիշեր";
  if (h < 12) return "Բարի լույս";
  if (h < 18) return "Բարի օր";
  return "Բարի երեկո";
}

/** Circular XP progress ring with the current level in the middle. */
function XPRing({ pct, level }: { pct: number; level: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * c;
  return (
    <svg
      width="88"
      height="88"
      viewBox="0 0 88 88"
      role="img"
      aria-label={`Մակարդակ ${level}, ${pct}% լրացված`}
    >
      <defs>
        <linearGradient id="xp-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.68 0.14 235)" />
          <stop offset="100%" stopColor="oklch(0.76 0.16 60)" />
        </linearGradient>
      </defs>
      <circle cx="44" cy="44" r={r} fill="none" stroke="var(--secondary)" strokeWidth="8" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke="url(#xp-ring)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${c - filled}`}
        transform="rotate(-90 44 44)"
        style={{ transition: "stroke-dasharray 700ms cubic-bezier(.2,.7,.2,1)" }}
      />
      <text
        x="44"
        y="41"
        textAnchor="middle"
        fill="var(--foreground)"
        fontSize="20"
        fontWeight="700"
        fontFamily="var(--font-display)"
      >
        {level}
      </text>
      <text
        x="44"
        y="57"
        textAnchor="middle"
        fill="var(--muted-foreground)"
        fontSize="9"
        letterSpacing="1"
      >
        ՄԱԿԱՐԴԱԿ
      </text>
    </svg>
  );
}

function Card({ title, icon: Icon, children, accent, delay = 0 }: any) {
  return (
    <section
      onMouseMove={trackGlow}
      style={{ animationDelay: `${delay}ms` }}
      className={`bento-tile animate-rise p-3 min-[380px]:p-4 sm:p-5 overflow-hidden min-w-0 max-w-full ${accent ? "" : "!bg-card"}`}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2 mb-3 sm:mb-4 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-accent text-accent-foreground grid place-items-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="font-semibold text-sm min-[380px]:text-[15px] sm:text-base leading-snug break-words min-w-0 max-w-full">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function List({ items }: { items: { title: string; sub?: string; badge?: string }[] }) {
  if (!items?.length) return <p className="text-sm text-muted-foreground">Դեռ ոչինչ չկա։</p>;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div
          key={i}
          className="grid grid-cols-1 min-[460px]:grid-cols-[minmax(0,1fr)_auto] min-[460px]:items-start gap-2 min-[460px]:gap-3 bg-card border border-border rounded-xl p-3 min-w-0 overflow-hidden"
        >
          <div className="min-w-0">
            <div className="font-medium text-sm break-words">{it.title}</div>
            {it.sub && (
              <div className="text-xs text-muted-foreground mt-0.5 break-words">{it.sub}</div>
            )}
          </div>
          {it.badge && (
            <span className="max-w-full min-[460px]:max-w-[12rem] min-[460px]:whitespace-nowrap min-[460px]:truncate text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground shrink-0 break-words text-center self-start">
              {it.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-40 rounded-xl bg-secondary animate-pulse" />
      ))}
    </div>
  );
}

function ProjectIdeaCard({ project, onOpen }: { project: any; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  const milestones: any[] = project.milestones || [];
  const tools: string[] = project?.resources?.tools || [];
  const materials: string[] = project?.resources?.materials || [];
  const topics: string[] = project?.resources?.learningTopics || [];
  const skills: string[] = project.skillsLearned || [];
  return (
    <div className="bg-card border border-border rounded-2xl hover:border-primary/50 hover:shadow-soft transition-all min-w-0 max-w-full">
      <div className="p-3 min-[380px]:p-4 sm:p-5 min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 mb-2 min-w-0">
          <h4 className="font-semibold text-base sm:text-lg min-w-0 break-words">
            {project.title}
          </h4>
          <Sparkles className="w-4 h-4 text-primary opacity-70 shrink-0 mt-1" />
        </div>
        <p className="text-sm text-muted-foreground break-words">{project.shortDescription}</p>

        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-4 gap-2 mt-4 min-w-0">
          <MiniStat icon={Clock} label="Տևողություն" value={project.timeEstimate || "—"} />
          <MiniStat icon={Zap} label="Շաբաթական" value={project.weeklyCommitment || "—"} />
          <MiniStat icon={Users} label="Թիմ" value={project.suggestedTeamSize || "—"} />
          <MiniStat icon={Target} label="Բարդություն" value={project.difficulty || "—"} />
        </div>

        <div className="flex flex-wrap gap-1.5 mt-3 min-w-0 max-w-full">
          {(project.matchingInterests || []).slice(0, 4).map((m: string) => (
            <span
              key={m}
              className="max-w-full text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground break-words"
            >
              {m}
            </span>
          ))}
        </div>

        {open && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            {project.fullDescription && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Մանրամասներ
                </div>
                <p className="text-sm leading-relaxed break-words">{project.fullDescription}</p>
              </div>
            )}

            {milestones.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Ժամանակացույց
                </div>
                <ol className="space-y-1.5">
                  {milestones.map((m, i) => (
                    <li
                      key={i}
                      className="grid grid-cols-1 min-[380px]:grid-cols-[70px_minmax(0,1fr)] gap-1 min-[380px]:gap-3 text-sm min-w-0"
                    >
                      <span className="text-xs font-semibold text-primary break-words">
                        {m.week}
                      </span>
                      <span className="text-muted-foreground break-words">{m.goal}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {(tools.length > 0 || materials.length > 0 || project?.resources?.budgetEstimate) && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Wrench className="w-3 h-3" /> Ռեսուրսներ
                </div>
                <div className="space-y-2 text-sm">
                  {tools.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Գործիքներ՝</span>
                      {tools.map((t) => (
                        <span
                          key={t}
                          className="max-w-full text-[11px] px-2 py-0.5 rounded-full bg-secondary border border-border break-words"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {materials.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Անհրաժեշտ՝</span>
                      {materials.map((t) => (
                        <span
                          key={t}
                          className="max-w-full text-[11px] px-2 py-0.5 rounded-full bg-secondary border border-border break-words"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {project?.resources?.budgetEstimate && (
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />{" "}
                      <span className="text-muted-foreground">Մոտավոր բյուջե՝</span>{" "}
                      <span className="font-medium break-words">
                        {project.resources.budgetEstimate}
                      </span>
                    </div>
                  )}
                  {topics.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Սովորելու թեմաներ՝</span>
                      {topics.map((t) => (
                        <span
                          key={t}
                          className="max-w-full text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground break-words"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {skills.length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Ինչ կսովորես
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skills.map((s) => (
                    <span
                      key={s}
                      className="max-w-full text-[11px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 break-words"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {project.impact && (
              <div className="flex items-start gap-2 bg-accent/40 rounded-lg p-3">
                <Heart className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm break-words">
                  <span className="font-semibold">Ազդեցություն՝ </span>
                  {project.impact}
                </p>
              </div>
            )}

            {(project.firstSteps || []).length > 0 && (
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Առաջին քայլերը
                </div>
                <ol className="space-y-1.5 list-decimal pl-5">
                  {(project.firstSteps || []).map((s: string, i: number) => (
                    <li key={i} className="text-sm text-muted-foreground break-words">
                      {s}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 min-w-0">
          <button
            onClick={() => setOpen((v) => !v)}
            className="btn btn-secondary w-full min-w-0"
          >
            {open ? "Թաքցնել մանրամասները" : "Տեսնել մանրամասները"}
          </button>
          <button
            onClick={onOpen}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-gradient-hero text-primary-foreground text-sm font-semibold shadow-soft hover:shadow-glow transition-all min-h-[44px] min-w-0"
          >
            <Rocket className="w-3.5 h-3.5 shrink-0" />{" "}
            <span className="break-words min-w-0">Բացել և սկսել</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** Next few calendar events; events starting within an hour get a live badge. */
function UpNext({ userId }: { userId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("schedule_events")
      .select("id,title,starts_at,ends_at,kind,all_day,location")
      .eq("user_id", userId)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at")
      .limit(3)
      .then(({ data }) => {
        if (!cancelled) setItems(data || []);
      });
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [userId]);

  if (!items.length) return null;

  const KIND_DOT: Record<string, string> = {
    study: "bg-blue-500",
    project: "bg-purple-500",
    meeting: "bg-orange-500",
    quest: "bg-emerald-500",
    opportunity: "bg-sky-500",
    other: "bg-slate-500",
  };

  return (
    <div className="mb-5 sm:mb-6 animate-rise" style={{ animationDelay: "40ms" }}>
      <div className="flex flex-wrap gap-2 min-w-0">
        {items.map((e) => {
          const start = new Date(e.starts_at).getTime();
          const minsAway = Math.round((start - now) / 60000);
          const soon = !e.all_day && minsAway > 0 && minsAway <= 60;
          const live = !e.all_day && minsAway <= 0;
          return (
            <Link
              key={e.id}
              to="/schedule"
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 min-h-[44px] bg-card min-w-0 max-w-full transition-colors hover:border-primary/50 ${
                soon || live ? "border-primary/50 shadow-glow" : "border-border"
              }`}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${KIND_DOT[e.kind] || KIND_DOT.other}`} />
              <span className="text-sm font-medium truncate">{e.title}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {e.all_day
                  ? fmtDayMonth(new Date(e.starts_at))
                  : live
                    ? "Ընթացքի մեջ"
                    : soon
                      ? `${minsAway} ր հետո`
                      : `${fmtDayMonth(new Date(e.starts_at))}, ${fmtTime(new Date(e.starts_at))}`}
              </span>
              {(soon || live) && (
                <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                  {live ? "Հիմա" : "Շուտով"}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: any) {
  return (
    <div className="bg-secondary/60 rounded-lg p-2 min-w-0 overflow-hidden">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wide min-w-0">
        <Icon className="w-3 h-3 shrink-0" />{" "}
        <span className="break-words leading-tight min-w-0">{label}</span>
      </div>
      <div className="font-semibold text-xs sm:text-sm mt-0.5 break-words leading-tight">
        {value}
      </div>
    </div>
  );
}

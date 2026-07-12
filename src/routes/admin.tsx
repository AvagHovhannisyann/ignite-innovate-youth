import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { PageLoader, EmptyState } from "@/components/PageLoader";
import { callAI, type AdminInsightsResult } from "@/lib/ai";
import { fetchPendingPosts, moderatePost, type Post } from "@/lib/feed";
import {
  reviewProject,
  fetchParticipants,
  STATUS_LABEL,
  TIER_LABEL,
  type DifficultyTier,
  type ProjectStatus,
} from "@/lib/projects";
import { fetchAllThreads, setThreadStatus, type SupportThread } from "@/lib/support";
import { ProjectChat } from "@/components/ProjectChat";
import { ThreadView } from "@/routes/support";
import { StatusBadge } from "@/components/PostCard";
import {
  Loader2,
  Users,
  Rocket,
  Sparkles,
  TrendingUp,
  RefreshCw,
  ShieldAlert,
  Lightbulb,
  ArrowRight,
  Activity,
  GraduationCap,
  Trophy,
  BarChart3,
  ShieldCheck,
  Check,
  X as XIcon,
  MessageSquare,
  Clock,
  MapPin,
  Award,
  Star,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from "recharts";
import { format, startOfWeek, subWeeks } from "date-fns";
import { hy } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";

type ParticipationWithOpportunity = Tables<"participations"> & {
  opportunities: Pick<Tables<"opportunities">, "category" | "title"> | null;
};

type AIResultMeta = { aiUsed: boolean; model: string; generatedAt: string };

export const Route = createFileRoute("/admin")({ component: Admin });

const CHART_COLORS = [
  "oklch(0.68 0.14 235)",
  "oklch(0.72 0.17 55)",
  "oklch(0.65 0.15 155)",
  "oklch(0.78 0.12 230)",
  "oklch(0.6 0.18 300)",
  "oklch(0.7 0.13 180)",
];

function Admin() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [students, setStudents] = useState<Tables<"profiles">[]>([]);
  const [projects, setProjects] = useState<Tables<"started_projects">[]>([]);
  const [parts, setParts] = useState<ParticipationWithOpportunity[]>([]);
  const [achievements, setAchievements] = useState<Tables<"achievements">[]>([]);
  const [insights, setInsights] = useState<AdminInsightsResult | null>(null);
  const [insightsMeta, setInsightsMeta] = useState<AIResultMeta | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [pendingPosts, setPendingPosts] = useState<Post[] | null>(null);
  const [pendingProjects, setPendingProjects] = useState<Tables<"started_projects">[] | null>(null);
  const [threads, setThreads] = useState<SupportThread[] | null>(null);
  const [activeThread, setActiveThread] = useState<SupportThread | null>(null);

  async function loadPending(uid: string | null) {
    try {
      setPendingPosts(await fetchPendingPosts(uid));
    } catch {
      setPendingPosts([]);
    }
  }
  async function loadPendingProjects() {
    const { data } = await supabase
      .from("started_projects")
      .select("*")
      .eq("status", "submitted")
      .order("submitted_at", { ascending: true });
    setPendingProjects(data || []);
  }
  async function loadThreads() {
    try {
      setThreads(await fetchAllThreads());
    } catch {
      setThreads([]);
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");
      const admin = !!roles?.length;
      setIsAdmin(admin);
      if (!admin) return;
      const [{ data: profs }, { data: sp }, { data: pr }, { data: ach }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("started_projects").select("*"),
        supabase.from("participations").select("*, opportunities(category,title)"),
        supabase.from("achievements").select("*"),
      ]);
      setStudents(profs || []);
      setProjects(sp || []);
      setParts(pr || []);
      setAchievements(ach || []);
      setDataLoaded(true);
      void loadPending(user.id);
      void loadPendingProjects();
      void loadThreads();
    })();
  }, [user, loading, nav]);

  const stats = useMemo(() => {
    const totalStudents = students.length;
    const onboarded = students.filter((s) => s.onboarded).length;
    const activeIds = new Set([...projects.map((p) => p.user_id), ...parts.map((p) => p.user_id)]);
    const activeStudents = activeIds.size;
    const engagementRate = totalStudents ? Math.round((activeStudents / totalStudents) * 100) : 0;

    const interestsCount: Record<string, number> = {};
    students.forEach((s) =>
      (s.interests || []).forEach((i: string) => {
        interestsCount[i] = (interestsCount[i] || 0) + 1;
      }),
    );

    const categoryCount: Record<string, number> = {};
    parts.forEach((p) => {
      const c = p.opportunities?.category;
      if (c) categoryCount[c] = (categoryCount[c] || 0) + 1;
    });

    const schoolCount: Record<string, number> = {};
    students.forEach((s) => {
      if (s.school) schoolCount[s.school] = (schoolCount[s.school] || 0) + 1;
    });

    // Weekly signups (last 8 weeks)
    const weeks: { label: string; signups: number; projects: number; participations: number }[] =
      [];
    for (let i = 7; i >= 0; i--) {
      const wStart = startOfWeek(subWeeks(new Date(), i));
      const wEnd = startOfWeek(subWeeks(new Date(), i - 1));
      weeks.push({
        label: format(wStart, "d MMM", { locale: hy }),
        signups: students.filter((s) => {
          const d = new Date(s.created_at);
          return d >= wStart && d < wEnd;
        }).length,
        projects: projects.filter((p) => {
          const d = new Date(p.created_at);
          return d >= wStart && d < wEnd;
        }).length,
        participations: parts.filter((p) => {
          const d = new Date(p.joined_at);
          return d >= wStart && d < wEnd;
        }).length,
      });
    }

    return {
      totalStudents,
      onboarded,
      activeStudents,
      engagementRate,
      interestsCount,
      categoryCount,
      schoolCount,
      weeks,
      projectCount: projects.length,
      participationCount: parts.length,
      achievementCount: achievements.length,
      sortedInterests: Object.entries(interestsCount).sort((a, b) => b[1] - a[1]),
      sortedCategories: Object.entries(categoryCount).sort((a, b) => b[1] - a[1]),
      sortedSchools: Object.entries(schoolCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6),
    };
  }, [students, projects, parts, achievements]);

  async function generateInsights() {
    setInsightsLoading(true);
    setInsightsError(false);
    try {
      const { result, aiUsed, model, generatedAt } = await callAI("admin_insights", {
        data: {
          totalStudents: stats.totalStudents,
          activeStudents: stats.activeStudents,
          interestsCount: stats.interestsCount,
          projectCount: stats.projectCount,
          categoryCount: stats.categoryCount,
        },
      });
      setInsights(result);
      setInsightsMeta({ aiUsed, model, generatedAt });
    } catch (e) {
      console.error(e);
      setInsightsError(true);
    } finally {
      setInsightsLoading(false);
    }
  }

  if (loading || isAdmin === null)
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );

  if (!isAdmin) {
    return (
      <div className="min-h-dvh bg-gradient-soft">
        <Navbar />
        <div className="max-w-md mx-auto px-4 py-20 text-center card-base p-8 mt-10">
          <ShieldAlert className="w-10 h-10 text-primary mx-auto mb-3" />
          <h2 className="font-display text-xl font-bold">Ադմինի հասանելիություն է պահանջվում</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Քո հաշիվը չունի ադմինի դեր։ Դիմիր հարթակի պատասխանատուին՝ հասանելիություն ստանալու
            համար։
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-7xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-6 sm:py-8 pb-32 md:pb-8">
        <header className="mb-8 animate-rise min-w-0">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold mb-2 max-w-full">
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />{" "}
            <span className="break-words">Ադմինիստրացիա</span>
          </div>
          <h1 className="font-display text-2xl min-[380px]:text-3xl md:text-4xl font-bold break-words leading-tight">
            Կառավարում և վերլուծություն
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl break-words">
            Ուսանողների հետաքրքրությունների, նախագծերի և ակտիվության թարմ պատկերը։
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              to="/admin/quest-reviews"
              className="inline-flex items-center gap-1.5 px-3 min-h-[44px] rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20"
            >
              <Check className="w-4 h-4" /> Քվեստների ստուգում
            </Link>
          </div>
        </header>

        {!dataLoaded ? (
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <KPI
              icon={Users}
              label="Ընդհանուր ուսանողներ"
              value={stats.totalStudents}
              hint={`${stats.onboarded} ավարտել են մուտքագրումը`}
            />
            <KPI
              icon={Activity}
              label="Ներգրավվածություն"
              value={`${stats.engagementRate}%`}
              hint={`${stats.activeStudents} ակտիվ ուսանող`}
            />
            <KPI icon={Rocket} label="Մեկնարկած նախագծեր" value={stats.projectCount} />
            <KPI icon={Trophy} label="Ստացած նշաններ" value={stats.achievementCount} />
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-5 sm:gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Section
              title="Շաբաթական ակտիվություն"
              icon={TrendingUp}
              subtitle="Գրանցումներ, նախագծեր և մասնակցություններ՝ վերջին 8 շաբաթում"
            >
              {stats.weeks.every((w) => w.signups + w.projects + w.participations === 0) ? (
                <p className="text-sm text-muted-foreground">
                  Դեռ բավարար ակտիվություն չկա միտումը ցույց տալու համար։
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <AreaChart
                      data={stats.weeks}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS[1]} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={CHART_COLORS[1]} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={CHART_COLORS[2]} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={CHART_COLORS[2]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="oklch(0.92 0.012 230)" strokeDasharray="3 3" />
                      <XAxis dataKey="label" stroke="oklch(0.5 0.025 240)" fontSize={11} />
                      <YAxis stroke="oklch(0.5 0.025 240)" fontSize={11} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          background: "white",
                          border: "1px solid oklch(0.92 0.012 230)",
                          borderRadius: 12,
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area
                        type="monotone"
                        dataKey="signups"
                        stroke={CHART_COLORS[0]}
                        fill="url(#g1)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="projects"
                        stroke={CHART_COLORS[1]}
                        fill="url(#g2)"
                        strokeWidth={2}
                      />
                      <Area
                        type="monotone"
                        dataKey="participations"
                        stroke={CHART_COLORS[2]}
                        fill="url(#g3)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Section>

            <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
              <Section title="Առաջատար հետաքրքրություններ" icon={TrendingUp}>
                {stats.sortedInterests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Հետաքրքրությունների տվյալներ դեռ չկան։
                  </p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer>
                      <RBarChart
                        data={stats.sortedInterests
                          .slice(0, 8)
                          .map(([k, v]) => ({ name: k, value: v }))}
                        layout="vertical"
                        margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="oklch(0.92 0.012 230)"
                          strokeDasharray="3 3"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          stroke="oklch(0.5 0.025 240)"
                          fontSize={11}
                          allowDecimals={false}
                        />
                        <YAxis
                          dataKey="name"
                          type="category"
                          stroke="oklch(0.5 0.025 240)"
                          fontSize={11}
                          width={90}
                        />
                        <Tooltip
                          contentStyle={{
                            background: "white",
                            border: "1px solid oklch(0.92 0.012 230)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} fill={CHART_COLORS[0]} />
                      </RBarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Section>

              <Section title="Պահանջված ուղղություններ" icon={Rocket}>
                {stats.sortedCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Մասնակցություններ դեռ չկան։</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie
                          data={stats.sortedCategories.map(([k, v]) => ({ name: k, value: v }))}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {stats.sortedCategories.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: "white",
                            border: "1px solid oklch(0.92 0.012 230)",
                            borderRadius: 12,
                            fontSize: 12,
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Section>
            </div>

            <Section
              title={`Մոդերացիա — սպասում են ${pendingPosts?.length ?? 0}`}
              icon={ShieldCheck}
              subtitle="Հաստատիր կամ մերժիր օգտատերերի գրառումները"
            >
              {pendingPosts === null ? (
                <div className="h-20 rounded-xl bg-secondary animate-pulse" />
              ) : pendingPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Սպասող գրառումներ չկան։</p>
              ) : (
                <div className="space-y-4">
                  {pendingPosts.map((p) => (
                    <ModerationItem
                      key={p.id}
                      post={p}
                      onDone={() => loadPending(user?.id || null)}
                    />
                  ))}
                </div>
              )}
            </Section>

            <Section
              title={`Նախագծերի ստուգում — ${pendingProjects?.length ?? 0}`}
              icon={Award}
              subtitle="Թիմերն ուղարկել են իրենց նախագծերը ստուգման։ Տես չատը, գնահատիր որակը։"
            >
              {pendingProjects === null ? (
                <div className="h-20 rounded-xl bg-secondary animate-pulse" />
              ) : pendingProjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">Սպասող նախագծեր չկան։</p>
              ) : (
                <div className="space-y-4">
                  {pendingProjects.map((p) => (
                    <ProjectReviewItem
                      key={p.id}
                      project={p}
                      adminId={user!.id}
                      onDone={loadPendingProjects}
                    />
                  ))}
                </div>
              )}
            </Section>

            <Section
              title={`Աջակցության հարցումներ — ${threads?.filter((t) => t.status !== "closed").length ?? 0}`}
              icon={LifeBuoy}
              subtitle="Օգտատերերի հարցումներ՝ պատասխանիր ուղիղ այստեղ։"
            >
              {threads === null ? (
                <div className="h-20 rounded-xl bg-secondary animate-pulse" />
              ) : threads.length === 0 ? (
                <p className="text-sm text-muted-foreground">Հարցումներ չկան։</p>
              ) : activeThread ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    Օգտատեր՝{" "}
                    <span className="font-medium text-foreground">
                      {activeThread.user?.full_name ||
                        activeThread.user?.email ||
                        activeThread.user_id.slice(0, 8)}
                    </span>
                  </div>
                  <ThreadView
                    userId={user!.id}
                    thread={activeThread}
                    isAdmin
                    onBack={() => {
                      setActiveThread(null);
                      void loadThreads();
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        await setThreadStatus(activeThread.id, "closed");
                        setActiveThread(null);
                        void loadThreads();
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-secondary border border-border hover:bg-card"
                    >
                      Փակել հարցումը
                    </button>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {threads.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => setActiveThread(t)}
                        className="w-full text-left bg-secondary/40 hover:bg-secondary border border-border rounded-xl p-3 transition-base"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{t.subject}</div>
                            <div className="text-[11px] text-muted-foreground truncate">
                              {t.user?.full_name || t.user?.email || t.user_id.slice(0, 8)} ·{" "}
                              {new Date(t.last_message_at).toLocaleString("hy-AM")}
                            </div>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                              t.status === "answered"
                                ? "bg-success/15 text-success"
                                : t.status === "closed"
                                  ? "bg-secondary text-muted-foreground"
                                  : "bg-primary/10 text-primary"
                            }`}
                          >
                            {t.status === "answered"
                              ? "Պատասխանված"
                              : t.status === "closed"
                                ? "Փակ"
                                : "Բաց"}
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Վերջերս մեկնարկած նախագծեր" icon={Sparkles}>
              {projects.length === 0 ? (
                <EmptyState
                  icon={Rocket}
                  title="Նախագծեր դեռ չկան"
                  description="Ուսանողի մեկնարկած առաջին նախագիծը կհայտնվի այստեղ։"
                />
              ) : (
                <div className="space-y-2">
                  {projects.slice(0, 8).map((p) => (
                    <div
                      key={p.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 bg-secondary/40 rounded-xl p-3 transition-base hover:bg-secondary min-w-0 overflow-hidden"
                    >
                      <div className="min-w-0">
                        <div className="font-medium break-words">{p.title}</div>
                        <div className="text-xs text-muted-foreground break-words">
                          {p.short_description}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{p.progress}%</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>

          <div className="space-y-6">
            <section className="bg-gradient-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft overflow-hidden min-w-0">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Lightbulb className="w-4 h-4 text-primary shrink-0" />
                  <h3 className="font-semibold break-words min-w-0">AI վերլուծություն</h3>
                </div>
                <button
                  onClick={generateInsights}
                  disabled={insightsLoading}
                  className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border hover:bg-secondary transition-base disabled:opacity-50"
                >
                  {insightsLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}{" "}
                  Ստեղծել
                </button>
              </div>
              {insightsMeta && (
                <div
                  className={`text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full mb-3 ${insightsMeta.aiUsed ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${insightsMeta.aiUsed ? "bg-success" : "bg-muted-foreground"}`}
                  />
                  {insightsMeta.aiUsed ? "AI" : "Չգեներացված"}
                </div>
              )}
              {insightsError && (
                <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/25 text-xs text-destructive">
                  <span>Չհաջողվեց ստեղծել վերլուծությունը։</span>
                  <button onClick={generateInsights} className="underline font-medium shrink-0">
                    Կրկին փորձել
                  </button>
                </div>
              )}
              {!insights ? (
                <p className="text-sm text-muted-foreground">
                  Ստեղծիր վերլուծություն՝ հաջորդ ծրագրերի AI առաջարկները տեսնելու համար։
                </p>
              ) : (
                <div className="space-y-4 text-sm">
                  {insights.summary ? (
                    <p className="text-foreground break-words">{insights.summary}</p>
                  ) : (
                    <p className="text-muted-foreground">AI վերլուծություն դեռ չի ստեղծվել։</p>
                  )}
                  <InsightList title="Հիմնական դիտարկումներ" items={insights.keyInsights} />
                  <InsightList title="Առաջարկվող ծրագրեր" items={insights.recommendedPrograms} />
                  <InsightList
                    title="Նախագծային ուղղություններ"
                    items={insights.recommendedProjectDirections}
                  />
                  <InsightList
                    title="Հաջորդ քայլեր"
                    items={insights.nextActions}
                    icon={ArrowRight}
                  />
                  <InsightList
                    title="Ներգրավվածության ռիսկեր"
                    items={insights.engagementRisks}
                    muted
                  />
                </div>
              )}
            </section>

            <Section title="Առաջատար դպրոցներ" icon={GraduationCap}>
              {stats.sortedSchools.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Դպրոցները կհայտնվեն, երբ ուսանողները լրացնեն իրենց պրոֆիլները։
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {stats.sortedSchools.map(([s, n]) => (
                    <li
                      key={s}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-w-0"
                    >
                      <span className="break-words min-w-0">{s}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground shrink-0">
                        {n}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Ամենաակտիվ ուսանողներ" icon={Users}>
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ուսանողներ դեռ չկան։</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {[...students]
                    .sort((a, b) => (b.xp || 0) - (a.xp || 0))
                    .slice(0, 6)
                    .map((s) => (
                      <li
                        key={s.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-w-0"
                      >
                        <span className="break-words min-w-0">{s.full_name || s.email}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {s.xp || 0} XP
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="bg-gradient-card border border-border rounded-2xl p-4 shadow-soft transition-base hover:shadow-elegant overflow-hidden min-w-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
        <Icon className="w-3.5 h-3.5 shrink-0" />{" "}
        <span className="break-words min-w-0">{label}</span>
      </div>
      <div className="text-2xl md:text-3xl font-bold mt-2 text-primary tabular-nums font-display break-words">
        {value}
      </div>
      {hint && <div className="text-[11px] text-muted-foreground mt-1 break-words">{hint}</div>}
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="card-base p-4 sm:p-5 overflow-hidden min-w-0">
      <div className="flex items-start justify-between gap-3 mb-4 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className="w-4 h-4 text-primary shrink-0" />
            <h3 className="font-semibold break-words min-w-0">{title}</h3>
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 break-words">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function InsightList({
  title,
  items,
  muted,
  icon: Icon,
}: {
  title: string;
  items?: string[];
  muted?: boolean;
  icon?: LucideIcon;
}) {
  if (!items?.length) return null;
  return (
    <div>
      <div
        className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${muted ? "text-muted-foreground" : "text-primary"}`}
      >
        {title}
      </div>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm flex items-start gap-1.5 text-muted-foreground min-w-0">
            {Icon ? (
              <Icon className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
            ) : (
              <span className="w-1 h-1 rounded-full bg-muted-foreground mt-2 shrink-0" />
            )}
            <span className="break-words min-w-0">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModerationItem({ post, onDone }: { post: Post; onDone: () => void }) {
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  async function approve() {
    setBusy("approve");
    try {
      await moderatePost(post.id, true);
      onDone();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց հաստատել հրապարակումը"));
    } finally {
      setBusy(null);
    }
  }
  async function reject() {
    if (!reason.trim()) {
      toast.error("Մուտքագրիր մերժման պատճառը");
      return;
    }
    setBusy("reject");
    try {
      await moderatePost(post.id, false, reason.trim());
      onDone();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց մերժել հրապարակումը"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-secondary/40 border border-border rounded-xl p-3 sm:p-4 min-w-0">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap min-w-0">
        <span className="font-medium text-foreground break-words">
          {post.author?.full_name || "Օգտատեր"}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(post.created_at).toLocaleString()}
        </span>
        {post.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {post.location}
          </span>
        )}
        <StatusBadge status={post.status} />
      </div>
      {post.title && (
        <h4 className="font-semibold text-sm sm:text-base break-words">{post.title}</h4>
      )}
      {post.content && (
        <p className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
          {post.content}
        </p>
      )}
      {(post.signed_media || []).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {post.signed_media!.map((m, i) => (
            <div key={i} className="aspect-square bg-background rounded-lg overflow-hidden">
              {m.type === "video" ? (
                <video
                  src={m.url}
                  controls
                  playsInline
                  aria-label={`Գրառման կցված տեսանյութ ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={m.url}
                  alt={`Գրառման կցված նկար ${i + 1}`}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ))}
        </div>
      )}
      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {post.tags.map((t) => (
            <span
              key={t}
              className="text-[10px] px-2 py-0.5 rounded-full bg-card border border-border break-words"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {showReject && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Մերժման պատճառ
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            aria-label="Գրառման մերժման պատճառ"
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
          />
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          onClick={approve}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 min-h-[40px]"
        >
          {busy === "approve" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}{" "}
          Հաստատել
        </button>
        {showReject ? (
          <button
            onClick={reject}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 min-h-[40px]"
          >
            {busy === "reject" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XIcon className="w-4 h-4" />
            )}{" "}
            Մերժել
          </button>
        ) : (
          <button
            onClick={() => setShowReject(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium hover:bg-secondary min-h-[40px]"
          >
            <XIcon className="w-4 h-4" /> Մերժել…
          </button>
        )}
        {showReject && (
          <button
            onClick={() => {
              setShowReject(false);
              setReason("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Չեղարկել
          </button>
        )}
      </div>
    </div>
  );
}

function ProjectReviewItem({
  project,
  adminId,
  onDone,
}: {
  project: Tables<"started_projects">;
  adminId: string;
  onDone: () => void;
}) {
  const [showChat, setShowChat] = useState(false);
  const [exceptional, setExceptional] = useState(false);
  const [rating, setRating] = useState<number>(4);
  const [reason, setReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const tier = (project.difficulty_tier || "easy") as DifficultyTier;

  async function approve() {
    setBusy("approve");
    try {
      await reviewProject(project.id, { approve: true, exceptional, rating });
      onDone();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց հաստատել նախագիծը"));
    } finally {
      setBusy(null);
    }
  }
  async function reject() {
    if (!reason.trim()) {
      toast.error("Մուտքագրիր մերժման պատճառը");
      return;
    }
    setBusy("reject");
    try {
      await reviewProject(project.id, { approve: false, reason });
      onDone();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց մերժել նախագիծը"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bg-secondary/40 border border-border rounded-xl p-3 sm:p-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2 mb-2 text-xs">
        <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/30">
          {TIER_LABEL[tier]}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-card border border-border">
          {STATUS_LABEL[project.status as ProjectStatus] || project.status}
        </span>
        {project.submitted_at && (
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(project.submitted_at).toLocaleString()}
          </span>
        )}
      </div>
      <h4 className="font-semibold break-words">{project.title}</h4>
      {project.short_description && (
        <p className="text-sm text-muted-foreground mt-1 break-words">
          {project.short_description}
        </p>
      )}

      <button
        onClick={() => setShowChat((v) => !v)}
        className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium min-h-[40px]"
      >
        <MessageSquare className="w-4 h-4" /> {showChat ? "Փակել" : "Տես ապացույցները / չատը"}
      </button>

      {showChat && (
        <div className="mt-3">
          <ProjectChat projectId={project.id} userId={adminId} canPost={false} />
        </div>
      )}

      <div className="mt-4 grid sm:grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-sm bg-card border border-border rounded-lg p-2.5">
          <input
            type="checkbox"
            checked={exceptional}
            onChange={(e) => setExceptional(e.target.checked)}
          />
          <span>Բացառիկ կատարում (ավելի շատ XP)</span>
        </label>
        <div className="bg-card border border-border rounded-lg p-2.5 flex items-center gap-2 text-sm">
          <Star className="w-4 h-4 text-primary" />
          <span>Գնահատական:</span>
          <select
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
            aria-label="Նախագծի գնահատական"
            className="ml-auto bg-background border border-input rounded px-2 py-1 text-sm"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showReject && (
        <div className="mt-3">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Մերժման պատճառ
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={1000}
            aria-label="Նախագծի մերժման պատճառ"
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm"
          />
        </div>
      )}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <button
          onClick={approve}
          disabled={!!busy}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-success text-success-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 min-h-[40px]"
        >
          {busy === "approve" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}{" "}
          Հաստատել
        </button>
        {showReject ? (
          <button
            onClick={reject}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 min-h-[40px]"
          >
            {busy === "reject" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XIcon className="w-4 h-4" />
            )}{" "}
            Մերժել
          </button>
        ) : (
          <button
            onClick={() => setShowReject(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-card border border-border text-sm font-medium hover:bg-secondary min-h-[40px]"
          >
            <XIcon className="w-4 h-4" /> Մերժել…
          </button>
        )}
      </div>
    </div>
  );
}

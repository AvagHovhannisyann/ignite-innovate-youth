import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { ALL_INTERESTS } from "@/lib/constants";
import { fetchMyPosts, deletePost, signMedia, type Post } from "@/lib/feed";
import { fetchUserRank } from "@/lib/projects";
import { StatusBadge } from "@/components/PostCard";
import {
  Loader2,
  Save,
  User as UserIcon,
  Mail,
  Phone,
  School,
  Target,
  Sparkles,
  Trophy,
  Rocket,
  Calendar,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Pencil,
  Trash2,
  Plus,
  MessageSquare,
  Award,
  Coins,
  LifeBuoy,
  X,
  Star,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ParticipationWithOpportunity = Tables<"participations"> & {
  opportunities: Pick<Tables<"opportunities">, "title" | "category" | "date"> | null;
};

type QuestAward = Pick<Tables<"user_quests">, "template_id" | "awarded_at"> & {
  quest_templates: Pick<Tables<"quest_templates">, "title" | "xp"> | null;
};

export const Route = createFileRoute("/profile")({ component: ProfilePage });

const SKILLS = [
  "գրել",
  "ծրագրավորում",
  "նկարչություն",
  "հռետորություն",
  "խմբագրում",
  "պլանավորում",
  "հետազոտություն",
  "դիզայն",
  "առաջնորդություն",
  "լուսանկարչություն",
];
const AVAILABILITY = [
  "Մի քանի ժամ / շաբաթ",
  "Մի քանի ժամից ավելի / շաբաթ",
  "Միայն հանգստյան օրեր",
  "Երեկոյան",
  "Ճկուն",
];
const RANK_LABELS: Record<string, string> = {
  Unranked: "Առանց վարկանիշի",
  Bronze: "Բրոնզե",
  Silver: "Արծաթե",
  Gold: "Ոսկե",
  Platinum: "Պլատինե",
  Diamond: "Ադամանդե",
};

function ProfilePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [participations, setParticipations] = useState<ParticipationWithOpportunity[]>([]);
  const [startedProjects, setStartedProjects] = useState<Tables<"started_projects">[]>([]);
  const [achievements, setAchievements] = useState<Tables<"achievements">[]>([]);
  const [myPosts, setMyPosts] = useState<Post[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [rank, setRank] = useState<Awaited<ReturnType<typeof fetchUserRank>> | null>(null);
  const [questAwards, setQuestAwards] = useState<QuestAward[]>([]);
  const [showCustomSkill, setShowCustomSkill] = useState(false);
  const [customSkill, setCustomSkill] = useState("");

  function addCustomSkill() {
    const v = customSkill.trim();
    if (!v) return;
    setProfile((current) => {
      if (!current) return current;
      const skills = current.skills || [];
      if (skills.some((skill) => skill.toLowerCase() === v.toLowerCase())) return current;
      return { ...current, skills: [...skills, v] };
    });
    setCustomSkill("");
  }

  async function loadMyPosts(uid: string) {
    try {
      setMyPosts(await fetchMyPosts(uid));
    } catch {
      setMyPosts([]);
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    (async () => {
      const [{ data: prof }, { data: parts }, { data: sp }, { data: ach }, { data: qa }] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).single(),
          supabase
            .from("participations")
            .select("*, opportunities(title,category,date)")
            .eq("user_id", user.id)
            .order("joined_at", { ascending: false }),
          supabase
            .from("started_projects")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("achievements")
            .select("*")
            .eq("user_id", user.id)
            .order("earned_at", { ascending: false }),
          supabase
            .from("user_quests")
            .select("template_id,awarded_at,quest_templates(title,xp)")
            .eq("user_id", user.id)
            .eq("awarded", true)
            .order("awarded_at", { ascending: false }),
        ]);
      const resolvedProfile = prof ?? (await supabase.rpc("ensure_my_profile")).data;
      setProfile(resolvedProfile);
      setParticipations(parts || []);
      setStartedProjects(sp || []);
      setAchievements(ach || []);
      setQuestAwards(qa || []);
      void loadMyPosts(user.id);
      fetchUserRank(user.id)
        .then(setRank)
        .catch((error: unknown) => console.error("Could not load profile rank", error));
    })();
  }, [user, loading, nav]);

  function set<K extends keyof Tables<"profiles">>(key: K, value: Tables<"profiles">[K]) {
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  }
  function toggle(field: "interests" | "skills", item: string) {
    setProfile((current) => {
      if (!current) return current;
      const values = current[field] || [];
      return {
        ...current,
        [field]: values.includes(item)
          ? values.filter((value) => value !== item)
          : [...values, item],
      };
    });
  }

  async function save() {
    if (!user || !profile) return;
    setSaving(true);
    setStatus(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        age: profile.age || null,
        phone: profile.phone,
        school: profile.school,
        bio: profile.bio,
        interests: profile.interests || [],
        skills: profile.skills || [],
        goal: profile.goal,
        availability: profile.availability,
        preferred_project_type: profile.preferred_project_type,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) setStatus({ kind: "err", msg: error.message });
    else setStatus({ kind: "ok", msg: "Տվյալները թարմացված են" });
    setTimeout(() => setStatus(null), 3500);
  }

  // Real XP ledger, derived from existing per-project/per-quest reward columns
  // — no separate transactions table needed. Must run before the early
  // return below so hook order stays consistent across renders.
  const xpHistory = useMemo(() => {
    type Entry = { date: string; label: string; amount: number; icon: LucideIcon };
    const out: Entry[] = [];
    for (const p of startedProjects) {
      if (p.xp_cost) {
        out.push({
          date: p.created_at,
          label: `Սկսվեց՝ «${p.title}»`,
          amount: -p.xp_cost,
          icon: Rocket,
        });
      }
      if (p.status === "approved" && p.approved_at) {
        const award = p.quality === "exceptional" ? p.xp_reward_exceptional : p.xp_reward_standard;
        if (award) {
          out.push({
            date: p.approved_at,
            label:
              p.quality === "exceptional" ? `Բացառիկ՝ «${p.title}»` : `Հաստատվեց՝ «${p.title}»`,
            amount: award,
            icon: CheckCircle2,
          });
        }
      }
    }
    for (const q of questAwards) {
      const tpl = q.quest_templates;
      if (!tpl?.xp || !q.awarded_at) continue;
      out.push({ date: q.awarded_at, label: `Քվեսթ՝ «${tpl.title}»`, amount: tpl.xp, icon: Award });
    }
    return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [startedProjects, questAwards]);

  if (loading || !profile) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const stats = [
    { label: "Հաստատված նախագծեր", value: rank?.completed ?? 0, icon: Rocket },
    { label: "Միացած հնարավորություններ", value: participations.length, icon: Calendar },
    { label: "Ձեռքբերումներ", value: achievements.length, icon: Trophy },
    { label: "XP մնացորդ", value: profile.xp || 0, icon: Coins },
  ];

  return (
    <div className="min-h-dvh bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-6xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-5 sm:py-10 pb-32 md:pb-10">
        {/* Header */}
        <div className="bg-gradient-card border border-border rounded-2xl p-4 sm:p-8 shadow-soft mb-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-hero grid place-items-center text-primary-foreground text-3xl font-bold shrink-0 shadow-elegant">
              {(profile.full_name || profile.email || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight break-words">
                {profile.full_name || "Իմ էջը"}
              </h1>
              <p className="text-sm text-muted-foreground break-all">{profile.email}</p>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-semibold border border-primary/30">
                  <Award className="w-3.5 h-3.5" /> {RANK_LABELS[rank?.tier || "Unranked"]} ·{" "}
                  {rank?.score ?? 0} միավոր
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground">
                  <Coins className="w-3.5 h-3.5" /> {profile.xp || 0} XP
                </span>
                <Link
                  to="/support"
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full bg-card border border-border hover:bg-secondary transition-base min-h-[36px]"
                >
                  <LifeBuoy className="w-3.5 h-3.5" /> Աջակցություն
                </Link>
              </div>
              {rank && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Հաստատված՝ {rank.completed}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Բացառիկ՝ {rank.exceptional}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Միջին գնահ.՝ {rank.avg_rating}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Ակտիվ.՝ {rank.activity}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {stats.map((s) => (
            <div key={s.label} className="card-base rounded-xl p-3 sm:p-4 overflow-hidden min-w-0">
              <div className="flex items-start gap-2 text-muted-foreground mb-1.5 min-w-0">
                <s.icon className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="text-xs leading-snug break-words">{s.label}</span>
              </div>
              <div className="text-2xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Edit form */}
          <div className="lg:col-span-2 space-y-6">
            <Section title="Անձնական տվյալներ" icon={UserIcon}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Անուն Ազգանուն">
                  <input
                    value={profile.full_name || ""}
                    onChange={(e) => set("full_name", e.target.value)}
                    maxLength={120}
                    aria-label="Անուն Ազգանուն"
                    className={inputCls}
                  />
                </Field>
                <Field label="Տարիք">
                  <input
                    type="number"
                    min={10}
                    max={100}
                    value={profile.age || ""}
                    onChange={(e) => set("age", e.target.value ? Number(e.target.value) : null)}
                    aria-label="Տարիք"
                    className={inputCls}
                  />
                </Field>
                <Field label="Էլ. հասցե" hint="Օգտագործվում է մուտքի համար (չի փոփոխվում)">
                  <div
                    className={`${inputCls} flex items-center gap-2 text-muted-foreground bg-secondary/40 min-w-0`}
                  >
                    <Mail className="w-4 h-4 shrink-0" />{" "}
                    <span className="break-all min-w-0">{profile.email}</span>
                  </div>
                </Field>
                <Field label="Հեռախոս">
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={profile.phone || ""}
                      onChange={(e) => set("phone", e.target.value)}
                      maxLength={40}
                      aria-label="Հեռախոս"
                      className={`${inputCls} pl-9`}
                      placeholder="+374 ..."
                    />
                  </div>
                </Field>
                <Field label="Դպրոց / Համալսարան" className="sm:col-span-2">
                  <div className="relative">
                    <School className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={profile.school || ""}
                      onChange={(e) => set("school", e.target.value)}
                      maxLength={200}
                      aria-label="Դպրոց կամ համալսարան"
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                </Field>
                <Field label="Կարճ ներկայացում" className="sm:col-span-2">
                  <textarea
                    rows={3}
                    value={profile.bio || ""}
                    onChange={(e) => set("bio", e.target.value)}
                    maxLength={2000}
                    aria-label="Կարճ ներկայացում"
                    className={inputCls}
                    placeholder="Մեկ-երկու նախադասությամբ քո մասին։"
                  />
                </Field>
              </div>
            </Section>

            <Section title="Նպատակներ և հասանելիություն" icon={Target}>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Անձնական նպատակ" className="sm:col-span-2">
                  <textarea
                    rows={2}
                    value={profile.goal || ""}
                    onChange={(e) => set("goal", e.target.value)}
                    maxLength={1000}
                    aria-label="Անձնական նպատակ"
                    className={inputCls}
                    placeholder="Ի՞նչ ես ուզում ստեղծել կամ սովորել հաջորդիվ։"
                  />
                </Field>
                <Field label="Հասանելիություն">
                  <select
                    value={profile.availability || ""}
                    onChange={(e) => set("availability", e.target.value)}
                    aria-label="Հասանելիություն"
                    className={inputCls}
                  >
                    <option value="">Ընտրել…</option>
                    {AVAILABILITY.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Նախընտրելի տեսակ">
                  <select
                    value={profile.preferred_project_type || ""}
                    onChange={(e) => set("preferred_project_type", e.target.value)}
                    aria-label="Նախընտրելի նախագծի տեսակ"
                    className={inputCls}
                  >
                    <option value="">Ընտրել…</option>
                    {[
                      { value: "Lessons", label: "Դասեր" },
                      { value: "Events", label: "Միջոցառումներ" },
                      { value: "Workshops", label: "Աշխատանոցներ" },
                      { value: "Projects", label: "Նախագծեր" },
                    ].map((a) => (
                      <option key={a.value} value={a.value}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>

            <Section
              title="Հետաքրքրություններ"
              icon={Sparkles}
              subtitle="Օգտագործվում են քո AI առաջարկները անհատականացնելու համար"
            >
              <div className="flex flex-wrap gap-2">
                {ALL_INTERESTS.map((i) => {
                  const on = (profile.interests || []).includes(i);
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggle("interests", i)}
                      className={`min-h-[44px] px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-all break-words ${on ? "bg-gradient-hero text-primary-foreground border-transparent shadow-soft" : "bg-card border-border hover:border-primary/30"}`}
                    >
                      {i}
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Հմտություններ" icon={Trophy}>
              <div className="flex flex-wrap gap-2">
                {SKILLS.map((s) => {
                  const on = (profile.skills || []).includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggle("skills", s)}
                      className={`min-h-[44px] px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-all break-words ${on ? "bg-foreground text-background border-transparent" : "bg-card border-border hover:border-primary/30"}`}
                    >
                      {s}
                    </button>
                  );
                })}
                {(profile.skills || [])
                  .filter((s: string) => !SKILLS.includes(s))
                  .map((s: string) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggle("skills", s)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm border border-transparent bg-foreground text-background break-words"
                    >
                      {s} <X className="w-3 h-3" />
                    </button>
                  ))}
                <button
                  type="button"
                  onClick={() => setShowCustomSkill((v) => !v)}
                  className={`min-h-[44px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-all ${showCustomSkill ? "border-primary text-primary bg-primary/5" : "bg-card border-border border-dashed hover:border-primary/30"}`}
                >
                  <Plus className="w-3.5 h-3.5" /> Այլ
                </button>
              </div>
              {showCustomSkill && (
                <div className="flex items-center gap-2 mt-2.5 animate-rise">
                  <input
                    autoFocus
                    value={customSkill}
                    onChange={(e) => setCustomSkill(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomSkill();
                      }
                    }}
                    maxLength={40}
                    aria-label="Այլ հմտություն"
                    placeholder="Գրիր քո հմտությունը…"
                    className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2.5 rounded-lg border border-input bg-background text-sm"
                  />
                  <button
                    type="button"
                    onClick={addCustomSkill}
                    disabled={!customSkill.trim()}
                    className="btn btn-primary shrink-0"
                  >
                    Ավելացնել
                  </button>
                </div>
              )}
            </Section>

            <div className="sticky bottom-28 md:bottom-4 z-10 flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center justify-between gap-3 card-base rounded-2xl p-3 sm:p-4 shadow-elegant overflow-hidden">
              <div
                className="text-xs sm:text-sm text-muted-foreground min-w-0 flex-1"
                aria-live="polite"
              >
                {status ? (
                  <span
                    role={status.kind === "ok" ? "status" : "alert"}
                    className={`inline-flex items-center gap-1.5 ${status.kind === "ok" ? "text-success" : "text-destructive"}`}
                  >
                    {status.kind === "ok" ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    {status.msg}
                  </span>
                ) : (
                  "Փոփոխությունները պահպանվում են միայն քո հաշվում։"
                )}
              </div>
              <button onClick={save} disabled={saving} className="btn btn-primary">
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Պահպանել փոփոխությունները
              </button>
            </div>
          </div>

          {/* Sidebar: activity */}
          <div className="space-y-6">
            <Section title="Միացած հնարավորություններ" icon={Calendar}>
              {participations.length === 0 ? (
                <EmptyState
                  icon={Calendar}
                  text="Դեռ չես միացել ոչ մի հնարավորության։"
                  cta={
                    <Link
                      to="/opportunities"
                      className="text-primary text-sm font-medium hover:underline"
                    >
                      Տեսնել հնարավորությունները →
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {participations.slice(0, 8).map((p) => (
                    <li
                      key={p.id}
                      className="flex items-start justify-between gap-2 text-sm min-w-0"
                    >
                      <div className="min-w-0">
                        <div className="font-medium break-words">{p.opportunities?.title}</div>
                        <div className="text-xs text-muted-foreground capitalize break-words">
                          {p.opportunities?.category}
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {new Date(p.joined_at).toLocaleDateString("hy-AM")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Քո նախագծերը" icon={Rocket}>
              {startedProjects.length === 0 ? (
                <EmptyState
                  icon={Rocket}
                  text="Դեռ ակտիվ նախագծեր չկան։"
                  cta={
                    <Link
                      to="/dashboard"
                      className="text-primary text-sm font-medium hover:underline"
                    >
                      Սկսիր նախագիծ վահանակից →
                    </Link>
                  }
                />
              ) : (
                <ul className="space-y-2">
                  {startedProjects.slice(0, 6).map((p) => (
                    <li key={p.id} className="text-sm">
                      <Link
                        to="/projects/$id"
                        params={{ id: p.id }}
                        className="font-medium hover:text-primary break-words block py-2.5 min-h-[44px]"
                      >
                        {p.title}
                      </Link>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-hero"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{p.progress}%</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Ձեռքբերումներ" icon={Trophy}>
              {achievements.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  text="Ստացիր նշաններ՝ միանալով հնարավորություններին և սկսելով նախագծեր։"
                />
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
            </Section>

            <Section
              id="xp-history"
              title="XP պատմություն"
              subtitle="Որտեղից է եկել և ուր է գնացել քո XP-ն"
              icon={Coins}
            >
              {xpHistory.length === 0 ? (
                <EmptyState
                  icon={Coins}
                  text="XP փոփոխություններ դեռ չկան։ Ավարտիր քվեսթ կամ սկսիր նախագիծ։"
                />
              ) : (
                <ul className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                  {xpHistory.map((e, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-secondary/50 min-w-0"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
                          e.amount >= 0
                            ? "bg-success/10 text-success"
                            : "bg-secondary text-muted-foreground"
                        }`}
                      >
                        <e.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{e.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(e.date).toLocaleDateString("hy-AM", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                      </div>
                      <div
                        className={`text-sm font-semibold shrink-0 tabular-nums ${e.amount >= 0 ? "text-success" : "text-muted-foreground"}`}
                      >
                        {e.amount >= 0 ? "+" : ""}
                        {e.amount} XP
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Իմ գրառումները" icon={MessageSquare}>
              <Link to="/feed/create" className="btn btn-primary w-full mb-3">
                <Plus className="w-4 h-4" /> Նոր գրառում
              </Link>
              {myPosts === null ? (
                <div className="h-16 rounded-xl bg-secondary animate-pulse" />
              ) : myPosts.length === 0 ? (
                <EmptyState icon={MessageSquare} text="Դեռ գրառումներ չկան։" />
              ) : (
                <ul className="space-y-3">
                  {myPosts.map((p) => (
                    <li
                      key={p.id}
                      className="bg-secondary/40 border border-border rounded-xl p-3 min-w-0"
                    >
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <div className="min-w-0 flex-1">
                          {p.title && (
                            <div className="font-medium text-sm break-words">{p.title}</div>
                          )}
                          <div className="text-xs text-muted-foreground break-words line-clamp-2 whitespace-pre-wrap">
                            {p.content}
                          </div>
                          <div className="mt-1.5">
                            <StatusBadge status={p.status} />
                          </div>
                          {p.status === "rejected" && p.rejection_reason && (
                            <div className="mt-2 text-[11px] text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2 break-words">
                              Պատճառ՝ {p.rejection_reason}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {(p.status === "rejected" || p.status === "pending") && (
                          <Link
                            to="/feed/create"
                            search={{ edit: p.id }}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-card border border-border hover:bg-secondary min-h-[44px]"
                          >
                            <Pencil className="w-3 h-3" /> Խմբագրել
                          </Link>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-card border border-border hover:bg-destructive/10 hover:text-destructive min-h-[44px]">
                              <Trash2 className="w-3 h-3" /> Ջնջել
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Ջնջե՞լ գրառումը</AlertDialogTitle>
                              <AlertDialogDescription>
                                Գրառումն ու դրա մեկնաբանությունները կջնջվեն ընդմիշտ։
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Չեղարկել</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={async () => {
                                  try {
                                    await deletePost(p.id);
                                    if (user) await loadMyPosts(user.id);
                                    toast.success("Գրառումը ջնջված է։");
                                  } catch (error: unknown) {
                                    toast.error(getErrorMessage(error, "Չհաջողվեց ջնջել գրառումը"));
                                  }
                                }}
                              >
                                Ջնջել ընդմիշտ
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                          {new Date(p.created_at).toLocaleDateString("hy-AM")}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Հաշիվ" icon={LogOut}>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  nav({ to: "/" });
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-secondary min-h-[44px]"
              >
                <LogOut className="w-4 h-4" /> Դուրս գալ
              </button>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full max-w-full px-3.5 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition min-h-[44px]";

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Section({
  id,
  title,
  subtitle,
  icon: Icon,
  children,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="card-base rounded-2xl p-4 sm:p-6 overflow-hidden min-w-0 scroll-mt-20"
    >
      <div className="flex items-start gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accent text-accent-foreground grid place-items-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h2 className="font-semibold text-[15px] sm:text-base leading-snug break-words">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground break-words">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyState({
  icon: Icon,
  text,
  cta,
}: {
  icon?: LucideIcon;
  text: string;
  cta?: ReactNode;
}) {
  return (
    <div className="text-center py-6 px-4 rounded-xl border border-dashed border-border">
      {Icon && (
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-secondary mb-2.5">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm text-muted-foreground break-words">{text}</p>
      {cta && <div className="mt-2">{cta}</div>}
    </div>
  );
}

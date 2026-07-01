import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
} from "lucide-react";

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

function ProfilePage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [participations, setParticipations] = useState<any[]>([]);
  const [startedProjects, setStartedProjects] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [myPosts, setMyPosts] = useState<Post[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [rank, setRank] = useState<any>(null);

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
      const [{ data: prof }, { data: parts }, { data: sp }, { data: ach }] = await Promise.all([
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
      ]);
      setProfile(prof || { id: user.id, email: user.email, interests: [], skills: [] });
      setParticipations(parts || []);
      setStartedProjects(sp || []);
      setAchievements(ach || []);
      void loadMyPosts(user.id);
      fetchUserRank(user.id)
        .then(setRank)
        .catch(() => {});
    })();
  }, [user, loading, nav]);

  function set<K extends string>(k: K, v: any) {
    setProfile((p: any) => ({ ...p, [k]: v }));
  }
  function toggle(field: "interests" | "skills", item: string) {
    setProfile((p: any) => {
      const cur: string[] = p[field] || [];
      return { ...p, [field]: cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item] };
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) setStatus({ kind: "err", msg: error.message });
    else setStatus({ kind: "ok", msg: "Տվյալները թարմացված են" });
    setTimeout(() => setStatus(null), 3500);
  }

  if (loading || !profile) {
    return (
      <div className="min-h-screen grid place-items-center">
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
    <div className="min-h-screen bg-gradient-soft overflow-x-hidden">
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
                  <Award className="w-3.5 h-3.5" /> {rank?.tier || "Unranked"} · {rank?.score ?? 0}{" "}
                  միավոր
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px] text-muted-foreground">
                  <span>✅ Հաստատված՝ {rank.completed}</span>
                  <span>🌟 Բացառիկ՝ {rank.exceptional}</span>
                  <span>⭐ Միջին գնահ.՝ {rank.avg_rating}</span>
                  <span>⚡ Ակտիվ.՝ {rank.activity}</span>
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
                      className={`${inputCls} pl-9`}
                    />
                  </div>
                </Field>
                <Field label="Կարճ ներկայացում" className="sm:col-span-2">
                  <textarea
                    rows={3}
                    value={profile.bio || ""}
                    onChange={(e) => set("bio", e.target.value)}
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
                    className={inputCls}
                    placeholder="Ի՞նչ ես ուզում ստեղծել կամ սովորել հաջորդիվ։"
                  />
                </Field>
                <Field label="Հասանելիություն">
                  <select
                    value={profile.availability || ""}
                    onChange={(e) => set("availability", e.target.value)}
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
              </div>
            </Section>

            <div className="sticky bottom-28 md:bottom-4 z-10 flex flex-col min-[420px]:flex-row items-stretch min-[420px]:items-center justify-between gap-3 card-base rounded-2xl p-3 sm:p-4 shadow-elegant overflow-hidden">
              <div className="text-xs sm:text-sm text-muted-foreground min-w-0 flex-1">
                {status ? (
                  <span
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
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 shadow-soft min-h-[44px]"
              >
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
                        {new Date(p.joined_at).toLocaleDateString()}
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
                        className="font-medium hover:text-primary break-words block"
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

            <Section title="Իմ գրառումները" icon={MessageSquare}>
              <Link
                to="/feed/create"
                className="mb-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 min-h-[44px]"
              >
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
                            search={{ edit: p.id } as any}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-card border border-border hover:bg-secondary min-h-[44px]"
                          >
                            <Pencil className="w-3 h-3" /> Խմբագրել
                          </Link>
                        )}
                        <button
                          onClick={async () => {
                            if (!confirm("Ջնջե՞լ այս գրառումը։")) return;
                            await deletePost(p.id);
                            if (user) void loadMyPosts(user.id);
                          }}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-card border border-border hover:bg-destructive/10 hover:text-destructive min-h-[44px]"
                        >
                          <Trash2 className="w-3 h-3" /> Ջնջել
                        </button>
                        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                          {new Date(p.created_at).toLocaleDateString()}
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

function Field({ label, hint, children, className = "" }: any) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function Section({ title, subtitle, icon: Icon, children }: any) {
  return (
    <section className="card-base rounded-2xl p-4 sm:p-6 overflow-hidden min-w-0">
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

function EmptyState({ icon: Icon, text, cta }: { icon?: any; text: string; cta?: any }) {
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

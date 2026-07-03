import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { callAI } from "@/lib/ai";
import { ProjectChat } from "@/components/ProjectChat";
import {
  startProjectRpc, submitProject, cancelProject, fetchParticipants,
  normalizeTier, TIER_COST, TIER_REWARD, TIER_LABEL, STATUS_LABEL,
  type DifficultyTier, type ProjectStatus,
} from "@/lib/projects";
import {
  Loader2, Rocket, Share2, Target, Users, Clock, Sparkles, CheckCircle2,
  ChevronLeft, Send, Ban, MessageSquare, AlertCircle, Award, Coins,
} from "lucide-react";

export const Route = createFileRoute("/projects/$id")({ component: ProjectDetail });

function ProjectDetail() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [idea, setIdea] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [started, setStarted] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [tab, setTab] = useState<"overview" | "chat">("overview");
  const [showSuccess, setShowSuccess] = useState(false);

  const tier: DifficultyTier = normalizeTier(started?.difficulty_tier || idea?.difficulty);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    (async () => {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(prof);

      if (id === "ai") {
        const stored = sessionStorage.getItem("ai-project");
        if (!stored) { nav({ to: "/dashboard" }); return; }
        const i = JSON.parse(stored);
        setIdea(i);
        await loadDetail(i, prof);
      } else {
        const { data: sp } = await supabase.from("started_projects").select("*").eq("id", id).single();
        if (!sp) { nav({ to: "/dashboard" }); return; }
        setStarted(sp);
        setIdea({
          title: sp.title, shortDescription: sp.short_description,
          matchingInterests: sp.matching_interests, difficulty: sp.difficulty,
          suggestedTeamSize: sp.team_size, firstSteps: sp.first_steps || [],
        });
        try { setParticipants(await fetchParticipants(sp.id)); } catch {}
      }
    })();
  }, [id, user, authLoading, nav]);

  async function loadDetail(i: any, prof: any) {
    setGenerating(true);
    try {
      const { result } = await callAI("project_detail", { idea: i, profile: prof });
      setDetail(result);
    } catch (e) { console.error(e); }
    finally { setGenerating(false); }
  }

  async function handleStart() {
    if (!user || !idea || starting) return;
    setStarting(true);
    try {
      const row = await startProjectRpc({
        title: idea.title,
        shortDescription: idea.shortDescription,
        fullDescription: detail?.fullDescription || idea.shortDescription,
        matchingInterests: idea.matchingInterests || [],
        teamSize: idea.suggestedTeamSize || "",
        firstSteps: idea.firstSteps || [],
        difficultyTier: tier,
      });
      // refresh profile xp
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      setProfile(prof);
      setStarted(row);
      setShowSuccess(true);
      setTimeout(() => nav({ to: "/projects/$id", params: { id: row.id } }), 1200);
    } catch (e: any) {
      const msg = (e?.message || "").toString();
      if (msg.includes("not enough XP")) alert(`Անբավարար XP։ Հարկավոր է ${TIER_COST[tier]} XP։`);
      else if (msg.includes("active project limit")) alert("Միաժամանակ կարող ես ունենալ առավելագույնը 2 ակտիվ նախագիծ։");
      else alert(msg || "Չհաջողվեց սկսել");
    } finally { setStarting(false); }
  }

  async function handleSubmit() {
    if (!started) return;
    if (!confirm("Ուղարկե՞լ նախագիծը ադմինի ստուգմանը։")) return;
    try {
      const row = await submitProject(started.id);
      setStarted(row);
    } catch (e: any) { alert(e.message || "Չհաջողվեց"); }
  }

  async function handleCancel() {
    if (!started) return;
    if (!confirm("Չեղարկե՞լ նախագիծը։ XP-ն չի վերադարձվում։")) return;
    try {
      const row = await cancelProject(started.id);
      setStarted(row);
    } catch (e: any) { alert(e.message || "Չհաջողվեց"); }
  }

  async function share() {
    try { await navigator.clipboard.writeText(window.location.href); alert("Հղումը պատճենված է։"); }
    catch { alert(window.location.href); }
  }

  if (authLoading || !idea) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const status: ProjectStatus | null = started?.status || null;
  const isMember = !!started && !!user && participants.some((p) => p.user_id === user.id);
  const canChat = !!started && (isMember || started.user_id === user?.id);
  const canSubmit = canChat && status === "active";
  const canCancel = canChat && (status === "active" || status === "submitted");
  const reward = TIER_REWARD[tier];

  return (
    <div className="min-h-screen bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-5xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-6 sm:py-8 pb-32 md:pb-8">
        <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 min-h-[44px]"><ChevronLeft className="w-4 h-4 shrink-0" /> Վերադառնալ վահանակ</Link>

        <div className="bg-gradient-card border border-border rounded-2xl p-4 sm:p-6 md:p-8 shadow-elegant overflow-hidden">
          <div className="flex flex-col gap-4 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground"><Sparkles className="w-3 h-3" /> AI նախագիծ</span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/30">{TIER_LABEL[tier]}</span>
              {status && <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-secondary border border-border">{STATUS_LABEL[status]}</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight break-words">{idea.title}</h1>
            <p className="text-muted-foreground break-words">{idea.shortDescription}</p>
          </div>

          {status === "rejected" && started?.rejection_reason && (
            <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 text-destructive shrink-0" />
              <div><div className="font-medium text-destructive">Մերժման պատճառ</div><div className="text-muted-foreground break-words">{started.rejection_reason}</div></div>
            </div>
          )}
          {status === "approved" && (
            <div className="mt-4 p-3 rounded-xl bg-success/10 border border-success/30 text-sm flex items-start gap-2">
              <Award className="w-4 h-4 mt-0.5 text-success shrink-0" />
              <div className="break-words"><div className="font-medium text-success">Հաստատված {started.quality === "exceptional" ? "(բացառիկ կատարում 🌟)" : ""}</div><div className="text-muted-foreground">Բոլոր մասնակիցները ստացել են XP։</div></div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <Stat icon={Target} label="Բարդություն" value={TIER_LABEL[tier]} />
            <Stat icon={Users} label="Թիմ" value={idea.suggestedTeamSize || "—"} />
            <Stat icon={Coins} label="Արժեք" value={`${TIER_COST[tier]} XP`} />
            <Stat icon={Award} label="Պարգև" value={`${reward.standard}–${reward.exceptional} XP`} />
          </div>

          <div className="flex flex-wrap gap-2 mt-6">
            {!started ? (
              <button onClick={handleStart} disabled={starting || (profile && profile.xp < TIER_COST[tier])} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-hero text-primary-foreground font-semibold shadow-elegant hover:shadow-glow disabled:opacity-50 min-h-[44px]">
                {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                Սկսել ({TIER_COST[tier]} XP)
              </button>
            ) : (
              <>
                {canSubmit && (
                  <button onClick={handleSubmit} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold min-h-[44px]"><Send className="w-4 h-4" /> Ուղարկել ստուգման</button>
                )}
                {canCancel && (
                  <button onClick={handleCancel} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border hover:bg-secondary font-medium min-h-[44px]"><Ban className="w-4 h-4" /> Չեղարկել</button>
                )}
              </>
            )}
            <button onClick={share} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border hover:bg-secondary font-medium min-h-[44px]"><Share2 className="w-4 h-4" /> Կիսվել</button>
            <Link
              to="/agent"
              search={{
                ask: started
                  ? `Օգնիր ինձ «${idea.title}» նախագծի հետ․ ի՞նչ պետք է անեմ հաջորդը։`
                  : `Պատմիր ինձ «${idea.title}» նախագծի մասին և արժե՞ սկսել այն։`,
              }}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border text-primary hover:bg-primary/5 hover:border-primary/40 font-medium min-h-[44px] transition-colors"
            >
              <Sparkles className="w-4 h-4" /> Հարցնել AI-ից
            </Link>
          </div>

          {profile && !started && profile.xp < TIER_COST[tier] && (
            <p className="text-xs text-destructive mt-2">Անբավարար XP — հարկավոր է {TIER_COST[tier]} XP, ունես {profile.xp || 0}։</p>
          )}
        </div>

        {started && (
          <div className="flex gap-2 mt-6 mb-4">
            <button onClick={() => setTab("overview")} className={`px-4 py-2 rounded-xl text-sm font-medium ${tab === "overview" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>Ընդհանուր</button>
            <button onClick={() => setTab("chat")} className={`px-4 py-2 rounded-xl text-sm font-medium inline-flex items-center gap-1.5 ${tab === "chat" ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}><MessageSquare className="w-4 h-4" /> Չատ / Ապացույց</button>
          </div>
        )}

        {started && tab === "chat" && user && (
          <ProjectChat projectId={started.id} userId={user.id} canPost={canChat && status !== "approved"} />
        )}

        {(!started || tab === "overview") && (
          <>
            {generating && !detail && <div className="mt-6 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> AI-ն կազմում է պլանը․․․</div>}

            {detail && (
              <div className="grid lg:grid-cols-3 gap-6 mt-6">
                <div className="lg:col-span-2 space-y-6">
                  <Section title="Նախագծի մասին">{detail.fullDescription}</Section>
                  <Section title="Նպատակներ"><ul className="list-disc pl-5 space-y-1">{(detail.goals || []).map((g: string, i: number) => <li key={i}>{g}</li>)}</ul></Section>
                  {detail.problem && <Section title="Լուծվող խնդիր">{detail.problem}</Section>}
                  {detail.targetAudience && <Section title="Թիրախային լսարան">{detail.targetAudience}</Section>}
                </div>
                <div className="space-y-6">
                  <Section title="Առաջին քայլեր">
                    <ul className="space-y-1.5 text-sm list-disc pl-5">
                      {(idea.firstSteps || []).map((s: any, i: number) => (
                        <li key={i} className="break-words">{typeof s === "string" ? s : s.text}</li>
                      ))}
                    </ul>
                    {!started && <p className="text-xs text-muted-foreground mt-2">XP-ն շնորհվում է միայն ադմինի հաստատումից հետո։</p>}
                  </Section>
                  {detail.teamRoles && (
                    <Section title="Թիմային դերեր">
                      <div className="flex flex-wrap gap-1.5">
                        {(detail.teamRoles || []).map((r: string) => <span key={r} className="text-xs px-2.5 py-1 rounded-full bg-accent text-accent-foreground break-words">{r}</span>)}
                      </div>
                    </Section>
                  )}
                  {participants.length > 0 && (
                    <Section title={`Մասնակիցներ (${participants.length})`}>
                      <ul className="space-y-1.5 text-sm">
                        {participants.map((p) => (
                          <li key={p.user_id} className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" /> <span className="break-words">{p.profile?.full_name || p.profile?.email || "Օգտատեր"}{p.role === "owner" ? " · հիմնադիր" : ""}</span></li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showSuccess && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm grid place-items-center z-50 px-4">
          <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 w-full max-w-sm text-center shadow-elegant">
            <div className="w-14 h-14 mx-auto rounded-full bg-success/10 grid place-items-center mb-3"><Rocket className="w-7 h-7 text-success" /></div>
            <h3 className="text-xl font-bold">Նախագիծը մեկնարկեց</h3>
            <p className="text-sm text-muted-foreground mt-2">XP-ն կշնորհվի ադմինի հաստատումից հետո։</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 min-w-0">
      <div className="flex items-start gap-1.5 text-xs text-muted-foreground"><Icon className="w-3.5 h-3.5 shrink-0 mt-0.5" /> <span className="break-words">{label}</span></div>
      <div className="font-semibold text-sm mt-0.5 break-words">{value}</div>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <section className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft overflow-hidden min-w-0">
      <h3 className="font-semibold mb-2 leading-snug break-words">{title}</h3>
      <div className="text-sm text-muted-foreground leading-relaxed break-words">{children}</div>
    </section>
  );
}

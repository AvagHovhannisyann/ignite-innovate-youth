import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ALL_INTERESTS } from "@/lib/constants";
import { Navbar } from "@/components/Navbar";
import { ArrowRight, Loader2 } from "lucide-react";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

const SKILLS = ["գրել","ծրագրավորում","նկարչություն","հռետորություն","խմբագրում","պլանավորում","հետազոտություն","դիզայն","առաջնորդություն","լուսանկարչություն"];
const PROJECT_TYPES = [
  { value: "Lessons", label: "Դասեր" },
  { value: "Events", label: "Միջոցառումներ" },
  { value: "Workshops", label: "Աշխատանոցներ" },
  { value: "Projects", label: "Նախագծեր" },
];

function Onboarding() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [age, setAge] = useState<number | "">("");
  const [school, setSchool] = useState("");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [learning, setLearning] = useState("");
  const [projectType, setProjectType] = useState("Projects");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && !user) nav({ to: "/auth" }); }, [user, loading, nav]);

  function toggle(arr: string[], setArr: (v: string[]) => void, item: string) {
    setArr(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      const { error: pErr } = await supabase.from("profiles").upsert({
        id: user.id,
        age: age === "" ? null : Number(age),
        school, bio, interests, skills,
        learning_areas: learning ? [learning] : [],
        goal,
        preferred_project_type: projectType,
        onboarded: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (pErr) {
        console.error("Profile save failed:", pErr);
        alert("Չհաջողվեց պահպանել տվյալները՝ " + pErr.message);
        setSaving(false);
        return;
      }
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: "Բարի գալուստ Էջմիածնի Երիտասարդական Տուն 🎉",
        body: "Մուտքն ավարտված է։ Քո անհատականացված առաջարկները պատրաստվում են։",
        kind: "info",
      });
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Սեսիան ավարտվել է։ Խնդրում ենք նորից մուտք գործել։");
        nav({ to: "/auth" });
        return;
      }
      nav({ to: "/dashboard", replace: true });
    } catch (e: any) {
      console.error(e);
      alert("Ինչ-որ բան սխալ գնաց՝ " + (e?.message ?? "անհայտ սխալ"));
      setSaving(false);
    }
  }

  const steps = [
    {
      title: "Պատմիր քո մասին",
      content: (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Տարիք</label>
            <input type="number" value={age} onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))} className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Դպրոց / Համալսարան</label>
            <input value={school} onChange={(e) => setSchool(e.target.value)} className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Կարճ ներկայացում</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background" />
          </div>
        </div>
      ),
      canNext: true,
    },
    {
      title: "Ի՞նչն է քեզ հետաքրքրում",
      sub: "Ընտրիր առնվազն 3-ը",
      content: (
        <div className="flex flex-wrap gap-2">
          {ALL_INTERESTS.map((i) => (
            <button key={i} type="button" onClick={() => toggle(interests, setInterests, i)} className={`min-h-[44px] px-3.5 py-2 rounded-full text-sm border transition-all break-words ${interests.includes(i) ? "bg-gradient-hero text-primary-foreground border-transparent shadow-soft" : "bg-card border-border hover:border-primary/30"}`}>{i}</button>
          ))}
        </div>
      ),
      canNext: interests.length >= 3,
    },
    {
      title: "Ի՞նչ հմտություններ ունես արդեն",
      content: (
        <div className="flex flex-wrap gap-2">
          {SKILLS.map((s) => (
            <button key={s} type="button" onClick={() => toggle(skills, setSkills, s)} className={`min-h-[44px] px-3.5 py-2 rounded-full text-sm border transition-all break-words ${skills.includes(s) ? "bg-gradient-hero text-primary-foreground border-transparent" : "bg-card border-border hover:border-primary/30"}`}>{s}</button>
          ))}
        </div>
      ),
      canNext: true,
    },
    {
      title: "Ի՞նչ կուզենայիր սովորել",
      content: (
        <textarea value={learning} onChange={(e) => setLearning(e.target.value)} rows={4} placeholder="օր.՝ վիդեո մոնտաժ, բիզնեսի հիմունքներ, AI գործիքներ․․․" className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background" />
      ),
      canNext: true,
    },
    {
      title: "Ի՞նչ ես նախընտրում",
      content: (
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
          {PROJECT_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => setProjectType(t.value)} className={`p-3 min-[380px]:p-4 rounded-xl border text-left transition-all min-w-0 overflow-hidden ${projectType === t.value ? "bg-gradient-hero text-primary-foreground border-transparent shadow-soft" : "bg-card border-border hover:border-primary/30"}`}>
              <div className="font-semibold break-words">{t.label}</div>
            </button>
          ))}
        </div>
      ),
      canNext: true,
    },
    {
      title: "Քո անձնական նպատակը այս տարվա համար",
      content: <textarea value={goal} onChange={(e) => setGoal(e.target.value)} rows={4} placeholder="Ի՞նչ ես ուզում նվաճել։" className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background" />,
      canNext: goal.trim().length > 5,
    },
  ];

  if (loading || !user) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const cur = steps[step];

  return (
    <div className="min-h-screen bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-2xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-6 sm:py-12 pb-8">
        <div className="flex items-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-gradient-hero" : "bg-border"}`} />
          ))}
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 md:p-8 shadow-elegant overflow-hidden">
          <div className="text-xs text-muted-foreground mb-2">Քայլ {step + 1} / {steps.length}</div>
          <h2 className="text-2xl font-bold mb-1 leading-tight break-words">{cur.title}</h2>
          {cur.sub && <p className="text-sm text-muted-foreground mb-4 break-words">{cur.sub}</p>}
          <div className="mt-6">{cur.content}</div>
          <div className="flex flex-col-reverse min-[380px]:flex-row justify-between gap-3 mt-8">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="px-4 py-2.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 min-h-[44px]">Հետ</button>
            {step < steps.length - 1 ? (
              <button onClick={() => setStep(step + 1)} disabled={!cur.canNext} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-hero text-primary-foreground font-semibold disabled:opacity-50 shadow-soft min-h-[44px] break-words">
                Շարունակել <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={finish} disabled={!cur.canNext || saving} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-hero text-primary-foreground font-semibold disabled:opacity-50 shadow-soft min-h-[44px] break-words">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ավարտել"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ALL_INTERESTS } from "@/lib/constants";
import { Navbar } from "@/components/Navbar";
import { ArrowRight, Loader2, Plus, X, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

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
  const [showCustomSkill, setShowCustomSkill] = useState(false);
  const [customSkill, setCustomSkill] = useState("");
  const [learning, setLearning] = useState("");
  const [projectType, setProjectType] = useState("Projects");
  const [goal, setGoal] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [user, loading, nav]);

  function toggle(arr: string[], setArr: (v: string[]) => void, item: string) {
    setArr(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
  }

  function addCustomSkill() {
    const v = customSkill.trim();
    if (!v) return;
    if (!skills.some((s) => s.toLowerCase() === v.toLowerCase())) {
      setSkills((prev) => [...prev, v]);
    }
    setCustomSkill("");
  }

  async function finish() {
    if (!user) return;
    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          age: age === "" ? null : Number(age),
          school,
          bio,
          interests,
          skills,
          learning_areas: learning ? [learning] : [],
          goal,
          preferred_project_type: projectType,
          onboarded: true,
        })
        .eq("id", user.id);
      if (pErr) {
        console.error("Profile save failed:", pErr);
        toast.error("Չհաջողվեց պահպանել տվյալները", { description: pErr.message });
        setSaving(false);
        return;
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Սեսիան ավարտվել է։ Խնդրում ենք նորից մուտք գործել։");
        nav({ to: "/auth" });
        return;
      }
      nav({ to: "/dashboard", replace: true });
    } catch (error: unknown) {
      console.error(error);
      toast.error(getErrorMessage(error, "Ինչ-որ բան սխալ գնաց"));
      setSaving(false);
    }
  }

  const steps = [
    {
      title: "Պատմիր քո մասին",
      content: (
        <div className="space-y-4">
          <div>
            <label htmlFor="onboarding-age" className="block text-sm font-medium mb-1.5">
              Տարիք
            </label>
            <input
              id="onboarding-age"
              type="number"
              min={10}
              max={100}
              value={age}
              onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-input bg-background"
            />
          </div>
          <div>
            <label htmlFor="onboarding-school" className="block text-sm font-medium mb-1.5">
              Դպրոց / Համալսարան
            </label>
            <input
              id="onboarding-school"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              maxLength={200}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-input bg-background"
            />
          </div>
          <div>
            <label htmlFor="onboarding-bio" className="block text-sm font-medium mb-1.5">
              Կարճ ներկայացում
            </label>
            <textarea
              id="onboarding-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={2000}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-input bg-background"
            />
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
            <button
              key={i}
              type="button"
              onClick={() => toggle(interests, setInterests, i)}
              className={`min-h-[44px] px-3.5 py-2 rounded-full text-sm border transition-all break-words ${interests.includes(i) ? "bg-gradient-hero text-primary-foreground border-transparent shadow-soft" : "bg-card border-border hover:border-primary/30"}`}
            >
              {i}
            </button>
          ))}
        </div>
      ),
      canNext: interests.length >= 3,
    },
    {
      title: "Ի՞նչ հմտություններ ունես արդեն",
      content: (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SKILLS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggle(skills, setSkills, s)}
                className={`min-h-[44px] px-3.5 py-2 rounded-full text-sm border transition-all break-words ${skills.includes(s) ? "bg-gradient-hero text-primary-foreground border-transparent" : "bg-card border-border hover:border-primary/30"}`}
              >
                {s}
              </button>
            ))}
            {/* Custom skills the student typed in manually. */}
            {skills
              .filter((s) => !SKILLS.includes(s))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggle(skills, setSkills, s)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm border border-transparent bg-gradient-hero text-primary-foreground break-words"
                >
                  {s} <X className="w-3.5 h-3.5" />
                </button>
              ))}
            <button
              type="button"
              onClick={() => setShowCustomSkill((v) => !v)}
              className={`min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm border transition-all ${showCustomSkill ? "border-primary text-primary bg-primary/5" : "bg-card border-border border-dashed hover:border-primary/30"}`}
            >
              <Plus className="w-3.5 h-3.5" /> Այլ
            </button>
          </div>
          {showCustomSkill && (
            <div className="flex items-center gap-2 animate-rise">
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
                className="input-base flex-1 min-w-0"
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
        </div>
      ),
      canNext: true,
    },
    {
      title: "Ի՞նչ կուզենայիր սովորել",
      content: (
        <textarea
          value={learning}
          onChange={(e) => setLearning(e.target.value)}
          rows={4}
          maxLength={100}
          aria-label="Սովորելու ցանկալի ուղղություն"
          placeholder="օր.՝ վիդեո մոնտաժ, բիզնեսի հիմունքներ, AI գործիքներ․․․"
          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-input bg-background"
        />
      ),
      canNext: true,
    },
    {
      title: "Ի՞նչ ես նախընտրում",
      content: (
        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
          {PROJECT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setProjectType(t.value)}
              className={`p-3 min-[380px]:p-4 rounded-xl border text-left transition-all min-w-0 overflow-hidden ${projectType === t.value ? "bg-gradient-hero text-primary-foreground border-transparent shadow-soft" : "bg-card border-border hover:border-primary/30"}`}
            >
              <div className="font-semibold break-words">{t.label}</div>
            </button>
          ))}
        </div>
      ),
      canNext: true,
    },
    {
      title: "Քո անձնական նպատակը այս տարվա համար",
      content: (
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={4}
          maxLength={1000}
          aria-label="Անձնական նպատակ"
          placeholder="Ի՞նչ ես ուզում նվաճել։"
          className="w-full min-h-[44px] px-3.5 py-2.5 rounded-lg border border-input bg-background"
        />
      ),
      canNext: goal.trim().length > 5,
    },
  ];

  if (loading || !user)
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );

  const cur = steps[step];

  return (
    <div className="min-h-dvh bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-2xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-6 sm:py-12 pb-8">
        <div className="flex items-center gap-2 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-gradient-hero" : "bg-border"}`}
            />
          ))}
        </div>
        {step === 0 && (
          <div className="flex items-center gap-2.5 mb-4 px-3.5 py-2.5 rounded-xl bg-primary/5 border border-primary/15 text-xs text-muted-foreground animate-rise">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            Այս պատասխանները քո անձնական AI մենթորը կօգտագործի՝ քեզ հարմար նախագծեր, դասընթացներ և
            հնարավորություններ առաջարկելու համար։
          </div>
        )}
        <div className="card-base rounded-2xl p-4 sm:p-6 md:p-8 shadow-elegant overflow-hidden animate-rise">
          <div className="text-xs text-muted-foreground mb-2">
            Քայլ {step + 1} / {steps.length}
          </div>
          <h2 className="font-display text-2xl font-bold mb-1 leading-tight break-words">
            {cur.title}
          </h2>
          {cur.sub && <p className="text-sm text-muted-foreground mb-4 break-words">{cur.sub}</p>}
          <div className="mt-6">{cur.content}</div>
          <div className="flex flex-col-reverse min-[380px]:flex-row justify-between gap-3 mt-8">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              disabled={step === 0}
              className="px-4 py-2.5 rounded-lg text-muted-foreground hover:bg-secondary disabled:opacity-50 min-h-[44px]"
            >
              Հետ
            </button>
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!cur.canNext}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-hero text-primary-foreground font-semibold disabled:opacity-50 shadow-soft min-h-[44px] break-words"
              >
                Շարունակել <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={finish}
                disabled={!cur.canNext || saving}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-hero text-primary-foreground font-semibold disabled:opacity-50 shadow-soft min-h-[44px] break-words"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ավարտել"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

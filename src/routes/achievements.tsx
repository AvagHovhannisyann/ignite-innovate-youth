import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { ALL_BADGES, levelFromXP } from "@/lib/constants";
import { Trophy, Lock, Sparkles } from "lucide-react";
import { PageLoader } from "@/components/PageLoader";

export const Route = createFileRoute("/achievements")({ component: Achievements });

function Achievements() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [earned, setEarned] = useState<string[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    (async () => {
      const [{ data: p }, { data: a }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("achievements").select("badge,earned_at").eq("user_id", user.id),
      ]);
      setProfile(p);
      setEarned((a || []).map((x: any) => x.badge));
    })();
  }, [user, loading, nav]);

  if (!profile || !earned) return <div className="min-h-screen bg-gradient-soft"><Navbar /><PageLoader /></div>;

  const lvl = levelFromXP(profile.xp || 0);

  return (
    <div className="min-h-screen bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-5xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-6 sm:py-8 pb-32 md:pb-8">
        <header className="mb-8 animate-rise min-w-0">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold mb-2 max-w-full"><Trophy className="w-3.5 h-3.5 shrink-0" /> <span className="break-words">Ձեռքբերումներ</span></div>
          <h1 className="font-display text-2xl min-[380px]:text-3xl md:text-4xl font-bold leading-tight break-words">Նշաններ, մակարդակներ և քայլեր</h1>
          <p className="text-muted-foreground mt-2 max-w-xl break-words">Ստացիր նշաններ՝ մասնակցելով, սկսելով նախագծեր և հասնելով նոր մակարդակների։ Յուրաքանչյուր նշան իրական աճ է քո ճանապարհի վրա։</p>
        </header>

        <section className="card-base p-4 sm:p-6 mb-8 animate-rise overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end sm:justify-between gap-4 mb-3 min-w-0">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Ընթացիկ մակարդակ</p>
              <h2 className="font-display text-xl min-[380px]:text-2xl font-bold mt-1 break-words">{lvl.name}</h2>
              <p className="text-sm text-muted-foreground break-words">Մակարդակ {lvl.level} · {profile.xp || 0} XP</p>
            </div>
            {lvl.next && (
              <p className="text-sm text-muted-foreground break-words">{lvl.next.min - (profile.xp || 0)} XP մինչև <span className="text-foreground font-medium">{lvl.next.name}</span></p>
            )}
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-gradient-hero transition-all duration-700" style={{ width: `${lvl.progressPct}%` }} />
          </div>
        </section>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {ALL_BADGES.map((b) => {
            const has = earned.includes(b);
            return (
              <div key={b} className={`card-interactive p-4 min-[380px]:p-5 overflow-hidden min-w-0 ${has ? "" : "opacity-75"}`}>
                <div className={`w-12 h-12 rounded-xl grid place-items-center mb-3 ${has ? "bg-gradient-hero shadow-glow" : "bg-secondary"}`}>
                  {has ? <Sparkles className="w-6 h-6 text-primary-foreground" /> : <Lock className="w-5 h-5 text-muted-foreground" />}
                </div>
                <h3 className="font-semibold break-words">{b}</h3>
                <p className="text-xs text-muted-foreground mt-1 break-words">{has ? "Ստացված է" : "Փակ է․ շարունակիր մասնակցել՝ բացելու համար"}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

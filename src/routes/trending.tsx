import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { EmptyState } from "@/components/PageLoader";
import { Flame, Rocket, TrendingUp, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/trending")({ component: Trending });

function Trending() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [recent, setRecent] = useState<any[] | null>(null);
  const [projects, setProjects] = useState<any[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    (async () => {
      const [{ data: ops }, { data: sp }] = await Promise.all([
        supabase.from("opportunities").select("*").order("created_at", { ascending: false }).limit(8),
        supabase.from("started_projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6),
      ]);
      setRecent(ops || []);
      setProjects(sp || []);
    })();
  }, [user, loading, nav]);

  return (
    <div className="min-h-screen bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-6xl mx-auto px-3 min-[380px]:px-4 py-6 sm:py-8 pb-32 md:pb-8">
        <header className="mb-8 animate-rise min-w-0">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold mb-2 max-w-full"><Flame className="w-3.5 h-3.5 shrink-0" /> <span className="break-words">Թրենդային</span></div>
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight break-words">Ինչն է շարժվում տանը</h1>
          <p className="text-muted-foreground mt-2 max-w-xl break-words">Թարմ ավելացված հնարավորությունները և քո առավել ակտիվ նախագծերը։ Թրենդային ցուցանիշները կհարստանան ավելի շատ մասնակցության հետ։</p>
        </header>

        <section className="mb-10">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-4">
            <h2 className="font-display text-xl font-semibold flex items-center gap-2 min-w-0 leading-tight"><TrendingUp className="w-4 h-4 text-primary shrink-0" /> <span className="break-words">Վերջին հնարավորությունները</span></h2>
            <Link to="/opportunities" className="text-sm text-primary hover:underline inline-flex items-center gap-1 shrink-0 min-w-0">Բոլորը <ArrowRight className="w-3.5 h-3.5 shrink-0" /></Link>
          </div>
          {!recent ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-32" />)}</div>
          ) : recent.length === 0 ? (
            <EmptyState icon={TrendingUp} title="Հնարավորություններ դեռ չկան" description="Նոր ծրագրերը կհայտնվեն այստեղ՝ հենց որ թիմը հրապարակի դրանք։" />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recent.map((o) => (
                <Link key={o.id} to="/opportunities" className="card-interactive p-4 sm:p-5 block min-w-0 overflow-hidden">
                  <div className="text-[11px] uppercase tracking-widest text-primary font-semibold mb-1 break-words">{o.category}</div>
                  <h3 className="font-semibold leading-snug break-words">{o.title}</h3>
                  {o.description && <p className="text-sm text-muted-foreground mt-2 break-words">{o.description}</p>}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold mb-4 flex items-center gap-2 leading-tight"><Rocket className="w-4 h-4 text-primary shrink-0" /> <span className="break-words">Քո ակտիվ նախագծերը</span></h2>
          {!projects ? (
            <div className="grid sm:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="skeleton h-28" />)}</div>
          ) : projects.length === 0 ? (
            <EmptyState icon={Rocket} title="Նախագծեր դեռ չեն սկսվել" description="Ընտրիր առաջարկ քո վահանակից և մեկ հպումով սկսիր նախագիծ։" />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {projects.map((p) => (
                <Link key={p.id} to="/projects/$id" params={{ id: p.id }} className="card-interactive p-4 sm:p-5 block min-w-0 overflow-hidden">
                  <div className="flex items-start justify-between gap-3 mb-2 min-w-0">
                    <h3 className="font-semibold break-words min-w-0">{p.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground shrink-0 break-words">{p.progress}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground break-words">{p.short_description}</p>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden mt-3">
                    <div className="h-full bg-gradient-hero transition-all duration-500" style={{ width: `${p.progress}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

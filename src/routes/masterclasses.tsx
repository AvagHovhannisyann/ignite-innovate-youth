import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { EmptyState } from "@/components/PageLoader";
import { GraduationCap, Calendar, Clock } from "lucide-react";

export const Route = createFileRoute("/masterclasses")({ component: Masterclasses });

const MASTERCLASS_HINTS = ["masterclass", "workshop", "course", "training", "lecture", "seminar"];

function isMasterclass(o: any) {
  const hay = `${o.category || ""} ${(o.tags || []).join(" ")}`.toLowerCase();
  return MASTERCLASS_HINTS.some((k) => hay.includes(k));
}

function Masterclasses() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<any[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    supabase.from("opportunities").select("*").order("date", { ascending: true, nullsFirst: false }).then(({ data }) => {
      setItems((data || []).filter(isMasterclass));
    });
  }, [user, loading, nav]);

  return (
    <div className="min-h-dvh bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-5xl mx-auto px-3 min-[380px]:px-4 py-6 sm:py-8 pb-32 md:pb-8">
        <header className="mb-8 animate-rise min-w-0">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold mb-2 max-w-full"><GraduationCap className="w-3.5 h-3.5 shrink-0" /> <span className="break-words">Մաստեր-դասեր</span></div>
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight break-words">Սովորիր մասնագետներից</h1>
          <p className="text-muted-foreground mt-2 max-w-xl break-words">Գործնական դասեր՝ մենթորների և հրավիրյալ մասնագետների կողմից։ Գրանցվիր՝ տեղ ապահովելու համար։ Բոլոր դասերը անդամների համար անվճար են։</p>
        </header>

        {!items ? (
          <div className="grid sm:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-36" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="Մաստեր-դասեր դեռ նախատեսված չեն"
            description="Թիմը պատրաստում է հաջորդ սեզոնը։ Նոր դասերը կհայտնվեն այստեղ․ միացրու ծանուցումները, որ առաջինը տեղեկանաս։"
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {items.map((o) => (
              <article key={o.id} className="card-interactive p-4 sm:p-5 min-w-0 overflow-hidden">
                <div className="flex items-start justify-between gap-3 mb-2 min-w-0">
                  <h3 className="font-semibold leading-snug break-words min-w-0">{o.title}</h3>
                  {o.difficulty && <span className="max-w-[38%] text-[11px] uppercase tracking-normal px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground shrink-0 break-words text-center">{o.difficulty}</span>}
                </div>
                {o.description && <p className="text-sm text-muted-foreground break-words">{o.description}</p>}
                <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
                  {o.date && <span className="inline-flex items-center gap-1 break-words"><Calendar className="w-3.5 h-3.5 shrink-0" /> {new Date(o.date).toLocaleDateString()}</span>}
                  {o.duration && <span className="inline-flex items-center gap-1 break-words"><Clock className="w-3.5 h-3.5 shrink-0" /> {o.duration}</span>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

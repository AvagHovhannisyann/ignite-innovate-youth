import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { EmptyState } from "@/components/PageLoader";
import { Calendar, Loader2, CheckCircle2, Plus, Compass, Sparkles } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

export const Route = createFileRoute("/opportunities")({ component: Opportunities });

function Opportunities() {
  const { user } = useAuth();
  const [items, setItems] = useState<Tables<"opportunities">[]>([]);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const opportunityGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: ops } = await supabase.from("opportunities").select("*").order("created_at");
      setItems(ops || []);
      if (user) {
        const { data: parts } = await supabase
          .from("participations")
          .select("opportunity_id")
          .eq("user_id", user.id);
        setJoinedIds(new Set((parts || []).map((p) => p.opportunity_id)));
      }
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    const grid = opportunityGridRef.current;
    if (!user || !grid || !items.length || typeof IntersectionObserver === "undefined") return;

    const recorded = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
          const element = entry.target as HTMLElement;
          const opportunityId = element.dataset.opportunityId;
          if (!opportunityId || recorded.has(opportunityId)) continue;
          recorded.add(opportunityId);
          observer.unobserve(element);
          void supabase.rpc("record_opportunity_view", { _opportunity_id: opportunityId });
        }
      },
      { threshold: 0.5 },
    );

    const cards = grid.querySelectorAll<HTMLElement>("[data-opportunity-id]");
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [items, user]);

  async function join(id: string) {
    if (!user) {
      window.location.href = "/auth";
      return;
    }
    if (joiningId) return;
    setJoiningId(id);
    try {
      const { error } = await supabase.rpc("join_opportunity", {
        _opportunity_id: id,
      });
      if (error) throw error;
      setJoinedIds((current) => new Set([...current, id]));
      toast.success("Միացար հնարավորությանը։ Այն ավելացվել է քո օրակարգում։");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց միանալ հնարավորությանը։"));
    } finally {
      setJoiningId(null);
    }
  }

  const cats = ["all", ...Array.from(new Set(items.map((i) => i.category)))];
  const filtered = filter === "all" ? items : items.filter((i) => i.category === filter);

  return (
    <div className="min-h-dvh bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-7xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-7 sm:py-10 pb-40 md:pb-10 overflow-hidden">
        <div className="mb-6 sm:mb-8">
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold leading-tight break-words">
            Հնարավորություններ
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1.5 sm:mt-2 break-words">
            Աշխատանոցներ, դասեր և միջոցառումներ՝ ընտրված երիտասարդների համար։
          </p>
        </div>

        <div className="mb-5 sm:mb-6 -mx-3 min-[380px]:-mx-4 sm:mx-0 overflow-hidden">
          <div className="flex gap-2 px-3 min-[380px]:px-4 sm:px-0 pb-2 min-w-0 overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                className={`chip min-h-11 px-3.5 py-2 rounded-full text-sm border transition-all capitalize ${filter === c ? "bg-gradient-hero text-primary-foreground border-transparent shadow-soft" : "bg-card border-border hover:border-primary/30"}`}
              >
                {c === "all" ? "Բոլորը" : c}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid place-items-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-base rounded-2xl">
            <EmptyState
              icon={Compass}
              title="Այս բաժնում դեռ հնարավորություններ չկան։"
              description="Ընտրիր այլ բաժին կամ վերադարձիր ավելի ուշ՝ նոր ծրագրերը կհայտնվեն այստեղ։"
            />
          </div>
        ) : (
          <div
            ref={opportunityGridRef}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 min-w-0 max-w-full overflow-hidden"
          >
            {filtered.map((op) => {
              const joined = joinedIds.has(op.id);
              return (
                <div
                  key={op.id}
                  data-opportunity-id={op.id}
                  className="bg-gradient-card border border-border rounded-2xl p-4 sm:p-5 shadow-soft hover:shadow-elegant transition-shadow flex flex-col min-w-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2 min-w-0">
                    <span className="max-w-full text-[11px] px-2.5 py-1 rounded-full bg-accent text-accent-foreground capitalize break-words">
                      {op.category}
                    </span>
                    {op.difficulty && (
                      <span className="max-w-full text-[11px] text-muted-foreground break-words text-left sm:text-right">
                        {op.difficulty}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-base sm:text-lg mt-2 leading-snug break-words">
                    {op.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 mb-4 flex-1 line-clamp-3">
                    {op.description}
                  </p>
                  <div className="flex flex-wrap items-center text-xs text-muted-foreground gap-3 mb-3">
                    {op.duration && (
                      <span className="inline-flex items-center gap-1 break-words">
                        <Calendar className="w-3 h-3 shrink-0" /> {op.duration}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => join(op.id)}
                      disabled={joined || joiningId !== null}
                      className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all min-h-[44px] ${joined ? "bg-success/10 text-success cursor-default" : "bg-gradient-hero text-primary-foreground hover:shadow-glow active:scale-[0.98]"}`}
                    >
                      {joiningId === op.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Միանում է…
                        </>
                      ) : joined ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Միացած ես
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" /> Միանալ
                        </>
                      )}
                    </button>
                    <Link
                      to="/agent"
                      search={{
                        ask: `Պատմիր ինձ «${op.title}» հնարավորության մասին և արժե՞ միանալ ինձ համար։`,
                      }}
                      aria-label="Հարցնել AI-ից այս հնարավորության մասին"
                      title="Հարցնել AI-ից"
                      className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg border border-border text-primary hover:bg-primary/5 hover:border-primary/40 transition-colors"
                    >
                      <Sparkles className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

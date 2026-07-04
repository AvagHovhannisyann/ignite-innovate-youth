import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { EmptyState } from "@/components/PageLoader";
import { Trophy, Rocket, Calendar, Users, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/community")({ component: Community });

type Item = { id: string; type: "achievement" | "project" | "participation"; title: string; sub?: string; at: string; icon: any };

function Community() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    (async () => {
      const [{ data: ach }, { data: sp }, { data: parts }] = await Promise.all([
        supabase.from("achievements").select("*").eq("user_id", user.id).order("earned_at", { ascending: false }),
        supabase.from("started_projects").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("participations").select("*, opportunities(title,category)").eq("user_id", user.id).order("joined_at", { ascending: false }),
      ]);
      const feed: Item[] = [
        ...(ach || []).map((a: any) => ({ id: `a-${a.id}`, type: "achievement" as const, title: `Ստացար «${a.badge}» նշանը`, at: a.earned_at, icon: Trophy })),
        ...(sp || []).map((p: any) => ({ id: `p-${p.id}`, type: "project" as const, title: `Մեկնարկեցիր նախագիծ՝ ${p.title}`, sub: `${p.progress}% առաջընթաց`, at: p.created_at, icon: Rocket })),
        ...(parts || []).map((p: any) => ({ id: `j-${p.id}`, type: "participation" as const, title: `Միացար՝ ${p.opportunities?.title || "հնարավորությանը"}`, sub: p.opportunities?.category, at: p.joined_at, icon: Calendar })),
      ].sort((a, b) => +new Date(b.at) - +new Date(a.at));
      setItems(feed);
    })();
  }, [user, loading, nav]);

  return (
    <div className="min-h-dvh bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-4xl mx-auto px-3 min-[380px]:px-4 py-6 sm:py-8 pb-32 md:pb-8">
        <header className="mb-8 animate-rise min-w-0">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold mb-2 max-w-full"><Users className="w-3.5 h-3.5 shrink-0" /> <span className="break-words">Համայնք</span></div>
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight break-words">Քո ակտիվությունը երիտասարդական տանը</h1>
          <p className="text-muted-foreground mt-2 max-w-xl break-words">Քրոնոլոգիական հոսք այն ամենի, ինչ արել ես մինչ այժմ՝ ձեռքբերումներ, նշաններ և միացած ծրագրեր։ Համընդհանուր սոցիալական հոսքը կբացվի մոդերացիայի ներդրումից հետո։</p>
        </header>

        {!items ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-20" />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Դեռ ոչինչ չկա այստեղ"
            description="Միացիր քո առաջին հնարավորությանը կամ սկսիր նախագիծ․ ակտիվությունդ կհայտնվի այստեղ՝ իրական ժամանակում։"
            action={<Link to="/opportunities" className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover-lift min-h-[44px]">Տեսնել հնարավորությունները</Link>}
          />
        ) : (
          <ol className="relative border-l border-border ml-2 min-[380px]:ml-3 space-y-4 min-w-0">
            {items.map((it) => (
              <li key={it.id} className="ml-4 min-[380px]:ml-6 animate-rise min-w-0">
                <span className="absolute -left-[11px] mt-2 w-5 h-5 rounded-full bg-gradient-hero grid place-items-center shadow-soft">
                  <it.icon className="w-2.5 h-2.5 text-primary-foreground" />
                </span>
                <div className="card-interactive p-3 min-[380px]:p-4 min-w-0 overflow-hidden">
                  <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-start justify-between gap-2 min-w-0">
                    <div className="min-w-0">
                      <p className="font-medium text-sm sm:text-base break-words">{it.title}</p>
                      {it.sub && <p className="text-xs text-muted-foreground mt-0.5 capitalize break-words">{it.sub}</p>}
                    </div>
                    <time className="text-[11px] text-muted-foreground shrink-0 break-words">{formatDistanceToNow(new Date(it.at), { addSuffix: true })}</time>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { CheckCircle2, XCircle, Loader2, ExternalLink, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/admin/quest-reviews")({ component: QuestReviews });

function QuestReviews() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");

  useEffect(() => {
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    (async () => {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      if (!roles?.some((r) => r.role === "admin")) { nav({ to: "/dashboard" }); return; }
      load();
    })();
  }, [user, loading, nav, filter]);

  async function load() {
    setBusy(true);
    const { data } = await supabase
      .from("quest_submissions")
      .select("*, quest_templates(title,xp,description), profiles(full_name,email)")
      .eq("status", filter).order("created_at", { ascending: false });
    setRows(data || []);
    setBusy(false);
  }

  async function review(id: string, approve: boolean) {
    const note = approve ? "" : (prompt("Մերժման պատճառ (ոչ պարտադիր)") || "");
    const { error } = await supabase.rpc("review_quest_submission", { _id: id, _approve: approve, _note: note });
    if (error) alert(error.message);
    else load();
  }

  async function signedUrl(path: string) {
    const { data } = await supabase.storage.from("quest-evidence").createSignedUrl(path, 3600);
    return data?.signedUrl || "";
  }

  return (
    <>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 pb-24 md:pb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4" /> Ադմին</Link>
        </div>
        <h1 className="font-display text-2xl font-bold mb-1">Քվեստների ստուգում</h1>
        <p className="text-sm text-muted-foreground mb-4">Ստուգիր ուսանողների ուղարկած ապացույցները։</p>

        <div className="flex gap-2 mb-4">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm ${filter === s ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"}`}>
              {s === "pending" ? "Սպասում է" : s === "approved" ? "Հաստատված" : "Մերժված"}
            </button>
          ))}
        </div>

        {busy ? <div className="flex items-center text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Բեռնվում է…</div> : rows.length === 0 ? (
          <div className="card-base p-6 text-center text-muted-foreground">Ոչինչ չկա այս բաժնում։</div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="card-base p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.quest_templates?.title || r.template_id}</div>
                    <div className="text-xs text-muted-foreground">{r.profiles?.full_name || r.profiles?.email} • {new Date(r.created_at).toLocaleString("hy-AM")}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">+{r.quest_templates?.xp} XP</span>
                </div>
                {r.content && <p className="text-sm whitespace-pre-wrap mb-2">{r.content}</p>}
                {r.media_urls?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {r.media_urls.map((m: string, i: number) => (
                      <button key={i} onClick={async () => { const u = await signedUrl(m); if (u) window.open(u, "_blank"); }} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary hover:bg-secondary/70">
                        <ExternalLink className="w-3 h-3" /> Ֆայլ {i + 1}
                      </button>
                    ))}
                  </div>
                )}
                {filter === "pending" && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <button onClick={() => review(r.id, true)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-success/15 text-success text-sm font-medium hover:bg-success/25"><CheckCircle2 className="w-4 h-4" /> Հաստատել</button>
                    <button onClick={() => review(r.id, false)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-destructive/15 text-destructive text-sm font-medium hover:bg-destructive/25"><XCircle className="w-4 h-4" /> Մերժել</button>
                  </div>
                )}
                {r.review_note && <p className="text-xs text-muted-foreground mt-2">📝 {r.review_note}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

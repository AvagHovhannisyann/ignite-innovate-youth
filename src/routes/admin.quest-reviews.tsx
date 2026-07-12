import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle2, XCircle, Loader2, ExternalLink, ArrowLeft } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ReviewRow = Tables<"quest_submissions"> & {
  quest_templates: Pick<Tables<"quest_templates">, "title" | "xp" | "description"> | null;
  profile: Pick<Tables<"profiles">, "full_name" | "email"> | null;
};

export const Route = createFileRoute("/admin/quest-reviews")({ component: QuestReviews });

function QuestReviews() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    const { data: submissions } = await supabase
      .from("quest_submissions")
      .select("*, quest_templates(title,xp,description)")
      .eq("status", filter)
      .order("created_at", { ascending: false });
    const userIds = Array.from(new Set((submissions || []).map((row) => row.user_id)));
    const { data: profiles } = userIds.length
      ? await supabase.from("profiles").select("id,full_name,email").in("id", userIds)
      : { data: [] };
    const profileById = new Map((profiles || []).map((profile) => [profile.id, profile]));
    setRows(
      (submissions || []).map((submission) => ({
        ...submission,
        profile: profileById.get(submission.user_id) || null,
      })),
    );
    setBusy(false);
  }, [filter]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    (async () => {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (!roles?.some((r) => r.role === "admin")) {
        nav({ to: "/dashboard" });
        return;
      }
      await load();
    })();
  }, [user, loading, nav, load]);

  async function review(id: string, approve: boolean, note = "") {
    const { error } = await supabase.rpc("review_quest_submission", {
      _id: id,
      _approve: approve,
      _note: note,
    });
    if (error) toast.error(getErrorMessage(error, "Չհաջողվեց պահպանել որոշումը"));
    else {
      toast.success(approve ? "Քվեստը հաստատված է։" : "Քվեստը մերժված է։");
      await load();
    }
  }

  async function signedUrl(path: string) {
    const { data } = await supabase.storage.from("quest-evidence").createSignedUrl(path, 3600);
    return data?.signedUrl || "";
  }

  return (
    <>
      <div className="max-w-5xl mx-auto p-4 sm:p-6 pb-24 md:pb-6">
        <div className="flex items-center gap-2 mb-4">
          <Link
            to="/admin"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Ադմին
          </Link>
        </div>
        <h1 className="font-display text-2xl font-bold mb-1">Քվեստների ստուգում</h1>
        <p className="text-sm text-muted-foreground mb-4">
          Ստուգիր ուսանողների ուղարկած ապացույցները։
        </p>

        <div className="flex gap-2 mb-4">
          {(["pending", "approved", "rejected"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm ${filter === s ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"}`}
            >
              {s === "pending" ? "Սպասում է" : s === "approved" ? "Հաստատված" : "Մերժված"}
            </button>
          ))}
        </div>

        {busy ? (
          <div className="flex items-center text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Բեռնվում է…
          </div>
        ) : rows.length === 0 ? (
          <div className="card-base p-6 text-center text-muted-foreground">
            Ոչինչ չկա այս բաժնում։
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="card-base p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {r.quest_templates?.title || r.template_id}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.profile?.full_name || r.profile?.email || "Օգտատեր"} •{" "}
                      {new Date(r.created_at).toLocaleString("hy-AM")}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    +{r.quest_templates?.xp} XP
                  </span>
                </div>
                {r.content && <p className="text-sm whitespace-pre-wrap mb-2">{r.content}</p>}
                {r.media_urls?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {r.media_urls.map((m: string, i: number) => (
                      <button
                        type="button"
                        key={i}
                        onClick={async () => {
                          const u = await signedUrl(m);
                          if (u) window.open(u, "_blank", "noopener,noreferrer");
                        }}
                        className="text-xs inline-flex items-center gap-1 px-3 py-2 min-h-[44px] rounded bg-secondary hover:bg-secondary/70"
                      >
                        <ExternalLink className="w-3 h-3" /> Ֆայլ {i + 1}
                      </button>
                    ))}
                  </div>
                )}
                {filter === "pending" && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => void review(r.id, true)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[44px] rounded-lg bg-success/15 text-success text-sm font-medium hover:bg-success/25"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Հաստատել
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setReviewNote("");
                        setRejectingId(r.id);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[44px] rounded-lg bg-destructive/15 text-destructive text-sm font-medium hover:bg-destructive/25"
                    >
                      <XCircle className="w-4 h-4" /> Մերժել
                    </button>
                  </div>
                )}
                {r.review_note && (
                  <p className="text-xs text-muted-foreground mt-2">Նշում՝ {r.review_note}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <AlertDialog
          open={rejectingId !== null}
          onOpenChange={(open) => {
            if (!open) setRejectingId(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Մերժե՞լ քվեստի ապացույցը</AlertDialogTitle>
              <AlertDialogDescription>
                Գրիր հստակ պատճառ, որպեսզի ուսանողը հասկանա՝ ինչ ուղղել հաջորդ անգամ։
              </AlertDialogDescription>
            </AlertDialogHeader>
            <label className="text-sm font-medium" htmlFor="quest-review-note">
              Մերժման պատճառ
            </label>
            <textarea
              id="quest-review-note"
              value={reviewNote}
              onChange={(event) => setReviewNote(event.target.value)}
              rows={4}
              maxLength={1000}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Նշիր՝ ինչն է պակասում կամ ինչ պետք է վերաուղարկել…"
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Չեղարկել</AlertDialogCancel>
              <AlertDialogAction
                disabled={!reviewNote.trim()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (rejectingId) void review(rejectingId, false, reviewNote.trim());
                  setRejectingId(null);
                }}
              >
                Մերժել
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}

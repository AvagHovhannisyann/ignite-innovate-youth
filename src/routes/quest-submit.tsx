import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Upload, X, Loader2, CheckCircle2, AlertCircle, Lightbulb } from "lucide-react";
import { todayKey } from "@/lib/quests";
import type { Tables } from "@/integrations/supabase/types";
import { getErrorMessage } from "@/lib/utils";

const MAX_FILES = 8;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

export const Route = createFileRoute("/quest-submit")({
  validateSearch: (s: Record<string, unknown>) => z.object({ template_id: z.string() }).parse(s),
  component: QuestSubmit,
});

function QuestSubmit() {
  const { template_id } = useSearch({ from: "/quest-submit" });
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [tpl, setTpl] = useState<Tables<"quest_templates"> | null>(null);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    supabase
      .from("quest_templates")
      .select("*")
      .eq("id", template_id)
      .maybeSingle()
      .then(({ data }) => setTpl(data));
  }, [user, loading, nav, template_id]);

  async function submit() {
    if (!user || !tpl) return;
    setBusy(true);
    setErr(null);
    const uploadedPaths: string[] = [];
    try {
      const urls: string[] = [];
      for (const f of files) {
        const safeName = f.name.replace(/[^a-z0-9.\-_]/gi, "_").slice(0, 80);
        const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from("quest-evidence").upload(path, f, {
          contentType: f.type,
          upsert: false,
        });
        if (error) throw error;
        urls.push(path);
        uploadedPaths.push(path);
      }
      const { error } = await supabase.rpc("submit_quest", {
        _template_id: template_id,
        _period: tpl.kind === "daily" ? todayKey() : "permanent",
        _content: content,
        _media: urls,
      });
      if (error) throw error;
      setDone(true);
      setTimeout(() => nav({ to: "/quests" }), 1500);
    } catch (error: unknown) {
      if (uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage
          .from("quest-evidence")
          .remove(uploadedPaths);
        if (cleanupError) console.error("Could not clean up quest evidence", cleanupError);
      }
      setErr(getErrorMessage(error, "Չհաջողվեց ուղարկել"));
    } finally {
      setBusy(false);
    }
  }

  function selectFiles(selected: File[]) {
    if (selected.length > MAX_FILES) {
      setErr(`Կարելի է կցել առավելագույնը ${MAX_FILES} ֆայլ։`);
      return;
    }
    const invalid = selected.find(
      (file) => !ALLOWED_FILE_TYPES.has(file.type) || file.size > MAX_FILE_BYTES,
    );
    if (invalid) {
      setErr("Կցիր JPG, PNG, WebP, PDF կամ TXT ֆայլ՝ առավելագույնը 10 ՄԲ չափով։");
      return;
    }
    setErr(null);
    setFiles(selected);
  }

  return (
    <>
      <div className="max-w-2xl mx-auto p-4 sm:p-6 pb-24 md:pb-6">
        {!tpl ? (
          <div className="text-muted-foreground">Բեռնվում է…</div>
        ) : done ? (
          <div className="card-base p-8 text-center">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
            <h2 className="font-display text-xl font-semibold">Ուղարկվեց</h2>
            <p className="text-muted-foreground text-sm mt-2">Ադմինը կստուգի շուտով։</p>
          </div>
        ) : (
          <div className="card-base p-5 space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-primary mb-1">
                Քվեստի ապացույց
              </div>
              <h2 className="font-display text-xl font-semibold">{tpl.title}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tpl.description}</p>
              {tpl.evidence_prompt && (
                <p className="mt-2 flex items-start gap-2 rounded-lg bg-secondary/60 p-2 text-sm">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                  <span>{tpl.evidence_prompt}</span>
                </p>
              )}
            </div>

            <div>
              <label htmlFor="quest-evidence-content" className="text-sm font-medium mb-1 block">
                Բացատրիր ինչ ես արել
              </label>
              <textarea
                id="quest-evidence-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Նկարագրիր, թե ինչ ես արել և ինչպես ես հասել նպատակին…"
                className="w-full px-3 py-2.5 rounded-lg border border-border bg-secondary/40 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Կցել ապացույց (նկար/ֆայլ)</label>
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-secondary/30 cursor-pointer hover:bg-secondary/50 text-sm">
                <Upload className="w-4 h-4" />
                <span>Ընտրել ֆայլեր</span>
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,application/pdf,text/plain"
                  className="hidden"
                  onChange={(event) => selectFiles(Array.from(event.target.files || []))}
                />
              </label>
              {files.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {files.map((f, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-xs bg-secondary/40 rounded px-2 py-1"
                    >
                      <span className="truncate">{f.name}</span>
                      <button
                        type="button"
                        aria-label={`Հեռացնել ${f.name} ֆայլը`}
                        onClick={() => setFiles((current) => current.filter((_, j) => j !== i))}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {err && (
              <div role="alert" className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" /> {err}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => nav({ to: "/quests" })}
                className="px-3 py-2 rounded-lg hover:bg-secondary text-sm"
              >
                Չեղարկել
              </button>
              <button
                onClick={submit}
                disabled={busy || (content.trim().length < 5 && files.length === 0)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Ուղարկել ստուգման
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

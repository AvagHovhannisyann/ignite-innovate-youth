import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  fetchProjectMessages,
  removeProjectMedia,
  sendProjectMessage,
  uploadProjectMedia,
  MAX_PROJECT_MEDIA_FILES,
  type ProjectMessage,
} from "@/lib/projects";
import { getErrorMessage } from "@/lib/utils";

export function ProjectChat({
  projectId,
  userId,
  canPost,
}: {
  projectId: string;
  userId: string;
  canPost: boolean;
}) {
  const [messages, setMessages] = useState<ProjectMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await fetchProjectMessages(projectId));
    } catch {
      setMessages([]);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`project-${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "project_messages",
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [projectId, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (!draft.trim() && files.length === 0) return;
    setSending(true);
    const uploaded: { path: string; type: string }[] = [];
    try {
      for (const file of files) {
        uploaded.push(await uploadProjectMedia(projectId, userId, file));
      }
      await sendProjectMessage({ projectId, userId, content: draft.trim(), media: uploaded });
      setDraft("");
      setFiles([]);
      await load();
    } catch (error: unknown) {
      try {
        await removeProjectMedia(uploaded.map((item) => item.path));
      } catch (cleanupError: unknown) {
        console.error("Could not clean up interrupted project upload", cleanupError);
      }
      toast.error(getErrorMessage(error, "Չհաջողվեց ուղարկել"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[60vh] min-h-[400px] bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {messages === null ? (
          <div className="grid place-items-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center my-auto">
            Դեռ հաղորդագրություններ չկան։ Կիսվիր առաջընթացով՝ նկար, տեսանյութ կամ կարճ
            նկարագրություն։
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === userId;
            const initial = (m.author?.full_name || "Օ").slice(0, 1).toUpperCase();
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <div className="w-8 h-8 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground text-xs font-semibold shrink-0">
                  {initial}
                </div>
                <div
                  className={`max-w-[78%] rounded-2xl p-2.5 border ${mine ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}
                >
                  <div
                    className={`text-[10px] font-medium opacity-70 mb-1 ${mine ? "" : "text-foreground"}`}
                  >
                    {m.author?.full_name || "Օգտատեր"} ·{" "}
                    {new Date(m.created_at).toLocaleString("hy-AM")}
                  </div>
                  {m.content && (
                    <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                  )}
                  {(m.signed_media || []).length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {m.signed_media!.map((s, i) => (
                        <div key={i} className="rounded-lg overflow-hidden bg-background/40">
                          {s.type === "video" ? (
                            <video
                              src={s.url}
                              controls
                              playsInline
                              aria-label={`Նախագծի կցված տեսանյութ ${i + 1}`}
                              className="w-full max-h-48 object-cover"
                            />
                          ) : s.type === "image" ? (
                            <img
                              src={s.url}
                              alt={`Նախագծի կցված նկար ${i + 1}`}
                              loading="lazy"
                              className="w-full max-h-48 object-cover"
                            />
                          ) : (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block p-2 text-xs underline"
                            >
                              Ներբեռնել ֆայլը
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      {canPost ? (
        <form onSubmit={send} className="border-t border-border p-2 sm:p-3 bg-background/40">
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((f, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-[11px] bg-secondary border border-border px-2 py-1 rounded-full max-w-full break-all"
                >
                  {f.name}
                  <button
                    type="button"
                    aria-label={`Հեռացնել ${f.name} ֆայլը`}
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}
                    className="opacity-70 hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label
              aria-label="Կցել ֆայլ"
              className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg bg-secondary border border-border cursor-pointer hover:bg-background"
            >
              <Paperclip className="w-4 h-4" />
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime,application/pdf"
                className="hidden"
                onChange={(event) => {
                  const selected = Array.from(event.target.files || []);
                  if (files.length + selected.length > MAX_PROJECT_MEDIA_FILES) {
                    toast.error(`Կարելի է կցել առավելագույնը ${MAX_PROJECT_MEDIA_FILES} ֆայլ։`);
                  } else {
                    setFiles((current) => [...current, ...selected]);
                  }
                  event.target.value = "";
                }}
              />
            </label>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Գրիր թարմացում, կցիր ապացույց…"
              rows={1}
              aria-label="Նախագծի հաղորդագրություն"
              maxLength={4000}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none min-h-[44px] max-h-32"
            />
            <button
              type="submit"
              disabled={sending || (!draft.trim() && files.length === 0)}
              aria-label="Ուղարկել հաղորդագրությունը"
              className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="border-t border-border p-3 text-xs text-center text-muted-foreground">
          Միայն մասնակիցները կարող են գրառում ավելացնել։
        </div>
      )}
    </div>
  );
}

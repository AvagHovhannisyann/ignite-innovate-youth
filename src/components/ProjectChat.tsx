import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { fetchProjectMessages, sendProjectMessage, uploadProjectMedia, type ProjectMessage } from "@/lib/projects";

export function ProjectChat({ projectId, userId, canPost }: { projectId: string; userId: string; canPost: boolean }) {
  const [messages, setMessages] = useState<ProjectMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    try { setMessages(await fetchProjectMessages(projectId)); } catch { setMessages([]); }
  }

  useEffect(() => { load(); }, [projectId]);

  useEffect(() => {
    const ch = supabase.channel(`project-${projectId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_messages", filter: `project_id=eq.${projectId}` },
        () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (!draft.trim() && files.length === 0) return;
    setSending(true);
    try {
      const uploaded: { path: string; type: string }[] = [];
      for (const f of files) uploaded.push(await uploadProjectMedia(projectId, f));
      await sendProjectMessage({ projectId, userId, content: draft.trim(), media: uploaded });
      setDraft(""); setFiles([]);
      await load();
    } catch (err: any) {
      alert(err.message || "Չհաջողվեց ուղարկել");
    } finally { setSending(false); }
  }

  return (
    <div className="flex flex-col h-[60vh] min-h-[400px] bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {messages === null ? (
          <div className="grid place-items-center h-full"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center my-auto">Դեռ հաղորդագրություններ չկան։ Կիսվիր առաջընթացով՝ նկար, տեսանյութ կամ կարճ նկարագրություն։</p>
        ) : (
          messages.map((m) => {
            const mine = m.user_id === userId;
            const initial = (m.author?.full_name || m.author?.email || "Օ").slice(0, 1).toUpperCase();
            return (
              <div key={m.id} className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                <div className="w-8 h-8 rounded-full bg-gradient-hero grid place-items-center text-primary-foreground text-xs font-semibold shrink-0">{initial}</div>
                <div className={`max-w-[78%] rounded-2xl p-2.5 border ${mine ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border"}`}>
                  <div className={`text-[10px] font-medium opacity-70 mb-1 ${mine ? "" : "text-foreground"}`}>{m.author?.full_name || "Օգտատեր"} · {new Date(m.created_at).toLocaleString()}</div>
                  {m.content && <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>}
                  {(m.signed_media || []).length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {m.signed_media!.map((s, i) => (
                        <div key={i} className="rounded-lg overflow-hidden bg-background/40">
                          {s.type === "video" ? (
                            <video src={s.url} controls playsInline className="w-full max-h-48 object-cover" />
                          ) : s.type === "image" ? (
                            <img src={s.url} alt="" loading="lazy" className="w-full max-h-48 object-cover" />
                          ) : (
                            <a href={s.url} target="_blank" rel="noreferrer" className="block p-2 text-xs underline">Ներբեռնել ֆայլը</a>
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
                <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-secondary border border-border px-2 py-1 rounded-full max-w-full break-all">
                  {f.name}
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="opacity-70 hover:opacity-100"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-secondary border border-border cursor-pointer hover:bg-background">
              <Paperclip className="w-4 h-4" />
              <input type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={(e) => {
                const list = Array.from(e.target.files || []);
                setFiles((f) => [...f, ...list].slice(0, 6));
                e.target.value = "";
              }} />
            </label>
            <textarea
              value={draft} onChange={(e) => setDraft(e.target.value)}
              placeholder="Գրիր թարմացում, կցիր ապացույց…"
              rows={1}
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none min-h-[40px] max-h-32"
            />
            <button type="submit" disabled={sending || (!draft.trim() && files.length === 0)} className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </form>
      ) : (
        <div className="border-t border-border p-3 text-xs text-center text-muted-foreground">Միայն մասնակիցները կարող են գրառում ավելացնել։</div>
      )}
    </div>
  );
}

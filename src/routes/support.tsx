import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import {
  createThread,
  fetchMessages,
  fetchMyThreads,
  sendMessage,
  type SupportMessage,
  type SupportThread,
} from "@/lib/support";
import { Loader2, LifeBuoy, Plus, Send, ArrowLeft, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

export const Route = createFileRoute("/support")({ component: SupportPage });

function statusLabel(s: SupportThread["status"]) {
  if (s === "open") return "Բաց";
  if (s === "answered") return "Պատասխանված";
  return "Փակված";
}

function SupportPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [threads, setThreads] = useState<SupportThread[] | null>(null);
  const [active, setActive] = useState<SupportThread | null>(null);
  const [creating, setCreating] = useState(false);
  const [subject, setSubject] = useState("");
  const [firstMsg, setFirstMsg] = useState("");

  const load = useCallback(async () => {
    try {
      setThreads(await fetchMyThreads());
    } catch {
      setThreads([]);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    void load();
  }, [user, loading, nav, load]);

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !firstMsg.trim()) return;
    setCreating(true);
    try {
      const t = await createThread(user.id, subject, firstMsg);
      setSubject("");
      setFirstMsg("");
      await load();
      setActive(t);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց ստեղծել հարցումը"));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-3xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-5 sm:py-8 pb-40 md:pb-10">
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary font-semibold mb-1">
            <LifeBuoy className="w-3.5 h-3.5" /> Աջակցություն
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
            Կապ ադմինների հետ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Տուր ցանկացած հարց՝ ադմինը կպատասխանի այստեղ։
          </p>
        </div>

        {active ? (
          <ThreadView
            userId={user!.id}
            thread={active}
            onBack={() => {
              setActive(null);
              void load();
            }}
          />
        ) : (
          <>
            <form onSubmit={submitNew} className="card-base rounded-2xl p-4 mb-6 space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <Plus className="w-4 h-4 text-primary" /> Նոր հարցում
              </div>
              <input
                id="support-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={140}
                aria-label="Հարցման թեմա"
                placeholder="Թեմա (օր.՝ «Չեմ կարողանում ուղարկել նախագիծը»)"
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm min-h-[44px]"
              />
              <textarea
                id="support-first-message"
                value={firstMsg}
                onChange={(e) => setFirstMsg(e.target.value)}
                rows={3}
                maxLength={4000}
                aria-label="Հարցման նկարագրություն"
                placeholder="Նկարագրիր խնդիրը կամ հարցը…"
                className="input-base resize-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creating || !firstMsg.trim()}
                  className="btn btn-primary"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}{" "}
                  Ուղարկել
                </button>
              </div>
            </form>

            <div>
              <div className="flex items-center gap-2 mb-3 font-semibold">
                <MessageCircle className="w-4 h-4 text-primary" /> Իմ հարցումները
              </div>
              {threads === null ? (
                <div className="grid place-items-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : threads.length === 0 ? (
                <div className="card-base rounded-2xl px-6 py-10 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary mb-3">
                    <MessageCircle className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h3 className="font-display text-base font-semibold mb-1">
                    Դեռ հարցումներ չկան։
                  </h3>
                  <p className="text-sm text-muted-foreground">Ստեղծիր առաջինը վերևի ֆորմայով։</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {threads.map((t) => (
                    <li key={t.id}>
                      <button
                        onClick={() => setActive(t)}
                        className="w-full text-left card-interactive rounded-xl p-3 min-h-[44px]"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium truncate min-w-0">{t.subject}</div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${
                              t.status === "answered"
                                ? "bg-success/15 text-success"
                                : t.status === "closed"
                                  ? "bg-secondary text-muted-foreground"
                                  : "bg-primary/10 text-primary"
                            }`}
                          >
                            {statusLabel(t.status)}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {new Date(t.last_message_at).toLocaleString("hy-AM")}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ThreadView({
  userId,
  thread,
  isAdmin: adminMode = false,
  onBack,
}: {
  userId: string;
  thread: SupportThread;
  isAdmin?: boolean;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await fetchMessages(thread.id));
    } catch {
      setMessages([]);
    }
  }, [thread.id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`support-${thread.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `thread_id=eq.${thread.id}`,
        },
        () => {
          load();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [thread.id, load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(thread.id, draft);
      setDraft("");
      await load();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Չհաջողվեց ուղարկել հաղորդագրությունը"));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card-base rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 p-2 min-[380px]:p-3 border-b border-border">
        <button
          onClick={onBack}
          aria-label="Վերադառնալ"
          className="shrink-0 min-w-[44px] min-h-[44px] grid place-items-center rounded-lg hover:bg-secondary"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{thread.subject}</div>
          <div className="text-[11px] text-muted-foreground">{statusLabel(thread.status)}</div>
        </div>
      </div>

      <div className="h-[55vh] min-h-[360px] overflow-y-auto p-3 space-y-3 bg-background/40">
        {messages === null ? (
          <div className="grid place-items-center h-full">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="grid place-items-center h-full text-center">
            <div>
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary mb-3">
                <MessageCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Հաղորդագրություններ չկան։</p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 border text-sm whitespace-pre-wrap break-words ${
                    mine
                      ? "bg-primary text-primary-foreground border-primary"
                      : m.sender_role === "admin"
                        ? "bg-accent/15 border-accent/40"
                        : "bg-secondary border-border"
                  }`}
                >
                  <div className="text-[10px] opacity-70 mb-1">
                    {m.sender_role === "admin" ? "Ադմին" : "Դու"} ·{" "}
                    {new Date(m.created_at).toLocaleString("hy-AM")}
                  </div>
                  {m.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="border-t border-border p-2 flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={1}
          maxLength={4000}
          aria-label={adminMode ? "Ադմինի պատասխանը" : "Աջակցության հաղորդագրություն"}
          placeholder={adminMode ? "Պատասխանիր որպես ադմին…" : "Գրիր հաղորդագրություն…"}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-input bg-background text-sm resize-none min-h-[44px] max-h-32"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          aria-label="Ուղարկել"
          className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}

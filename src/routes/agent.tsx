import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AgentChat } from "@/components/AgentChat";
import { Loader2, RefreshCw } from "lucide-react";
import type { UIMessage } from "ai";

// Other pages deep-link here with a prefilled question, e.g. from an
// opportunity card's "Հարցնել AI-ից" button — /agent?ask=...
const searchSchema = z.object({ ask: z.string().optional() });

export const Route = createFileRoute("/agent")({
  component: AgentPage,
  validateSearch: searchSchema,
});

function AgentPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const { ask } = Route.useSearch();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) { nav({ to: "/auth" }); return; }
    (async () => {
      try {
        setError(null);
        const { data: existing, error: existingError } = await supabase
          .from("agent_threads").select("id").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
        if (existingError) throw existingError;

        let tid = existing?.id as string | undefined;
        if (!tid) {
          const { data: created, error: createError } = await supabase.from("agent_threads").insert({ user_id: user.id }).select("id").single();
          if (createError) throw createError;
          tid = created?.id;
        }
        if (!tid) throw new Error("AI զրույցը չհաջողվեց ստեղծել։");

        const { data: msgs, error: messagesError } = await supabase.from("agent_messages").select("*").eq("thread_id", tid).order("created_at");
        if (messagesError) throw messagesError;

        if (cancelled) return;
        setThreadId(tid);
        setInitialMessages((msgs || []).map((r: any) => ({
          id: r.ai_message_id || r.id,
          role: r.role,
          parts: Array.isArray(r.parts) ? r.parts : [],
        })));
        setReady(true);
      } catch (e: any) {
        if (cancelled) return;
        console.error(e);
        setError(e?.message || "AI օգնականը չհաջողվեց բեռնել։");
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user, loading, nav]);

  async function resetThread() {
    if (!user || !threadId) return;
    await supabase.from("agent_messages").delete().eq("thread_id", threadId);
    setInitialMessages([]);
    // re-mount by changing key on AgentChat
    const { data: created } = await supabase.from("agent_threads").insert({ user_id: user.id }).select("id").single();
    if (created?.id) setThreadId(created.id);
  }

  return (
    <div className="p-3 sm:p-4 pb-24 md:pb-4 min-w-0 overflow-x-hidden">
      {!ready ? (
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Բեռնվում է…</div>
      ) : error ? (
        <div className="max-w-md mx-auto mt-16 card-base p-5 text-center space-y-3">
          <h2 className="font-semibold">AI օգնականը չբացվեց</h2>
          <p className="text-sm text-muted-foreground break-words">{error}</p>
          <button onClick={() => window.location.reload()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
            <RefreshCw className="w-4 h-4" /> Կրկին փորձել
          </button>
        </div>
      ) : threadId ? (
        <AgentChat
          key={threadId}
          threadId={threadId}
          initialMessages={initialMessages}
          onReset={resetThread}
          autoAsk={ask}
          onAutoAskSent={() => nav({ to: "/agent", search: {}, replace: true })}
        />
      ) : null}
    </div>
  );
}

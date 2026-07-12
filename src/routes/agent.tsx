import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AgentChat } from "@/components/AgentChat";
import { Loader2, RefreshCw } from "lucide-react";
import type { UIMessage } from "ai";
import { getErrorMessage } from "@/lib/utils";
import { toast } from "sonner";

// Other pages deep-link here with a prefilled question, e.g. from an
// opportunity card's "Հարցնել AI-ից" button — /agent?ask=...
const searchSchema = z.object({ ask: z.string().max(2000).optional() });

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
  const [threadEpoch, setThreadEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user) {
      nav({ to: "/auth" });
      return;
    }
    (async () => {
      try {
        setError(null);
        const { data: thread, error: threadError } = await supabase.rpc("ensure_agent_thread");
        if (threadError) throw threadError;
        const tid = thread?.id;
        if (!tid) throw new Error("AI զրույցը չհաջողվեց ստեղծել։");

        const { data: msgs, error: messagesError } = await supabase
          .from("agent_messages")
          .select("*")
          .eq("thread_id", tid)
          .order("created_at");
        if (messagesError) throw messagesError;

        if (cancelled) return;
        setThreadId(tid);
        setInitialMessages(
          (msgs || []).map((message): UIMessage => ({
            id: message.ai_message_id || message.id,
            role: message.role === "assistant" ? "assistant" : "user",
            parts: Array.isArray(message.parts) ? (message.parts as UIMessage["parts"]) : [],
          })),
        );
        setReady(true);
      } catch (error: unknown) {
        if (cancelled) return;
        console.error(error);
        setError(getErrorMessage(error, "AI օգնականը չհաջողվեց բեռնել։"));
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loading, nav]);

  async function resetThread() {
    if (!user || !threadId) return;
    const { error: resetError } = await supabase.rpc("reset_agent_thread", {
      _thread_id: threadId,
    });
    if (resetError) {
      toast.error(getErrorMessage(resetError, "Զրույցը չհաջողվեց մաքրել։"));
      return;
    }
    setInitialMessages([]);
    setThreadEpoch((value) => value + 1);
  }

  return (
    <div className="p-3 sm:p-4 pb-24 md:pb-4 min-w-0 overflow-x-hidden">
      {!ready ? (
        <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Բեռնվում է…
        </div>
      ) : error ? (
        <div className="max-w-md mx-auto mt-16 card-base p-5 text-center space-y-3">
          <h2 className="font-semibold">AI օգնականը չբացվեց</h2>
          <p className="text-sm text-muted-foreground break-words">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            <RefreshCw className="w-4 h-4" /> Կրկին փորձել
          </button>
        </div>
      ) : threadId ? (
        <AgentChat
          key={`${threadId}:${threadEpoch}`}
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

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Loader2, RotateCcw, Wrench, ChevronDown } from "lucide-react";
import logo from "@/assets/logo.png";

type Props = { threadId: string; initialMessages: UIMessage[]; onReset: () => void };

function makeChatTransport(bearer: string | null, threadId: string) {
  if (!bearer) return undefined;
  return new DefaultChatTransport({
    api: "/api/chat",
    headers: { Authorization: `Bearer ${bearer}` },
    body: { threadId },
  });
}

function MessageBubble({ m }: { m: UIMessage }) {
  const text = (m.parts || []).filter((p: any) => p.type === "text").map((p: any) => p.text).join("");
  const toolParts = (m.parts || []).filter((p: any) => typeof p.type === "string" && p.type.startsWith("tool-")) as any[];

  if (m.role === "user") {
    return (
      <div className="flex justify-end mb-3">
        <div className="max-w-[80%] rounded-2xl bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-soft">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 mb-4">
      <img src={logo} alt="" className="w-8 h-8 rounded-full shrink-0 mt-1" />
      <div className="flex-1 min-w-0 space-y-2">
        {toolParts.map((p: any, i) => <ToolBlock key={i} part={p} />)}
        {text && (
          <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">{text}</div>
        )}
      </div>
    </div>
  );
}

function ToolBlock({ part }: { part: any }) {
  const [open, setOpen] = useState(false);
  const name = String(part.type || "").replace(/^tool-/, "");
  const state = part.state || "input-available";
  return (
    <div className="rounded-xl border border-border bg-secondary/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-secondary/70"
      >
        <Wrench className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="truncate">{name}</span>
        <span className={`ml-auto text-[10px] uppercase tracking-wide ${state === "output-available" ? "text-success" : state === "output-error" ? "text-destructive" : "text-muted-foreground"}`}>{state}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 text-[11px] font-mono whitespace-pre-wrap break-words bg-background/60">
          {part.input && <><div className="text-muted-foreground mb-1">input</div><pre className="text-foreground/80 overflow-auto max-h-40">{JSON.stringify(part.input, null, 2)}</pre></>}
          {part.output && <><div className="text-muted-foreground mt-2 mb-1">output</div><pre className="text-foreground/80 overflow-auto max-h-40">{JSON.stringify(part.output, null, 2)}</pre></>}
          {part.errorText && <div className="text-destructive">{part.errorText}</div>}
        </div>
      )}
    </div>
  );
}

export function AgentChat({ threadId, initialMessages, onReset }: Props) {
  const [bearer, setBearer] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setBearer(data.session?.access_token || null));
  }, []);

  const transport = useMemo(() => makeChatTransport(bearer, threadId), [bearer, threadId]);
  const chatId = bearer ? threadId : `${threadId}:pending-auth`;

  const { messages, sendMessage, status, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport: makeChatTransport(bearer, threadId),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";

  async function submit() {
    const text = input.trim();
    if (!text || !transport) return;
    setInput("");
    await sendMessage({ text }, { body: { threadId }, headers: { Authorization: `Bearer ${bearer}` } });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] max-w-3xl mx-auto w-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="text-xs text-muted-foreground">Քո անձնական AI օգնականը։ Կարող է մուտք գործել քո պրոֆիլ, օրակարգ, քվեսթներ։</div>
        <button onClick={onReset} className="text-xs inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-secondary text-muted-foreground" title="Մաքրել զրույցը">
          <RotateCcw className="w-3.5 h-3.5" /> Նոր
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="text-center text-sm text-muted-foreground mt-12">
            <img src={logo} alt="" className="w-12 h-12 object-contain mx-auto mb-3 opacity-80" />
            Բարև։ Ի՞նչ կօգնեմ այսօր։<br/>
            <span className="text-xs">Փորձիր՝ «Կազմիր ինձ համար շաբաթվա պլան» կամ «Ի՞նչ նախագիծ սկսեմ»</span>
          </div>
        )}
        {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
        {status === "submitted" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Մտածում է…</div>
        )}
        {error && <div className="text-sm text-destructive">Սխալ. {error.message}</div>}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="border-t border-border p-3 flex gap-2 items-end bg-background"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          rows={1}
          placeholder="Գրիր հաղորդագրություն… (Enter ուղարկելու, Shift+Enter նոր տողի)"
          className="flex-1 resize-none rounded-xl border border-border bg-secondary/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-40"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 hover:opacity-90"
          aria-label="Ուղարկել"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}

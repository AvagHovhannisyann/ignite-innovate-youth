import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarkdownLite } from "@/lib/markdown-lite";
import {
  Send, Loader2, RotateCcw, ChevronDown, User as UserIcon, Calendar,
  CalendarPlus, CalendarX, Compass, MessageCircleQuestion, Trophy, Lightbulb, Wrench,
} from "lucide-react";
import logo from "@/assets/logo.png";

/** Friendly Armenian labels for the agent's tools — no raw internals in the UI. */
const TOOL_META: Record<string, { label: string; icon: typeof Wrench }> = {
  get_profile: { label: "Կարդում է քո պրոֆիլը", icon: UserIcon },
  list_schedule: { label: "Ստուգում է օրակարգը", icon: Calendar },
  add_schedule_event: { label: "Ավելացնում է իրադարձություն", icon: CalendarPlus },
  delete_schedule_event: { label: "Ջնջում է իրադարձություն", icon: CalendarX },
  list_opportunities: { label: "Փնտրում է հնարավորություններ", icon: Compass },
  ask_admin: { label: "Հարց է ուղարկում ադմինին", icon: MessageCircleQuestion },
  list_quests: { label: "Ստուգում է քվեսթները", icon: Trophy },
  recommend_next_step: { label: "Մտածում է հաջորդ քայլի մասին", icon: Lightbulb },
};

const SUGGESTED_PROMPTS = [
  "Կազմիր ինձ համար շաբաթվա պլան",
  "Ի՞նչ նախագիծ սկսեմ իմ հետաքրքրություններով",
  "Ցույց տուր իմ քվեսթների վիճակը",
  "Ավելացրու ուսումնական ժամ վաղը 18:00-ին",
];

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
          <div className="text-sm text-foreground break-words">
            <MarkdownLite text={text} />
          </div>
        )}
      </div>
    </div>
  );
}

function ToolBlock({ part }: { part: any }) {
  const [open, setOpen] = useState(false);
  const name = String(part.type || "").replace(/^tool-/, "");
  const state = part.state || "input-available";
  const meta = TOOL_META[name] || { label: name, icon: Wrench };
  const done = state === "output-available";
  const failed = state === "output-error";
  return (
    <div className="rounded-xl border border-border bg-secondary/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-secondary/70"
      >
        <meta.icon className={`w-3.5 h-3.5 shrink-0 ${failed ? "text-destructive" : "text-primary"}`} />
        <span className="truncate">{meta.label}</span>
        <span className={`ml-auto shrink-0 ${done ? "text-success" : failed ? "text-destructive" : "text-muted-foreground"}`}>
          {done ? "✓" : failed ? "Սխալ" : <Loader2 className="w-3 h-3 animate-spin" />}
        </span>
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
          <div className="text-center mt-10 sm:mt-14">
            <img src={logo} alt="" className="w-14 h-14 object-contain mx-auto mb-3 animate-float" />
            <div className="font-display text-lg mb-1">Բարև։ Ի՞նչ կօգնեմ այսօր։</div>
            <p className="text-xs text-muted-foreground mb-5">
              Ես գիտեմ քո պրոֆիլը, օրակարգը և քվեսթները — հարցրու ինչ ուզում ես։
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md mx-auto">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={!transport}
                  onClick={() => sendMessage({ text: p }, { body: { threadId }, headers: { Authorization: `Bearer ${bearer}` } })}
                  className="text-xs px-3 py-2 rounded-full border border-border bg-card/70 hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                >
                  {p}
                </button>
              ))}
            </div>
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

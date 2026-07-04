import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarkdownLite } from "@/lib/markdown-lite";
import {
  Send, Loader2, RotateCcw, ChevronDown, User as UserIcon, Calendar,
  CalendarPlus, CalendarX, CalendarCog, Compass, UserPlus, MessageCircleQuestion,
  Trophy, Lightbulb, Wrench, Rocket, Send as SendIcon, Ban, ListChecks, Bell,
  MessageSquareText, Award, FileCheck, Sparkles, RefreshCw, AlertTriangle,
} from "lucide-react";
import logo from "@/assets/logo.png";

/** Friendly Armenian labels for the agent's tools — no raw internals in the UI. */
const TOOL_META: Record<string, { label: string; icon: typeof Wrench }> = {
  get_profile: { label: "Կարդում է քո պրոֆիլը", icon: UserIcon },
  update_profile: { label: "Թարմացնում է քո պրոֆիլը", icon: UserIcon },
  list_schedule: { label: "Ստուգում է օրակարգը", icon: Calendar },
  add_schedule_event: { label: "Ավելացնում է իրադարձություն", icon: CalendarPlus },
  update_schedule_event: { label: "Խմբագրում է իրադարձություն", icon: CalendarCog },
  delete_schedule_event: { label: "Ջնջում է իրադարձություն", icon: CalendarX },
  list_opportunities: { label: "Փնտրում է հնարավորություններ", icon: Compass },
  join_opportunity: { label: "Գրանցում է հնարավորության", icon: UserPlus },
  ask_admin: { label: "Հարց է ուղարկում ադմինին", icon: MessageCircleQuestion },
  list_my_support_threads: { label: "Ստուգում է ադմինի պատասխանները", icon: MessageSquareText },
  list_quests: { label: "Ստուգում է քվեսթները", icon: Trophy },
  claim_quest: { label: "Հավաքագրում է քվեսթի XP-ն", icon: Award },
  submit_quest_evidence: { label: "Ուղարկում է ապացույց", icon: FileCheck },
  list_my_projects: { label: "Ստուգում է քո նախագծերը", icon: ListChecks },
  start_project: { label: "Սկսում է նոր նախագիծ", icon: Rocket },
  submit_project: { label: "Ուղարկում է նախագիծը ստուգման", icon: SendIcon },
  cancel_project: { label: "Չեղարկում է նախագիծը", icon: Ban },
  list_notifications: { label: "Ստուգում է ծանուցումները", icon: Bell },
  recommend_next_step: { label: "Մտածում է հաջորդ քայլի մասին", icon: Lightbulb },
};

const SUGGESTED_PROMPTS = [
  { text: "Կազմիր ինձ համար շաբաթվա պլան", icon: Calendar },
  { text: "Ի՞նչ նախագիծ սկսեմ իմ հետաքրքրություններով", icon: Rocket },
  { text: "Ցույց տուր իմ քվեսթների վիճակը", icon: Trophy },
  { text: "Կա՞ ինչ-որ բան, որ բաց եմ թողել", icon: Bell },
];

const CAPABILITY_HINTS = [
  { label: "Օրակարգ", icon: Calendar },
  { label: "Նախագծեր", icon: Rocket },
  { label: "Քվեստներ", icon: Trophy },
  { label: "Ադմինի կամուրջ", icon: MessageCircleQuestion },
];

type Props = {
  threadId: string;
  initialMessages: UIMessage[];
  onReset: () => void;
  /** Prefilled question deep-linked from another page (e.g. an opportunity card). */
  autoAsk?: string;
  onAutoAskSent?: () => void;
};

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
      <div className="flex justify-end mb-4">
        <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap break-words shadow-soft">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 sm:gap-3 mb-5">
      <img src={logo} alt="" className="w-8 h-8 rounded-full shrink-0 mt-0.5 shadow-soft" />
      <div className="flex-1 min-w-0 space-y-2">
        {toolParts.map((p: any, i) => <ToolBlock key={i} part={p} />)}
        {text && (
          <div className="rounded-2xl rounded-tl-md bg-card border border-border/70 shadow-soft px-4 py-3 text-sm text-foreground break-words">
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

export function AgentChat({ threadId, initialMessages, onReset, autoAsk, onAutoAskSent }: Props) {
  const [bearer, setBearer] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setBearer(data.session?.access_token || null));
  }, []);

  const transport = useMemo(() => makeChatTransport(bearer, threadId), [bearer, threadId]);
  const chatId = bearer ? threadId : `${threadId}:pending-auth`;

  const { messages, sendMessage, regenerate, clearError, status, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport: makeChatTransport(bearer, threadId),
    onError: (err) => {
      // Network-level failures (never reached the server) don't carry the
      // friendlier server-side message — normalize them here too.
      console.error("chat client error", err);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  // Auto-grow the composer up to ~6 lines instead of a fixed single row.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 152)}px`;
  }, [input]);

  // Deep-linked question from another page (e.g. "Հարցնել AI-ից" on an
  // opportunity card) — send once a transport exists, only into a fresh thread.
  useEffect(() => {
    if (!autoAsk || !transport || messages.length > 0) return;
    void sendMessage({ text: autoAsk }, { body: { threadId }, headers: { Authorization: `Bearer ${bearer}` } });
    onAutoAskSent?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAsk, transport]);

  const busy = status === "submitted" || status === "streaming";

  async function submit() {
    const text = input.trim();
    if (!text || !transport) return;
    setInput("");
    await sendMessage({ text }, { body: { threadId }, headers: { Authorization: `Bearer ${bearer}` } });
  }

  const friendlyError =
    error &&
    (error.message?.includes("An error occurred")
      ? "Ինչ-որ բան այն չգնաց։ Փորձիր կրկին։"
      : error.message || "Ինչ-որ բան այն չգնաց։");

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] max-w-3xl mx-auto w-full">
      {/* Branded header */}
      <div className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-border">
        <div className="relative shrink-0">
          <img src={logo} alt="" className="w-10 h-10 rounded-full shadow-soft" />
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-display text-sm font-semibold leading-tight">EYH Mentor</div>
          <div className="text-[11px] text-muted-foreground truncate">Քո անձնական AI մենթորը · միշտ առցանց</div>
        </div>
        <button
          onClick={onReset}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-2.5 rounded-lg hover:bg-secondary text-muted-foreground text-xs font-medium transition-colors"
          title="Մաքրել զրույցը"
        >
          <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden min-[420px]:inline">Նոր</span>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4">
        {messages.length === 0 && (
          <div className="text-center mt-6 sm:mt-10 animate-rise">
            <div className="relative inline-block mb-4">
              <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl scale-150" />
              <img src={logo} alt="" className="relative w-16 h-16 object-contain mx-auto animate-float" />
            </div>
            <div className="font-display text-xl mb-1.5">Բարև։ Ի՞նչ կօգնեմ այսօր։</div>
            <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto">
              Ես ճանաչում եմ քո պրոֆիլը, օրակարգը և քվեսթները, և կարող եմ իրականում գործել՝ ոչ միայն խորհուրդ տալ։
            </p>

            <div className="flex flex-wrap justify-center gap-1.5 mb-6">
              {CAPABILITY_HINTS.map((c) => (
                <span
                  key={c.label}
                  className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-secondary/70 text-muted-foreground"
                >
                  <c.icon className="w-3 h-3" /> {c.label}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p.text}
                  type="button"
                  disabled={!transport}
                  onClick={() => sendMessage({ text: p.text }, { body: { threadId }, headers: { Authorization: `Bearer ${bearer}` } })}
                  className="flex items-center gap-2.5 text-sm px-3.5 py-2.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-colors text-left disabled:opacity-50"
                >
                  <p.icon className="w-4 h-4 text-primary shrink-0" />
                  <span className="min-w-0">{p.text}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
        {status === "submitted" && (
          <div className="flex gap-2.5 sm:gap-3 mb-5">
            <img src={logo} alt="" className="w-8 h-8 rounded-full shrink-0 mt-0.5 shadow-soft opacity-70" />
            <div className="rounded-2xl rounded-tl-md bg-card border border-border/70 px-4 py-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
            </div>
          </div>
        )}
        {friendlyError && (
          <div className="flex items-start gap-2.5 rounded-xl bg-destructive/10 border border-destructive/25 px-3.5 py-3 text-sm text-destructive mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="break-words">{friendlyError}</div>
              <button
                onClick={() => {
                  clearError();
                  void regenerate();
                }}
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Կրկին փորձել
              </button>
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submit(); }}
        className="border-t border-border p-2.5 sm:p-3 flex gap-2 items-end bg-background"
      >
        <textarea
          ref={areaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          rows={1}
          placeholder="Գրիր հաղորդագրություն… (Enter՝ ուղարկելու, Shift+Enter՝ նոր տողի)"
          className="flex-1 resize-none rounded-2xl border border-border bg-secondary/40 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 max-h-[152px]"
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-hero text-primary-foreground disabled:opacity-40 hover:opacity-90 transition-opacity shadow-soft"
          aria-label="Ուղարկել"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}

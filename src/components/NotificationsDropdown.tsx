import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  Info,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Trash2,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/utils";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  read: boolean;
  created_at: string;
};

const KIND_META: Record<string, { icon: LucideIcon; cls: string }> = {
  success: { icon: CheckCircle2, cls: "text-success bg-success/10" },
  warning: { icon: AlertTriangle, cls: "text-amber-600 bg-amber-500/10" },
  ai: { icon: Sparkles, cls: "text-primary bg-primary/10" },
  info: { icon: Info, cls: "text-primary bg-primary/10" },
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "հենց հիմա";
  if (s < 3600) return `${Math.floor(s / 60)} ր առաջ`;
  if (s < 86400) return `${Math.floor(s / 3600)} ժ առաջ`;
  if (s < 604800) return `${Math.floor(s / 86400)} օր առաջ`;
  return new Date(iso).toLocaleDateString("hy-AM");
}

export function NotificationsDropdown() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setLoadError(false);
    supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setLoadError(true);
        else setItems((data as Notif[]) || []);
        setLoading(false);
      });

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setItems((prev) => [payload.new as Notif, ...prev].slice(0, 30));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setItems((prev) =>
            prev.map((n) => (n.id === (payload.new as Notif).id ? (payload.new as Notif) : n)),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setItems((prev) => prev.filter((n) => n.id !== (payload.old as Notif).id));
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function markAllRead() {
    if (!user || unread === 0) return;
    const previous = items;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    if (error) {
      setItems(previous);
      toast.error(getErrorMessage(error, "Ծանուցումները չհաջողվեց թարմացնել։"));
    }
  }

  async function clearOne(id: string) {
    const previous = items;
    setItems((prev) => prev.filter((n) => n.id !== id));
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) {
      setItems(previous);
      toast.error(getErrorMessage(error, "Ծանուցումը չհաջողվեց ջնջել։"));
    }
  }

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Ծանուցումներ"
        aria-expanded={open}
        aria-controls="notifications-panel"
        className="relative p-2.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold grid place-items-center ring-2 ring-background">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notifications-panel"
          role="dialog"
          aria-label="Ծանուցումներ"
          className="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[92vw] sm:max-w-sm bg-card border border-border rounded-2xl shadow-elegant overflow-hidden z-50 animate-fade-in"
        >
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 sm:px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2 min-w-0">
              <Bell className="w-4 h-4 text-primary" />
              <span className="font-semibold text-sm break-words">Ծանուցումներ</span>
              {unread > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {unread} նոր
                </span>
              )}
            </div>
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              className="inline-flex min-h-11 max-w-[120px] items-center gap-1 text-right text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40 sm:max-w-none sm:text-xs"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Նշել բոլորը որպես կարդացած
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="py-10 grid place-items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : loadError ? (
              <div className="px-6 py-10 text-center" role="alert">
                <AlertTriangle className="w-7 h-7 text-destructive mx-auto mb-2" />
                <p className="text-sm font-medium">Ծանուցումները չբեռնվեցին</p>
                <p className="text-xs text-muted-foreground mt-1">Փորձիր կրկին մի փոքր ուշ։</p>
              </div>
            ) : items.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Bell className="w-7 h-7 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium">Ամեն ինչ կարդացված է</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Նոր ակտիվությունը կհայտնվի այստեղ՝ իրական ժամանակում։
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((n) => {
                  const meta = KIND_META[n.kind] || KIND_META.info;
                  const Icon = meta.icon;
                  return (
                    <li
                      key={n.id}
                      className={`group flex gap-3 px-4 py-3 transition-colors ${n.read ? "" : "bg-primary/[0.03]"}`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${meta.cls}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={`text-sm leading-snug ${n.read ? "font-medium" : "font-semibold"}`}
                          >
                            {n.title}
                          </p>
                          {!n.read && (
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          )}
                        </div>
                        {n.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                            {n.body}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            {timeAgo(n.created_at)}
                          </span>
                          <button
                            onClick={() => clearOne(n.id)}
                            aria-label={`Ջնջել «${n.title}» ծանուցումը`}
                            className="inline-flex min-h-11 items-center gap-1 text-[10px] text-muted-foreground opacity-100 transition-opacity hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                          >
                            <Trash2 className="w-3 h-3" /> Ջնջել
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="flex min-h-11 items-center justify-center border-t border-border py-3 text-center text-xs font-medium text-primary hover:bg-primary/5"
          >
            Տեսնել բոլոր ծանուցումները
          </Link>
        </div>
      )}
    </div>
  );
}

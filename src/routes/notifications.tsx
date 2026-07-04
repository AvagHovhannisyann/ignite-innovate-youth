import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Navbar } from "@/components/Navbar";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/notifications")({ component: NotificationsPage });

function NotificationsPage() {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (loading || !user) return;
    (async () => {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      setItems(data || []);
      setBusy(false);
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
    })();
  }, [user, loading]);

  if (loading || busy)
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-dvh bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-2xl mx-auto px-3 min-[380px]:px-4 sm:px-6 py-7 sm:py-10 pb-32 md:pb-10">
        <div className="flex items-center gap-2 mb-5 sm:mb-6 min-w-0">
          <Bell className="w-6 h-6 text-primary shrink-0" />
          <h1 className="font-display text-2xl font-bold leading-tight break-words">
            Ծանուցումներ
          </h1>
        </div>
        {items.length === 0 ? (
          <div className="text-center py-14 px-4 card-base rounded-2xl overflow-hidden animate-rise">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary mb-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="font-display text-base font-semibold mb-1">Ամեն ինչ կարդացված է։</h3>
            <p className="text-muted-foreground text-sm">Նոր ծանուցումները կհայտնվեն այստեղ։</p>
          </div>
        ) : (
          <div className="space-y-2.5 min-w-0">
            {items.map((n) => (
              <div key={n.id} className="card-base rounded-xl p-4 overflow-hidden min-w-0">
                <div className="flex flex-col min-[420px]:flex-row min-[420px]:items-start justify-between gap-2 min-w-0">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm flex items-start gap-2 min-w-0">
                      <span className="break-words min-w-0">{n.title}</span>
                      {n.read && (
                        <CheckCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                    </div>
                    {n.body && (
                      <div className="text-sm text-muted-foreground mt-1 break-words">{n.body}</div>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0 break-words">
                    {new Date(n.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

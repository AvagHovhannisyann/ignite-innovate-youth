import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Sparkles, Newspaper, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type Tab = {
  to: string;
  label: string;
  icon: typeof Home;
  /** Elevated center "action" tab (Instagram-style create button). */
  primary?: boolean;
};

const TABS: Tab[] = [
  { to: "/dashboard", label: "Տուն", icon: Home },
  { to: "/opportunities", label: "Որոնել", icon: Search },
  { to: "/agent", label: "AI", icon: Sparkles, primary: true },
  { to: "/feed", label: "Ֆիդ", icon: Newspaper },
  { to: "/profile", label: "Էջ", icon: User },
];

// Full-screen flows where the tab bar would be in the way.
const HIDDEN_PREFIXES = ["/auth", "/onboarding", "/reset-password"];

export function MobileTabBar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false)
      .then(({ count }) => setHasUnread(!!count));
  }, [user, path]);

  if (!user) return null;
  if (HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return null;

  const isActive = (to: string) =>
    path === to || (to !== "/dashboard" && path.startsWith(to + "/"));

  return (
    <nav
      aria-label="Հիմնական նավիգացիա"
      className="mobile-tab-bar md:hidden fixed bottom-0 inset-x-0 z-50 pointer-events-none"
      style={{ paddingBottom: "max(14px, env(safe-area-inset-bottom))" }}
    >
      <div className="mobile-tab-shell mx-auto w-full max-w-[calc(100vw-24px)] px-0 pb-1 pointer-events-auto">
        <ul className="relative grid grid-cols-5 items-end gap-0 rounded-[28px] bg-background/92 backdrop-blur-2xl border border-border/60 shadow-[0_16px_44px_-14px_rgba(0,0,0,0.32)] px-1.5 py-2 overflow-visible">
          {TABS.map(({ to, label, icon: Icon, primary }) => {
            const active = isActive(to);

            if (primary) {
              return (
                <li key={to} className="flex justify-center">
                  <Link
                    to={to}
                    data-tour={`nav-${to.slice(1)}`}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    className="group relative -mt-7 grid place-items-center w-[54px] h-[54px] min-w-[44px] min-h-[44px] rounded-full active:scale-95 transition-transform duration-200"
                  >
                    {/* soft glow ring behind the FAB */}
                    <span className="absolute inset-0 rounded-full bg-primary/35 blur-lg scale-110 group-active:scale-100 transition-transform" />
                    <span
                      className={`absolute inset-0 rounded-full bg-gradient-hero shadow-elegant ${
                        active ? "ring-4 ring-primary/20" : ""
                      }`}
                    />
                    <Icon className="relative w-6 h-6 text-primary-foreground" strokeWidth={2.4} />
                    <span className="sr-only">{label}</span>
                  </Link>
                </li>
              );
            }

            return (
              <li key={to}>
                <Link
                  to={to}
                  data-tour={`nav-${to.slice(1)}`}
                  aria-current={active ? "page" : undefined}
                  className="group relative flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[48px] px-0 py-1"
                >
                  {hasUnread && to === "/dashboard" && (
                    <span className="absolute top-0.5 right-[calc(50%-16px)] w-2 h-2 rounded-full bg-destructive ring-2 ring-background" />
                  )}
                  <span
                    className={`grid place-items-center w-11 h-8 rounded-2xl transition-all duration-300 ease-out ${
                      active ? "bg-primary/12" : "bg-transparent group-active:bg-secondary"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                      strokeWidth={active ? 2.6 : 2}
                    />
                  </span>
                  <span
                    className={`text-[10px] leading-none tracking-normal text-center transition-colors ${
                      active ? "text-primary font-semibold" : "text-muted-foreground font-medium"
                    }`}
                  >
                    {label}
                  </span>
                  <span
                    className={`absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary transition-opacity ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

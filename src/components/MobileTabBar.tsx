import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Search, Sparkles, Newspaper, User } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

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
      <div className="mobile-tab-shell mx-auto w-full max-w-[calc(100vw-20px)] px-0 pb-1 pointer-events-auto">
        <ul className="relative grid grid-cols-5 items-end gap-0 rounded-[24px] bg-background/94 backdrop-blur-xl border border-border/70 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.25)] px-1 py-1.5 overflow-visible">
          {TABS.map(({ to, label, icon: Icon, primary }) => {
            const active = isActive(to);

            if (primary) {
              return (
                <li key={to} className="flex justify-center">
                  <Link
                    to={to}
                    aria-label={label}
                    aria-current={active ? "page" : undefined}
                    className="relative -mt-3 grid place-items-center w-[46px] h-[46px] min-w-[44px] min-h-[44px] rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant active:scale-95 transition-transform duration-200"
                  >
                    <Icon className="w-6 h-6" strokeWidth={2.4} />
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
                    className={`group flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[48px] rounded-2xl px-0 py-1.5 transition-colors ${
                    active ? "text-primary" : "text-muted-foreground active:text-foreground"
                  }`}
                >
                  <span
                    className={`grid place-items-center w-9 h-8 rounded-xl transition-all duration-300 ease-out ${
                      active ? "bg-primary/12 scale-110" : "bg-transparent scale-100"
                    }`}
                  >
                    <Icon
                      className="w-5 h-5"
                      strokeWidth={active ? 2.6 : 2}
                    />
                  </span>
                  <span className="mobile-tab-label text-[9px] min-[360px]:text-[10px] leading-none font-medium tracking-normal max-w-full text-center break-words min-h-[18px] grid place-items-center">
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

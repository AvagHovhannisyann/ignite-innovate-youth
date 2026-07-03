import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { MobileTabBar } from "@/components/MobileTabBar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandCenter, CommandCenterTrigger } from "@/components/CommandCenter";
import {
  LayoutDashboard, Calendar, Compass, Trophy, Newspaper, Users,
  Sparkles, MessageCircleQuestion, Shield, ChevronLeft, ChevronRight,
  LogOut, HelpCircle, Bell, Menu, X, MonitorDown,
} from "lucide-react";
import logo from "@/assets/logo.png";
import { usePwaInstall } from "@/hooks/use-pwa";
import { hasSeenTour, startTour } from "@/lib/tour";

type NavItem = { to: string; label: string; icon: any; adminOnly?: boolean };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Վահանակ", icon: LayoutDashboard },
  { to: "/schedule", label: "Օրակարգ", icon: Calendar },
  { to: "/opportunities", label: "Հնարավորություններ", icon: Compass },
  { to: "/quests", label: "Քվեստներ", icon: Trophy },
  { to: "/feed", label: "Ֆիդ", icon: Newspaper },
  { to: "/community", label: "Համայնք", icon: Users },
  { to: "/agent", label: "AI Օգնական", icon: Sparkles },
  { to: "/support", label: "Աջակցություն", icon: MessageCircleQuestion },
  { to: "/admin", label: "Ադմին", icon: Shield, adminOnly: true },
];

function PageTitle() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const match = NAV.find((n) => path.startsWith(n.to));
  // `overflow-wrap: break-word` is set on <body> (styles.css) as an app-wide
  // safety net so long Armenian words never overflow normal page content —
  // but it's an *inherited* property, so it reaches this title regardless of
  // element type. Combined with `truncate`'s `white-space: nowrap`, browsers
  // force a wrap to avoid overflow instead of ellipsizing on one line. This
  // header bar has fixed height and must never wrap, so reassert `normal`
  // inline (wins over the inherited value regardless of cascade layers).
  return (
    <div
      role="heading"
      aria-level={1}
      className="text-base sm:text-lg font-semibold text-foreground truncate"
      style={{ overflowWrap: "normal" }}
    >
      {match?.label || ""}
    </div>
  );
}

// Routes that should always render full-bleed (no app shell) even when signed in.
const BARE_PREFIXES = ["/auth", "/onboarding", "/reset-password"];
const BARE_EXACT = new Set(["/"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname }) ?? "/";
  const normalizedPath = path.replace(/\/+$/, "") || "/";
  const isBare =
    normalizedPath === "/" ||
    BARE_EXACT.has(normalizedPath) ||
    BARE_PREFIXES.some((p) => normalizedPath === p || normalizedPath.startsWith(p + "/"));

  const [isAdmin, setIsAdmin] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { canInstall, install } = usePwaInstall();

  // First-visit guided tour: once, on the dashboard, after the shell paints.
  useEffect(() => {
    if (!user || isBare || hasSeenTour() || normalizedPath !== "/dashboard") return;
    const t = setTimeout(startTour, 1200);
    return () => clearTimeout(t);
  }, [user, isBare, normalizedPath]);

  useEffect(() => {
    if (!user || isBare) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setIsAdmin(!!data?.some((r) => r.role === "admin"));
    });
  }, [user, isBare]);

  useEffect(() => { setMobileOpen(false); }, [path]);

  // unauthenticated, or on a full-bleed route: bare layout, no shell
  if (!user || isBare) return <>{children}</>;

  const items = NAV.filter((n) => !n.adminOnly || isAdmin);
  const isActive = (to: string) => path === to || (to !== "/dashboard" && path.startsWith(to));

  const SidebarBody = ({ inDrawer = false }: { inDrawer?: boolean }) => (
    <>
      <div className={`flex items-center gap-2 px-4 h-16 border-b border-border ${collapsed && !inDrawer ? "justify-center px-2" : ""}`}>
        <Link to="/dashboard" className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="" className="w-9 h-9 object-contain shrink-0" />
          {(!collapsed || inDrawer) && (
            <span className="font-display font-bold text-sm leading-tight truncate">
              <span className="block">Էջմիածնի</span>
              <span className="block text-gradient">Երիտ. Տուն</span>
            </span>
          )}
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {items.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            data-tour={`nav-${n.to.slice(1)}`}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive(n.to)
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            } ${collapsed && !inDrawer ? "justify-center" : ""}`}
            title={collapsed ? n.label : undefined}
          >
            <n.icon className="w-5 h-5 shrink-0" />
            {(!collapsed || inDrawer) && <span className="truncate">{n.label}</span>}
          </Link>
        ))}
      </nav>
      <div className="border-t border-border p-2">
        <button
          onClick={async () => { await supabase.auth.signOut(); nav({ to: "/" }); }}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors ${collapsed && !inDrawer ? "justify-center" : ""}`}
          title="Դուրս գալ"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {(!collapsed || inDrawer) && <span>Դուրս գալ</span>}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-soft">
      {/* Desktop sidebar (fixed so it never scrolls with content) */}
      <aside
        className={`hidden md:flex flex-col bg-background border-r border-border fixed inset-y-0 left-0 z-30 transition-[width] duration-200 ${collapsed ? "w-[72px]" : "w-64"}`}
      >
        <SidebarBody />
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-background border border-border grid place-items-center shadow-sm hover:bg-secondary"
          aria-label={collapsed ? "Բացել" : "Փակել"}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 z-50 w-72 bg-background flex flex-col md:hidden animate-slide-in-left">
            <SidebarBody inDrawer />
          </aside>
        </>
      )}

      <div className={`flex flex-col min-w-0 transition-[padding] duration-200 ${collapsed ? "md:pl-[72px]" : "md:pl-64"}`}>
        <header className="sticky top-0 z-30 h-14 sm:h-16 bg-background/85 backdrop-blur-md border-b border-border flex items-center gap-2 px-3 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-secondary"
            aria-label="Բացել մենյուն"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0"><PageTitle /></div>
          {canInstall && (
            <button
              type="button"
              data-tour="install-app"
              onClick={() => void install()}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/15 transition-colors"
            >
              <MonitorDown className="w-3.5 h-3.5" /> Տեղադրել
            </button>
          )}
          <span data-tour="command-center" className="inline-flex"><CommandCenterTrigger /></span>
          <ThemeToggle />
          <Link to="/support" className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-secondary" aria-label="Օգնություն">
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
          </Link>
          <NotificationsDropdown />
          <Link
            to="/profile"
            aria-label="Իմ էջը"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-gradient-hero text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            {(user.email || "U").slice(0, 1).toUpperCase()}
          </Link>
        </header>

        <main className="flex-1 min-w-0">{children}</main>

        <MobileTabBar />
      </div>
      <CommandCenter />
    </div>
  );
}

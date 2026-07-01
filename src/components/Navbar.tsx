import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Menu, X, LogOut, Bell, Users, GraduationCap, Flame, Shield } from "lucide-react";
import logo from "@/assets/logo.png";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { MobileTabBar } from "@/components/MobileTabBar";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Navbar() {
  const { user } = useAuth();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      setIsAdmin(!!data?.some((r) => r.role === "admin"));
    });
  }, [user]);

  useEffect(() => { setOpen(false); }, [path]);

  const isActive = (to: string) => path === to;
  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(to) ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
    >
      {label}
    </Link>
  );
  const mobileLink = (to: string, label: string, Icon?: any) => (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-4 rounded-2xl text-base font-medium transition-colors min-h-[56px] min-w-0 ${isActive(to) ? "text-primary bg-primary/10" : "text-foreground hover:bg-secondary"}`}
    >
      {Icon && <Icon className="w-5 h-5 shrink-0" />}
      <span>{label}</span>
    </Link>
  );

  // AppShell handles chrome for authenticated users; Navbar only renders for guests.
  if (user) return null;

  return (
    <>
    <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80 border-b border-border">
      <div className="max-w-7xl mx-auto px-3 min-[380px]:px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-3">
        <Link to="/" className="flex items-center gap-2 font-bold tracking-tight min-w-0">
          <img src={logo} alt="Էջմիածնի Երիտասարդական Տուն" className="w-8 h-8 sm:w-9 sm:h-9 object-contain shrink-0" />
          <span className="text-foreground text-sm sm:text-base hidden min-[360px]:inline min-w-0 max-w-[128px] min-[430px]:max-w-[180px] sm:max-w-none overflow-hidden text-ellipsis" style={{ whiteSpace: "nowrap" }}>
            <span className="hidden sm:inline">Էջմիածնի </span>
            <span className="text-gradient" style={{ whiteSpace: "nowrap" }}>
              Երիտասարդական Տուն
            </span>
          </span>
        </Link>

        <nav className="desktop-nav hidden md:flex items-center gap-1">
          {user && navLink("/dashboard", "Վահանակ")}
          {user && navLink("/quests", "Քվեստներ")}
          {navLink("/opportunities", "Հնարավորություններ")}
          {user && navLink("/trending", "Թրենդային")}
          {user && navLink("/masterclasses", "Մաստեր-դասեր")}
          {user && navLink("/community", "Համայնք")}
          {user && navLink("/agent", "AI")}
          {isAdmin && navLink("/admin", "Ադմին")}
        </nav>


        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <ThemeToggle />
          <Link to="/auth" className="hidden sm:inline-flex text-sm px-3 py-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground">Մուտք</Link>
          <Link to="/auth" search={{ mode: "signup" }} className="text-sm px-3 sm:px-4 py-2.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 font-medium shadow-soft min-h-[44px] inline-flex items-center">Միանալ</Link>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Փակել մենյուն" : "Բացել մենյուն"}
            aria-expanded={open}
            className="mobile-menu-button md:hidden p-3 rounded-xl hover:bg-secondary text-foreground min-w-[44px] min-h-[44px] grid place-items-center"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background/98 backdrop-blur-md animate-fade-in">
          <nav className="max-w-7xl mx-auto px-3 min-[380px]:px-4 py-3 flex flex-col gap-1">
            {mobileLink("/opportunities", "Հնարավորություններ")}
            {mobileLink("/auth", "Մուտք")}
          </nav>
        </div>
      )}
    </header>
    </>
  );
}

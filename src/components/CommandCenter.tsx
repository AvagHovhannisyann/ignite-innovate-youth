import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { applyTheme } from "@/components/ThemeToggle";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Calendar,
  Compass,
  Trophy,
  Newspaper,
  Users,
  Sparkles,
  MessageCircleQuestion,
  User,
  Rocket,
  Plus,
  Sun,
  Moon,
  Monitor,
  LogOut,
  Search,
} from "lucide-react";

const PAGES = [
  { to: "/dashboard", label: "Վահանակ", icon: LayoutDashboard },
  { to: "/schedule", label: "Օրակարգ", icon: Calendar },
  { to: "/opportunities", label: "Հնարավորություններ", icon: Compass },
  { to: "/quests", label: "Քվեստներ", icon: Trophy },
  { to: "/feed", label: "Ֆիդ", icon: Newspaper },
  { to: "/community", label: "Համայնք", icon: Users },
  { to: "/agent", label: "AI Օգնական", icon: Sparkles },
  { to: "/support", label: "Աջակցություն", icon: MessageCircleQuestion },
  { to: "/profile", label: "Իմ էջը", icon: User },
];

type DynamicItem = { id: string; title: string; to: string; params?: Record<string, string> };

/**
 * Global ⌘K command palette: fuzzy search over pages, the student's projects
 * and open opportunities, plus quick actions (theme, sign out).
 */
export function CommandCenter() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<DynamicItem[]>([]);
  const [opps, setOpps] = useState<DynamicItem[]>([]);
  const { user } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Load searchable data lazily, on first open.
  useEffect(() => {
    if (!open || !user || projects.length || opps.length) return;
    (async () => {
      const [{ data: sp }, { data: op }] = await Promise.all([
        supabase.from("started_projects").select("id,title").eq("user_id", user.id).limit(20),
        supabase.from("opportunities").select("id,title").limit(20),
      ]);
      setProjects(
        (sp || []).map((p) => ({
          id: p.id,
          title: p.title,
          to: "/projects/$id",
          params: { id: p.id },
        })),
      );
      setOpps((op || []).map((o) => ({ id: o.id, title: o.title, to: "/opportunities" })));
    })();
  }, [open, user, projects.length, opps.length]);

  const run = useCallback((fn: () => void) => {
    setOpen(false);
    fn();
  }, []);

  if (!user) return null;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Փնտրիր էջ, նախագիծ, գործողություն…" />
      <CommandList>
        <CommandEmpty>Ոչինչ չգտնվեց։</CommandEmpty>
        <CommandGroup heading="Էջեր">
          {PAGES.map((p) => (
            <CommandItem
              key={p.to}
              value={`${p.label} ${p.to}`}
              onSelect={() => run(() => nav({ to: p.to }))}
            >
              <p.icon /> {p.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Գործողություններ">
          <CommandItem
            value="Նոր իրադարձություն օրակարգ add event"
            onSelect={() => run(() => nav({ to: "/schedule" }))}
          >
            <Plus /> Նոր իրադարձություն օրակարգում
          </CommandItem>
          <CommandItem
            value="Հարցրու AI օգնականին ask ai"
            onSelect={() => run(() => nav({ to: "/agent" }))}
          >
            <Sparkles /> Հարցրու AI օգնականին
          </CommandItem>
          <CommandItem
            value="Լուսավոր թեմա light theme"
            onSelect={() => run(() => applyTheme("light"))}
          >
            <Sun /> Լուսավոր թեմա
          </CommandItem>
          <CommandItem value="Մուգ թեմա dark theme" onSelect={() => run(() => applyTheme("dark"))}>
            <Moon /> Մուգ թեմա
          </CommandItem>
          <CommandItem
            value="Համակարգի թեմա system theme"
            onSelect={() => run(() => applyTheme("system"))}
          >
            <Monitor /> Համակարգի թեմա
          </CommandItem>
          <CommandItem
            value="Դուրս գալ sign out logout"
            onSelect={() =>
              run(async () => {
                await supabase.auth.signOut();
                nav({ to: "/" });
              })
            }
          >
            <LogOut /> Դուրս գալ
          </CommandItem>
        </CommandGroup>
        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Քո նախագծերը">
              {projects.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`նախագիծ ${p.title}`}
                  onSelect={() => run(() => nav({ to: p.to, params: p.params }))}
                >
                  <Rocket /> {p.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {opps.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Հնարավորություններ">
              {opps.map((o) => (
                <CommandItem
                  key={o.id}
                  value={`հնարավորություն ${o.title}`}
                  onSelect={() => run(() => nav({ to: o.to }))}
                >
                  <Compass /> {o.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

/** Header search button that opens the palette (dispatches the same shortcut). */
export function CommandCenterTrigger() {
  return (
    <button
      type="button"
      onClick={() =>
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
      }
      className="hidden sm:inline-flex items-center gap-2 h-9 pl-3 pr-2 rounded-full border border-border bg-secondary/50 hover:bg-secondary text-sm text-muted-foreground transition-colors"
      aria-label="Որոնում (⌘K)"
    >
      <Search className="w-4 h-4" />
      <span className="text-xs">Որոնել…</span>
      <kbd className="ml-1 rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">
        ⌘K
      </kbd>
    </button>
  );
}

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { applyTheme, readTheme, THEME_CHANGE_EVENT, type Theme } from "@/lib/theme";

const ORDER: Theme[] = ["light", "dark", "system"];
const META: Record<Theme, { icon: typeof Sun; label: string }> = {
  light: { icon: Sun, label: "Լուսավոր թեմա" },
  dark: { icon: Moon, label: "Մուգ թեմա" },
  system: { icon: Monitor, label: "Համակարգի թեմա" },
};

/** Cycles light → dark → system; follows OS changes while in system mode. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme(readTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readTheme() === "system") applyTheme("system");
    };
    const onThemeChange = (event: Event) => {
      setTheme((event as CustomEvent<Theme>).detail);
    };
    mq.addEventListener("change", onChange);
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => {
      mq.removeEventListener("change", onChange);
      window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
    };
  }, []);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const { icon: Icon, label } = META[theme];

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(next);
      }}
      aria-label={`${label} — սեղմիր փոխելու համար`}
      title={label}
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className}`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

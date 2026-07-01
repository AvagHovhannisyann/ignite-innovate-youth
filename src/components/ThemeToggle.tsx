import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

function readTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const t = localStorage.getItem("theme");
  return t === "light" || t === "dark" ? t : "system";
}

export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  if (theme === "system") localStorage.removeItem("theme");
  else localStorage.setItem("theme", theme);
}

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
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const { icon: Icon, label } = META[theme];

  return (
    <button
      type="button"
      onClick={() => {
        setTheme(next);
        applyTheme(next);
      }}
      aria-label={`${label} — սեղմիր փոխելու համար`}
      title={label}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors ${className}`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}

import { useEffect } from "react";
import { toast } from "sonner";
import { levelFromXP } from "@/lib/constants";
import { burstConfetti } from "@/lib/confetti";

const KEY_PREFIX = "eyh-last-level:";

/** Celebrates crossing into a new level once, comparing against the last seen level per user. */
export function useLevelUpCelebration(userId: string | undefined, xp: number | undefined) {
  useEffect(() => {
    if (!userId || xp == null) return;
    const key = KEY_PREFIX + userId;
    const level = levelFromXP(xp);
    let last: number | null = null;
    try {
      const raw = localStorage.getItem(key);
      last = raw ? Number(raw) : null;
    } catch {
      /* private mode */
    }
    if (last !== null && level.level > last) {
      burstConfetti(window.innerWidth / 2, window.innerHeight * 0.3, 48);
      toast.success(`Նոր մակարդակ․ ${level.level} — ${level.name} 🎉`, {
        description: "Շարունակիր այդպես՝ ավելի շատ XP, ավելի շատ հնարավորություններ։",
        duration: 6000,
      });
    }
    try {
      localStorage.setItem(key, String(level.level));
    } catch {
      /* private mode */
    }
  }, [userId, xp]);
}

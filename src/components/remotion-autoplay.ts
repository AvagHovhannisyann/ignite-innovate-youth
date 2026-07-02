import { useEffect, useRef } from "react";
import type { PlayerRef } from "@remotion/player";

/**
 * Keeps an autoplaying Remotion Player actually playing. Even with
 * `initiallyMuted`, browsers can defer the initial play() (backgrounded tab,
 * throttled rAF, lazy chunk arriving late) — this retries until playback is
 * confirmed and resumes when the tab becomes visible again.
 */
export function useAutoplayGuard(active: boolean) {
  const playerRef = useRef<PlayerRef>(null);

  useEffect(() => {
    if (!active) return;
    let attempts = 0;

    const watchdog = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      if (player.isPlaying() || attempts >= 8) {
        window.clearInterval(watchdog);
        return;
      }
      attempts += 1;
      player.play();
    }, 500);

    const onVisible = () => {
      if (document.visibilityState === "visible") playerRef.current?.play();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(watchdog);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [active]);

  return playerRef;
}

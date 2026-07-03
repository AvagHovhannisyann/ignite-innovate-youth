import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    listeners.forEach((l) => l());
  });
  // Register the service worker in production builds only — the dev server
  // serves modules the SW cache rules would fight with.
  if (import.meta.env.PROD && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          const notify = (worker: ServiceWorker) => {
            toast("Հասանելի է հավելվածի նոր տարբերակ", {
              duration: Infinity,
              action: {
                label: "Թարմացնել",
                onClick: () => worker.postMessage({ type: "SKIP_WAITING" }),
              },
            });
          };
          // An update was already waiting when this tab opened.
          if (reg.waiting && reg.active) notify(reg.waiting);
          // A new update arrived while this tab is open.
          reg.addEventListener("updatefound", () => {
            const fresh = reg.installing;
            if (!fresh) return;
            fresh.addEventListener("statechange", () => {
              if (fresh.state === "installed" && reg.active) notify(fresh);
            });
          });
          // Re-check on return to the tab — PWAs can stay open for days.
          const recheck = () => reg.update().catch(() => {});
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") recheck();
          });
          window.addEventListener("focus", recheck);
        })
        .catch(() => {});

      // Reload once the user-approved update actually takes control.
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    });
  }
}

/** Whether the app can be installed right now, and a prompt trigger. */
export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(() => !!deferredPrompt);

  useEffect(() => {
    const update = () => setCanInstall(!!deferredPrompt);
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") deferredPrompt = null;
    listeners.forEach((l) => l());
    return outcome === "accepted";
  }, []);

  return { canInstall, install };
}

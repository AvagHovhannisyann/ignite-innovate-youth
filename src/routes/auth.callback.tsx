import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { applyAuthSessionFromUrl, getPostAuthDestination, waitForVerifiedUser } from "@/lib/auth-flow";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  component: CallbackPage,
});

function CallbackPage() {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function go() {
      try {
        await applyAuthSessionFromUrl();
        const user = await waitForVerifiedUser();
        if (cancelled) return;
        if (!user) throw new Error("We couldn't complete sign-in. Please try again.");
        const destination = await getPostAuthDestination(user);
        if (!cancelled) nav({ to: destination, replace: true });
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Sign-in failed. Please try again.");
          setTimeout(() => nav({ to: "/auth", search: { mode: "signin" }, replace: true }), 1800);
        }
      }
    }
    go();
    return () => { cancelled = true; };
  }, [nav]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-soft">
      <div className="text-center">
        <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-hero items-center justify-center text-primary-foreground shadow-elegant mb-4 animate-pulse">
          <Sparkles className="w-6 h-6" />
        </div>
        <p className="text-muted-foreground">{error ?? "Signing you in..."}</p>
      </div>
    </div>
  );
}

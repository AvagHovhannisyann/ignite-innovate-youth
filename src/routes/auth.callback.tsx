import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  applyAuthSessionFromUrl,
  getPostAuthDestination,
  waitForVerifiedUser,
} from "@/lib/auth-flow";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Մուտք — Էջմիածնի Երիտասարդական Տուն" },
      { name: "description", content: "Ավարտում ենք անվտանգ մուտքը ձեր հաշիվ։" },
    ],
  }),
  component: CallbackPage,
});

function CallbackPage() {
  const nav = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let redirectTimer: number | undefined;

    async function go() {
      try {
        await applyAuthSessionFromUrl();
        const user = await waitForVerifiedUser();
        if (cancelled) return;
        if (!user) throw new Error("Մուտքը չհաջողվեց ավարտել։");
        const destination = await getPostAuthDestination(user);
        if (!cancelled) nav({ to: destination, replace: true });
      } catch {
        if (!cancelled) {
          setError("Մուտքը չհաջողվեց։ Խնդրում ենք նորից փորձել։");
          redirectTimer = window.setTimeout(
            () => nav({ to: "/auth", search: { mode: "signin" }, replace: true }),
            1800,
          );
        }
      }
    }

    go();
    return () => {
      cancelled = true;
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
    };
  }, [nav]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-soft px-4 py-12">
      <section
        className="w-full max-w-sm rounded-[2rem] border border-border bg-gradient-card p-8 text-center shadow-elegant"
        role={error ? "alert" : "status"}
        aria-live="polite"
      >
        <div className="mb-5 inline-flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant">
          <Sparkles className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-bold text-foreground">
          {error ? "Մուտքը չհաջողվեց" : "Ավարտում ենք մուտքը"}
        </h1>
        <p
          className={`mt-2 text-sm leading-6 ${error ? "text-destructive" : "text-muted-foreground"}`}
        >
          {error ?? "Մի պահ սպասիր․ պատրաստում ենք քո անձնական էջը…"}
        </p>
      </section>
    </main>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Նոր գաղտնաբառ — Էջմիածնի Երիտասարդական Տուն" },
      { name: "description", content: "Սահմանեք ձեր հաշվի նոր գաղտնաբառը։" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash and emits a PASSWORD_RECOVERY event
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });
    // Also check existing session
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!done) return;
    const timer = window.setTimeout(() => nav({ to: "/dashboard" }), 1200);
    return () => window.clearTimeout(timer);
  }, [done, nav]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Գաղտնաբառը պետք է պարունակի առնվազն 6 նիշ։");
      return;
    }
    if (password !== confirm) {
      setError("Գաղտնաբառերը չեն համընկնում։");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("Չհաջողվեց թարմացնել գաղտնաբառը։ Խնդրում ենք նորից փորձել։");
      return;
    }
    setDone(true);
  }

  return (
    <div className="min-h-dvh bg-gradient-soft">
      <Navbar />
      <main className="mx-auto max-w-md px-4 py-12 sm:py-16">
        <header className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-elegant">
            <KeyRound className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold">Սահմանիր նոր գաղտնաբառ</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Ընտրիր անվտանգ գաղտնաբառ, որը նախկինում չես օգտագործել։
          </p>
        </header>

        {!ready ? (
          <section
            className="rounded-2xl border border-border bg-card p-6 text-center text-sm leading-6 text-muted-foreground shadow-soft"
            aria-live="polite"
          >
            <Loader2
              className="mx-auto mb-3 h-5 w-5 animate-spin text-primary"
              aria-hidden="true"
            />
            Սպասում ենք վերականգնման հղմանը։ Եթե այս էջը բացել ես ուղիղ, օգտագործիր էլ․ փոստով
            ստացած հղումը։
            <div className="mt-4">
              <Link
                to="/auth"
                search={{ mode: "forgot" }}
                className="inline-flex min-h-11 items-center px-2 font-semibold text-primary underline-offset-4 hover:underline"
              >
                Ստանալ նոր հղում
              </Link>
            </div>
          </section>
        ) : done ? (
          <section
            className="rounded-2xl border border-border bg-card p-6 text-center shadow-soft"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="mx-auto mb-3 h-7 w-7 text-success" aria-hidden="true" />
            <p className="font-medium text-foreground">
              Գաղտնաբառը թարմացվեց։ Տեղափոխում ենք անձնական էջ…
            </p>
          </section>
        ) : (
          <form
            onSubmit={submit}
            className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-soft"
          >
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium">
                Նոր գաղտնաբառ
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                  aria-describedby="password-requirements"
                  aria-invalid={Boolean(error)}
                  className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 pr-12 outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((value) => !value)}
                  aria-label={showPw ? "Թաքցնել գաղտնաբառը" : "Ցույց տալ գաղտնաբառը"}
                  aria-pressed={showPw}
                  className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPw ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <p id="password-requirements" className="mt-1.5 text-xs text-muted-foreground">
                Առնվազն 6 նիշ
              </p>
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium">
                Կրկնիր գաղտնաբառը
              </label>
              <input
                id="confirm-password"
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                aria-invalid={Boolean(error)}
                className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && (
              <div
                className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
                role="alert"
              >
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-hero px-4 py-2.5 font-semibold text-primary-foreground shadow-soft transition-base hover:shadow-glow disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? "Թարմացվում է…" : "Թարմացնել գաղտնաբառը"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

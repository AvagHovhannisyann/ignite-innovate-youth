import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { getAuthCallbackUrl, getPostAuthDestination, waitForVerifiedUser } from "@/lib/auth-flow";
import { Navbar } from "@/components/Navbar";
import { Sparkles, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";

type Mode = "signin" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } => ({
    mode: (s.mode === "signup" || s.mode === "forgot" ? s.mode : "signin") as Mode,
  }),
});

function friendlyError(msg?: string | null): string {
  if (!msg) return "Ինչ-որ բան սխալ գնաց։ Փորձիր կրկին։";
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid_credentials"))
    return "Սխալ էլ. հասցե կամ գաղտնաբառ։ Փորձիր կրկին կամ վերականգնիր գաղտնաբառը։";
  if (m.includes("already registered") || m.includes("user already") || m.includes("already exists"))
    return "Այս էլ. հասցեով հաշիվ արդեն գոյություն ունի։ Խնդրում ենք մուտք գործել։";
  if (m.includes("email not confirmed"))
    return "Խնդրում ենք հաստատել էլ. հասցեն մինչ մուտք գործելը։";
  if (m.includes("password") && m.includes("6"))
    return "Գաղտնաբառը պետք է լինի առնվազն 6 նիշ։";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Չափազանց շատ փորձեր։ Սպասիր մեկ րոպե և փորձիր կրկին։";
  if (m.includes("network") || m.includes("fetch"))
    return "Ցանցի խնդիր։ Ստուգիր կապը և փորձիր կրկին։";
  if (m.includes("validation") || m.includes("invalid email"))
    return "Մուտքագրիր ճիշտ էլ. հասցե։";
  return msg;
}

function AuthPage() {
  const { mode: initialMode = "signin" } = Route.useSearch();
  const nav = useNavigate();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (cancelled || error || !data.user) return;
      const destination = await getPostAuthDestination(data.user);
      if (!cancelled) nav({ to: destination, replace: true });
    });
    return () => { cancelled = true; };
  }, [nav]);

  function switchMode(m: Mode) {
    setMode(m); setError(null); setInfo(null);
  }

  async function routeAfterAuth() {
    const user = await waitForVerifiedUser();
    if (!user) throw new Error("Չհաջողվեց հաստատել մուտքը։ Փորձիր կրկին։");
    const destination = await getPostAuthDestination(user);
    nav({ to: destination, replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("Մուտքագրիր ճիշտ էլ. հասցե։"); return;
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        if (!fullName.trim()) { setError("Մուտքագրիր անունդ և ազգանունդ։"); setLoading(false); return; }
        if (password.length < 6) { setError("Գաղտնաբառը պետք է լինի առնվազն 6 նիշ։"); setLoading(false); return; }

        const { data, error } = await supabase.auth.signUp({
          email: trimmedEmail, password,
          options: {
            emailRedirectTo: getAuthCallbackUrl(),
            data: { full_name: fullName.trim() },
          },
        });
        if (error) {
          const friendly = friendlyError(error.message);
          setError(friendly);
          if (friendly.toLowerCase().includes("գոյություն ունի")) {
            setMode("signin");
          }
          return;
        }
        if (data.session) {
          await routeAfterAuth();
        } else {
          setInfo("Հաշիվը ստեղծված է։ Ստուգիր էլ. հասցեդ՝ հաստատելու համար, ապա մուտք գործիր։");
          setMode("signin");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail, password,
        });
        if (error) { setError(friendlyError(error.message)); return; }
        await routeAfterAuth();
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) { setError(friendlyError(error.message)); return; }
        setInfo("Եթե այս էլ. հասցեով հաշիվ գոյություն ունի, վերականգնման հղումն ուղարկված է։");
      }
    } catch (err: any) {
      setError(friendlyError(err?.message));
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn() {
    setError(null); setInfo(null); setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: getAuthCallbackUrl(),
        extraParams: { prompt: "select_account" },
      });
      if (result.error) { setError(friendlyError(result.error.message)); setLoading(false); return; }
      if (result.redirected) return;
      await routeAfterAuth();
    } catch (err: any) {
      setError(friendlyError(err?.message));
      setLoading(false);
    }
  }

  const isForgot = mode === "forgot";
  const isSignup = mode === "signup";

  return (
    <div className="min-h-screen bg-gradient-soft overflow-x-hidden">
      <Navbar />
      <div className="max-w-md mx-auto px-3 min-[380px]:px-4 py-8 sm:py-12 pb-28 md:pb-12">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-hero items-center justify-center text-primary-foreground shadow-elegant mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl min-[380px]:text-3xl font-bold leading-tight break-words">
            {isForgot ? "Վերականգնիր գաղտնաբառը" : isSignup ? "Միացիր Երիտասարդական Տանը" : "Բարի վերադարձ"}
          </h1>
          <p className="text-muted-foreground text-sm mt-2 break-words">
            {isForgot ? "Մենք կուղարկենք անվտանգ վերականգնման հղում։"
              : isSignup ? "Ստեղծիր հաշիվդ՝ բացահայտելու սկսելու համար։"
              : "Մուտք գործիր քո վահանակ։"}
          </p>
        </div>

        {!isForgot && (
          <>
            <button
              type="button"
              onClick={googleSignIn}
              disabled={loading}
              className="w-full mb-4 px-3 py-2.5 rounded-lg border border-border bg-background hover:bg-muted font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50 min-h-[44px] break-words"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Շարունակել Google-ով
            </button>
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-gradient-soft px-2 text-muted-foreground text-center break-words">կամ {isSignup ? "գրանցվիր" : "մուտք գործիր"} էլ. հասցեով</span>
              </div>
            </div>
          </>
        )}

        <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-4 min-[380px]:p-6 shadow-soft space-y-4 overflow-hidden min-w-0">
          {isSignup && (
            <div>
              <label className="block text-sm font-medium mb-1.5">Անուն Ազգանուն</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required autoComplete="name"
                className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1.5">Էլ. հասցե</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required autoComplete="email"
              className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {!isForgot && (
            <div>
              <div className="flex flex-col min-[380px]:flex-row min-[380px]:items-center min-[380px]:justify-between gap-1 mb-1.5">
                <label className="block text-sm font-medium">Գաղտնաբառ</label>
                {!isSignup && (
                  <button type="button" onClick={() => switchMode("forgot")} className="text-xs text-primary hover:underline text-left min-w-0 break-words">
                    Մոռացե՞լ ես գաղտնաբառը
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required minLength={6}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Թաքցնել գաղտնաբառը" : "Ցույց տալ գաղտնաբառը"}
                  className="absolute right-1 top-1/2 -translate-y-1/2 grid place-items-center min-w-[44px] min-h-[44px] text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {isSignup && (
                <p className="text-xs text-muted-foreground mt-1.5">Առնվազն 6 նիշ։</p>
              )}
            </div>
          )}

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-2.5 rounded-lg break-words">{error}</div>
          )}
          {info && (
            <div className="text-sm text-foreground bg-primary/10 p-2.5 rounded-lg flex gap-2 items-start">
              <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary shrink-0" />
              <span className="break-words min-w-0">{info}</span>
            </div>
          )}

          <button
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-lg bg-gradient-hero text-primary-foreground font-semibold shadow-soft hover:shadow-glow disabled:opacity-50 transition-all flex items-center justify-center gap-2 min-h-[44px] break-words"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Խնդրում ենք սպասել․․․" : isForgot ? "Ուղարկել վերականգնման հղում" : isSignup ? "Ստեղծել հաշիվ" : "Մուտք"}
          </button>
        </form>

        <div className="text-center text-sm text-muted-foreground mt-6 space-y-2">
          {isForgot ? (
            <p>
              Հիշեցի՞ր։{" "}
              <button onClick={() => switchMode("signin")} className="text-primary font-medium hover:underline">
                Վերադառնալ մուտքի էջ
              </button>
            </p>
          ) : isSignup ? (
            <p>
              Արդեն անդա՞մ ես։{" "}
              <button onClick={() => switchMode("signin")} className="text-primary font-medium hover:underline">
                Մուտք
              </button>
            </p>
          ) : (
            <p>
              Նո՞ր ես այստեղ։{" "}
              <button onClick={() => switchMode("signup")} className="text-primary font-medium hover:underline">
                Ստեղծել հաշիվ
              </button>
            </p>
          )}
          <p className="text-xs">
            <Link to="/" className="inline-flex items-center justify-center min-h-[44px] px-3 hover:text-foreground">
              ← Տուն վերադառնալ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

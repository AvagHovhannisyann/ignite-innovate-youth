import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Sparkles, Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also check existing session
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setDone(true);
    setTimeout(() => nav({ to: "/dashboard" }), 1200);
  }

  return (
    <div className="min-h-dvh bg-gradient-soft">
      <Navbar />
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-hero items-center justify-center text-primary-foreground shadow-elegant mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-bold">Set a new password</h1>
        </div>

        {!ready ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
            Waiting for your reset link... If you opened this page directly, please use the link from your email.
            <div className="mt-4">
              <Link to="/auth" search={{ mode: "forgot" }} className="text-primary hover:underline">Request a new link</Link>
            </div>
          </div>
        ) : done ? (
          <div className="bg-card border border-border rounded-2xl p-6 text-center">
            <p className="text-foreground font-medium">Password updated. Redirecting...</p>
          </div>
        ) : (
          <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 shadow-soft space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">New password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required minLength={6}
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Confirm password</label>
              <input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required minLength={6}
                className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && <div className="text-sm text-destructive bg-destructive/10 p-2.5 rounded-lg">{error}</div>}
            <button disabled={loading} className="w-full py-2.5 rounded-lg bg-gradient-hero text-primary-foreground font-semibold shadow-soft hover:shadow-glow disabled:opacity-50 transition-all flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Update password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

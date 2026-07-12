import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { AuthContext, type AuthState } from "@/hooks/use-auth";

/**
 * Owns the single Supabase auth subscription for the entire application.
 *
 * Previously every call to `useAuth()` opened another subscription and issued
 * another `getSession()` request. The shell and a typical route could mount
 * five copies at once. Keeping the state at the root makes auth transitions
 * atomic and gives every consumer the same snapshot.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let authEventSeen = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      authEventSeen = true;
      setSession(nextSession);
      setLoading(false);
    });

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted || authEventSeen) return;
        setSession(data.session);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setIsAdmin(false);
      return;
    }

    // Never carry an elevated UI state across an account switch while the
    // new user's role query is in flight.
    setIsAdmin(false);
    let mounted = true;
    void supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (!mounted) return;
        setIsAdmin(!error && !!data?.some(({ role }) => role === "admin"));
      });

    return () => {
      mounted = false;
    };
  }, [session?.user.id]);

  const value = useMemo<AuthState>(
    () => ({ session, user: session?.user ?? null, isAdmin, loading }),
    [session, isAdmin, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

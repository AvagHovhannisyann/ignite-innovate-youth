import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthDestination = "/dashboard" | "/onboarding";

export function getAuthCallbackUrl() {
  return `${window.location.origin}/auth/callback`;
}

function getUrlAuthParams() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const search = new URLSearchParams(window.location.search);
  const get = (key: string) => hash.get(key) ?? search.get(key);

  return {
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    code: get("code"),
    error: get("error"),
    errorDescription: get("error_description"),
  };
}

export async function applyAuthSessionFromUrl() {
  const params = getUrlAuthParams();

  if (params.error) {
    throw new Error(params.errorDescription || params.error);
  }

  if (params.accessToken && params.refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (error) throw error;
  } else if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error) throw error;
  }

  if (window.location.hash || window.location.search) {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

export async function waitForVerifiedUser(maxAttempts = 30): Promise<User | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return data.user;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return null;
}

export async function ensureStudentProfile(user: User) {
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("id,onboarded")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing;

  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    "";

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        email: user.email ?? null,
        onboarded: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id,onboarded")
    .single();

  if (createError) throw createError;
  return created;
}

export async function getPostAuthDestination(user: User): Promise<AuthDestination> {
  const profile = await ensureStudentProfile(user);
  return profile.onboarded ? "/dashboard" : "/onboarding";
}
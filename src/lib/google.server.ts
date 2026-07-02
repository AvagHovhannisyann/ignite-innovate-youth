// Google Calendar OAuth helpers (server only). The whole integration is
// feature-flagged: without GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in the
// environment, /api/google/status reports unconfigured and the UI hides it.

import { createHmac, timingSafeEqual } from "node:crypto";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function googleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  return { clientId, clientSecret, configured: !!(clientId && clientSecret) };
}

function stateSecret() {
  // Reuse an existing secret so no new env var is needed for signing.
  return (
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "dev-state-secret"
  );
}

/** OAuth `state`: userId.expiresMs.hmac — proves the callback belongs to us. */
export function signState(userId: string, ttlMs = 10 * 60 * 1000) {
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${exp}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyState(state: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 3) return null;
  const [userId, expStr, sig] = parts;
  if (Number(expStr) < Date.now()) return null;
  const expected = createHmac("sha256", stateSecret())
    .update(`${userId}.${expStr}`)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

/** Resolve the signed-in user from a `Bearer <supabase jwt>` header. */
export async function userFromAuthHeader(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !data.user) return null;
  return data.user.id;
}

// Google Calendar OAuth helpers (server only). The whole integration is
// feature-flagged: without GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET in the
// environment, /api/google/status reports unconfigured and the UI hides it.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.events";
export const GOOGLE_OAUTH_COOKIE = "eyh_google_oauth";

export function googleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  return { clientId, clientSecret, configured: !!(clientId && clientSecret) };
}

function stateSecret() {
  // Reuse an existing secret so no new env var is needed for signing.
  return (
    process.env.GOOGLE_CLIENT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-state-secret"
  );
}

export function createOAuthNonce() {
  return randomBytes(24).toString("hex");
}

/** OAuth `state`: userId.expiresMs.nonce.hmac. The matching nonce is stored
 * in an HttpOnly cookie so a copied consent URL cannot link another browser's
 * Google account to the initiating EYH account. */
export function signState(userId: string, nonce: string, ttlMs = 10 * 60 * 1000) {
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${exp}.${nonce}`;
  const sig = createHmac("sha256", stateSecret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

export function verifyState(state: string, expectedNonce: string): string | null {
  const parts = state.split(".");
  if (parts.length !== 4 || !expectedNonce) return null;
  const [userId, expStr, nonce, sig] = parts;
  const expiresAt = Number(expStr);
  if (
    !/^[0-9a-f-]{36}$/i.test(userId) ||
    !Number.isFinite(expiresAt) ||
    expiresAt < Date.now() ||
    expiresAt > Date.now() + 11 * 60 * 1000 ||
    !/^[0-9a-f]{48}$/i.test(nonce) ||
    !/^[0-9a-f]{64}$/i.test(sig)
  ) {
    return null;
  }
  const nonceA = Buffer.from(nonce);
  const nonceB = Buffer.from(expectedNonce);
  if (nonceA.length !== nonceB.length || !timingSafeEqual(nonceA, nonceB)) return null;
  const expected = createHmac("sha256", stateSecret())
    .update(`${userId}.${expStr}.${nonce}`)
    .digest("hex");
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export function readCookie(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) {
      try {
        return decodeURIComponent(value.join("="));
      } catch {
        return "";
      }
    }
  }
  return "";
}

export function googleOAuthCookie(nonce: string, secure: boolean) {
  return `${GOOGLE_OAUTH_COOKIE}=${encodeURIComponent(nonce)}; Path=/api/google/callback; HttpOnly; SameSite=Lax; Max-Age=600${secure ? "; Secure" : ""}`;
}

export function clearGoogleOAuthCookie(secure: boolean) {
  return `${GOOGLE_OAUTH_COOKIE}=; Path=/api/google/callback; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
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

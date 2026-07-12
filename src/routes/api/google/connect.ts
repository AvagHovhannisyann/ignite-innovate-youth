import { createFileRoute } from "@tanstack/react-router";

// POST with a Supabase Bearer token → returns the Google consent URL.
// (POST + JSON so the auth token travels in a header, never a URL.)
export const Route = createFileRoute("/api/google/connect")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          createOAuthNonce,
          googleEnv,
          googleOAuthCookie,
          signState,
          userFromAuthHeader,
          GOOGLE_SCOPE,
        } = await import("@/lib/google.server");
        const { configured, clientId } = googleEnv();
        const json = (body: object, init: ResponseInit = {}) => {
          const headers = new Headers(init.headers);
          headers.set("Cache-Control", "no-store, max-age=0");
          return Response.json(body, { ...init, headers });
        };
        if (!configured) {
          return json({ error: "not configured" }, { status: 503 });
        }
        const userId = await userFromAuthHeader(request);
        if (!userId) return json({ error: "unauthorized" }, { status: 401 });

        const origin = new URL(request.url).origin;
        const nonce = createOAuthNonce();
        const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
        url.searchParams.set("client_id", clientId);
        url.searchParams.set("redirect_uri", `${origin}/api/google/callback`);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("scope", GOOGLE_SCOPE);
        url.searchParams.set("access_type", "offline");
        url.searchParams.set("prompt", "consent");
        url.searchParams.set("state", signState(userId, nonce));
        return json(
          { url: url.toString() },
          {
            headers: {
              "Set-Cookie": googleOAuthCookie(nonce, origin.startsWith("https://")),
            },
          },
        );
      },
    },
  },
});

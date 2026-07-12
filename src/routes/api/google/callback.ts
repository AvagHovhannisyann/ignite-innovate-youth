import { createFileRoute } from "@tanstack/react-router";

// Google redirects here after consent; we exchange the code and store the
// tokens in user_integrations, then bounce back to the calendar.
export const Route = createFileRoute("/api/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { clearGoogleOAuthCookie, googleEnv, readCookie, verifyState, GOOGLE_OAUTH_COOKIE } =
          await import("@/lib/google.server");
        const { configured, clientId, clientSecret } = googleEnv();
        const reqUrl = new URL(request.url);
        const secure = reqUrl.protocol === "https:";
        const back = (q: string) =>
          new Response(null, {
            status: 302,
            headers: {
              Location: `${reqUrl.origin}/schedule?google=${q}`,
              "Cache-Control": "no-store, max-age=0",
              "Set-Cookie": clearGoogleOAuthCookie(secure),
            },
          });

        if (!configured) return back("unconfigured");
        const code = reqUrl.searchParams.get("code");
        const state = reqUrl.searchParams.get("state") || "";
        const userId = verifyState(state, readCookie(request, GOOGLE_OAUTH_COOKIE));
        if (!code || !userId) return back("error");

        try {
          const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: `${reqUrl.origin}/api/google/callback`,
              grant_type: "authorization_code",
            }),
            signal: AbortSignal.timeout(15_000),
          });
          if (!tokenRes.ok) return back("error");
          const tok = (await tokenRes.json()) as {
            access_token?: string;
            refresh_token?: string;
            expires_in?: number;
          };
          if (!tok.access_token) return back("error");

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.rpc("store_google_integration", {
            _user_id: userId,
            _access_token: tok.access_token,
            _refresh_token: tok.refresh_token ?? null,
            _expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
            _calendar_id: "primary",
          });
          if (error) return back("error");
          return back("connected");
        } catch (error: unknown) {
          console.error("Google OAuth callback failed", error);
          return back("error");
        }
      },
    },
  },
});

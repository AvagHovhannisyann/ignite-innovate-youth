import { createFileRoute } from "@tanstack/react-router";

// Google redirects here after consent; we exchange the code and store the
// tokens in user_integrations, then bounce back to the calendar.
export const Route = createFileRoute("/api/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { googleEnv, verifyState } = await import("@/lib/google.server");
        const { configured, clientId, clientSecret } = googleEnv();
        const reqUrl = new URL(request.url);
        const back = (q: string) =>
          new Response(null, {
            status: 302,
            headers: { Location: `${reqUrl.origin}/schedule?google=${q}` },
          });

        if (!configured) return back("unconfigured");
        const code = reqUrl.searchParams.get("code");
        const state = reqUrl.searchParams.get("state") || "";
        const userId = verifyState(state);
        if (!code || !userId) return back("error");

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
        });
        if (!tokenRes.ok) return back("error");
        const tok = (await tokenRes.json()) as {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
        };
        if (!tok.access_token) return back("error");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("user_integrations").upsert(
          {
            user_id: userId,
            provider: "google",
            access_token: tok.access_token,
            refresh_token: tok.refresh_token ?? null,
            expires_at: new Date(Date.now() + (tok.expires_in ?? 3600) * 1000).toISOString(),
            calendar_id: "primary",
            status: "connected",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,provider" },
        );
        if (error) return back("error");
        return back("connected");
      },
    },
  },
});

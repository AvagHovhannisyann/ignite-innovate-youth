import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/google/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { googleEnv, userFromAuthHeader } = await import("@/lib/google.server");
        const { configured } = googleEnv();
        let connected = false;
        if (configured) {
          const userId = await userFromAuthHeader(request);
          if (userId) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const { data } = await supabaseAdmin
              .from("user_integrations")
              .select("status")
              .eq("user_id", userId)
              .eq("provider", "google")
              .maybeSingle();
            connected = data?.status === "connected";
          }
        }
        return Response.json({ configured, connected });
      },
    },
  },
});

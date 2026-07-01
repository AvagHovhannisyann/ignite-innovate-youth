import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/ics/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = (params as any).token || "";
        const token = raw.replace(/\.ics$/i, "");
        if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("invalid", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("profiles").select("id,full_name").eq("ics_token", token).maybeSingle();
        if (!profile) return new Response("not found", { status: 404 });

        const { data: events } = await supabaseAdmin
          .from("schedule_events").select("*").eq("user_id", profile.id).order("starts_at");

        function fmt(d: string) {
          return new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        }
        function esc(s: string) { return (s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n"); }

        const lines = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Ejmiatsin Youth House//Schedule//EN",
          `X-WR-CALNAME:${esc(profile.full_name || "My Schedule")}`,
        ];
        for (const e of events || []) {
          lines.push("BEGIN:VEVENT",
            `UID:${e.id}@eyh`,
            `DTSTAMP:${fmt(e.created_at || new Date().toISOString())}`,
            `DTSTART:${fmt(e.starts_at)}`,
            `DTEND:${fmt(e.ends_at)}`,
            `SUMMARY:${esc(e.title)}`);
          if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
          if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
          lines.push("END:VEVENT");
        }
        lines.push("END:VCALENDAR");

        return new Response(lines.join("\r\n"), {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

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

        function fmtUtc(d: string) {
          return new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        }
        function fmtDate(d: string) {
          return new Date(d).toISOString().slice(0, 10).replace(/-/g, "");
        }
        function esc(s: string) {
          return (s || "").replace(/([,;\\])/g, "\\$1").replace(/\r?\n/g, "\\n");
        }
        // RFC 5545 §3.1: lines longer than 75 octets must be folded with
        // CRLF + space. Fold on UTF-8 byte length so Armenian text stays valid.
        const enc = new TextEncoder();
        function fold(line: string) {
          if (enc.encode(line).length <= 75) return line;
          const out: string[] = [];
          let cur = "";
          for (const ch of line) {
            if (enc.encode(cur + ch).length > (out.length ? 74 : 75)) {
              out.push(cur);
              cur = ch;
            } else {
              cur += ch;
            }
          }
          out.push(cur);
          return out.map((l, i) => (i ? " " + l : l)).join("\r\n");
        }

        const lines = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Ejmiatsin Youth House//Schedule//EN",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          `X-WR-CALNAME:${esc(profile.full_name || "My Schedule")}`,
          "X-WR-TIMEZONE:Asia/Yerevan",
          "X-PUBLISHED-TTL:PT30M",
          "REFRESH-INTERVAL;VALUE=DURATION:PT30M",
        ];
        for (const e of events || []) {
          lines.push("BEGIN:VEVENT",
            `UID:${e.id}@eyh`,
            `DTSTAMP:${fmtUtc(e.updated_at || e.created_at || new Date().toISOString())}`);
          if (e.all_day) {
            lines.push(
              `DTSTART;VALUE=DATE:${fmtDate(e.starts_at)}`,
              `DTEND;VALUE=DATE:${fmtDate(e.ends_at)}`,
            );
          } else {
            lines.push(`DTSTART:${fmtUtc(e.starts_at)}`, `DTEND:${fmtUtc(e.ends_at)}`);
          }
          lines.push(`SUMMARY:${esc(e.title)}`);
          if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
          if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
          // Column arrives with the calendar migration; absent until then.
          const remind = Number((e as Record<string, unknown>).reminder_minutes);
          if (Number.isFinite(remind) && remind > 0) {
            lines.push(
              "BEGIN:VALARM",
              "ACTION:DISPLAY",
              `DESCRIPTION:${esc(e.title)}`,
              `TRIGGER:-PT${Math.round(remind)}M`,
              "END:VALARM",
            );
          }
          lines.push("END:VEVENT");
        }
        lines.push("END:VCALENDAR");

        return new Response(lines.map(fold).join("\r\n") + "\r\n", {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});

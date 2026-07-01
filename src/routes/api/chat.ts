import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { STUDENT_AGENT_SYSTEM } from "@/lib/agent-prompts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-thread-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const apiKey = process.env.LOVABLE_API_KEY;
          if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500, headers: corsHeaders });
          const auth = request.headers.get("authorization") || "";
          const token = auth.replace(/^Bearer\s+/i, "");
          if (!token) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } },
          );
          const { data: userData, error: userErr } = await supabase.auth.getUser(token);
          if (userErr || !userData.user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
          const userId = userData.user.id;

          const { messages, threadId }: { messages: UIMessage[]; threadId?: string } = await request.json();

          // Build a tiny context snapshot the model sees in the system prompt.
          const [{ data: profile }, { data: projects }, { data: quests }, { data: schedule }] = await Promise.all([
            supabase.from("profiles").select("full_name,email,xp,interests,bio").eq("id", userId).maybeSingle(),
            supabase.from("started_projects").select("id,title,status,difficulty_tier").eq("user_id", userId).in("status", ["active", "submitted"]).limit(10),
            supabase.from("user_quests").select("template_id,progress,awarded").eq("user_id", userId).limit(20),
            supabase.from("schedule_events").select("id,title,starts_at,ends_at,kind").eq("user_id", userId).gte("ends_at", new Date().toISOString()).order("starts_at").limit(20),
          ]);
          const contextSummary = `\n\nՈՒՍԱՆՈՂԻ ՀԱՄԱՏԵՔՍՏ՝\nՊրոֆիլ: ${JSON.stringify(profile || {})}\nԱկտիվ նախագծեր: ${JSON.stringify(projects || [])}\nՔվեսթներ: ${JSON.stringify(quests || [])}\nՕրակարգ (առաջիկա): ${JSON.stringify(schedule || [])}`;

          const gateway = createLovableAiGatewayProvider(apiKey);
          const model = gateway("google/gemini-3-flash-preview");

          const tools = {
            get_profile: tool({
              description: "Բերում է ուսանողի պրոֆիլը՝ XP, հետաքրքրություններ, bio։",
              inputSchema: z.object({}),
              execute: async () => {
                const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
                return data || {};
              },
            }),
            list_schedule: tool({
              description: "Բերում է առաջիկա օրակարգային իրադարձությունները։",
              inputSchema: z.object({ days_ahead: z.number().int().min(1).max(60).default(14) }),
              execute: async ({ days_ahead }) => {
                const until = new Date(Date.now() + days_ahead * 86400000).toISOString();
                const { data } = await supabase.from("schedule_events").select("*").eq("user_id", userId).lte("starts_at", until).gte("ends_at", new Date().toISOString()).order("starts_at");
                return data || [];
              },
            }),
            add_schedule_event: tool({
              description: "Ավելացնում է նոր օրակարգային իրադարձություն ուսանողի օրացույցում։",
              inputSchema: z.object({
                title: z.string().min(1).max(200),
                description: z.string().max(2000).optional(),
                starts_at: z.string().describe("ISO 8601 datetime"),
                ends_at: z.string().describe("ISO 8601 datetime"),
                kind: z.enum(["study", "project", "meeting", "quest", "other"]).default("other"),
                location: z.string().max(200).optional(),
              }),
              execute: async (input) => {
                const { data, error } = await supabase.from("schedule_events").insert({
                  user_id: userId,
                  title: input.title,
                  description: input.description,
                  starts_at: input.starts_at,
                  ends_at: input.ends_at,
                  kind: input.kind,
                  location: input.location,
                  source: "ai",
                }).select().single();
                if (error) return { ok: false, error: error.message };
                return { ok: true, event: data };
              },
            }),
            delete_schedule_event: tool({
              description: "Ջնջում է օրակարգային իրադարձություն ID-ով։",
              inputSchema: z.object({ id: z.string().uuid() }),
              execute: async ({ id }) => {
                const { error } = await supabase.from("schedule_events").delete().eq("id", id).eq("user_id", userId);
                return error ? { ok: false, error: error.message } : { ok: true };
              },
            }),
            list_opportunities: tool({
              description: "Բերում է հասանելի հնարավորությունների ցանկը։",
              inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(8) }),
              execute: async ({ limit }) => {
                const { data } = await supabase.from("opportunities").select("id,title,category,description,difficulty").limit(limit);
                return data || [];
              },
            }),
            ask_admin: tool({
              description: "Ուղարկում է հարց ադմինին ուսանողի անունից։ Օգտագործիր երբ ուսանողն ունի հարց, որի պատասխանը պետք է ադմինից։",
              inputSchema: z.object({
                subject: z.string().min(3).max(140),
                question: z.string().min(5).max(2000),
                urgency: z.enum(["low", "normal", "high"]).default("normal"),
              }),
              execute: async ({ subject, question, urgency }) => {
                const { data: thread, error: e1 } = await supabase
                  .from("support_threads")
                  .insert({ user_id: userId, subject: `[AI] ${subject}`, status: "open", origin: "ai_relay" })
                  .select()
                  .single();
                if (e1) return { ok: false, error: e1.message };
                const { error: e2 } = await supabase.from("support_messages").insert({
                  thread_id: thread.id,
                  sender_id: userId,
                  sender_role: "user",
                  content: `[AI agent on student's behalf, urgency: ${urgency}]\n\n${question}`,
                });
                if (e2) return { ok: false, error: e2.message };
                return { ok: true, thread_id: thread.id, message: "Հարցն ուղարկվել է ադմինին։ Պատասխանը կհայտնվի «Աջակցություն» բաժնում։" };
              },
            }),
            list_quests: tool({
              description: "Բերում է ուսանողի քվեսթների կարգավիճակը։",
              inputSchema: z.object({}),
              execute: async () => {
                const [{ data: templates }, { data: progress }, { data: subs }] = await Promise.all([
                  supabase.from("quest_templates").select("*").eq("active", true),
                  supabase.from("user_quests").select("*").eq("user_id", userId),
                  supabase.from("quest_submissions").select("template_id,status,period_key").eq("user_id", userId),
                ]);
                return { templates: templates || [], progress: progress || [], submissions: subs || [] };
              },
            }),
            recommend_next_step: tool({
              description: "Վերլուծում է ուսանողի համատեքստը և առաջարկում հաջորդ լավագույն քայլը։",
              inputSchema: z.object({}),
              execute: async () => ({
                hint: "Use this output internally; respond to the student conversationally with a specific recommendation.",
                ts: new Date().toISOString(),
              }),
            }),
          };

          const result = streamText({
            model,
            system: STUDENT_AGENT_SYSTEM + contextSummary,
            messages: await convertToModelMessages(messages),
            tools,
            stopWhen: stepCountIs(20),
            onFinish: async ({ response }) => {
              // Persist last user msg + assistant msg into agent_messages
              try {
                if (!threadId) return;
                const userMsg = messages[messages.length - 1];
                if (userMsg?.role === "user") {
                  await supabase.from("agent_messages").insert({
                    thread_id: threadId,
                    role: "user",
                    parts: userMsg.parts as any,
                    ai_message_id: userMsg.id,
                  });
                }
                for (const m of response.messages) {
                  await supabase.from("agent_messages").insert({
                    thread_id: threadId,
                    role: m.role,
                    parts: (m as any).content as any,
                  });
                }
                await supabase.from("agent_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
              } catch (e) {
                console.error("agent persist failed", e);
              }
            },
          });

          return result.toUIMessageStreamResponse({ headers: corsHeaders });
        } catch (e: any) {
          console.error("chat route error", e);
          return new Response(JSON.stringify({ error: e?.message || "agent failure" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  safeValidateUIMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createOpenRouterProvider, pickHealthyModel } from "@/lib/ai-gateway.server";
import { STUDENT_AGENT_SYSTEM } from "@/lib/agent-prompts";
import type { Json } from "@/integrations/supabase/types";

const chatBodySchema = z.object({
  messages: z.array(z.unknown()).min(1).max(100),
  threadId: z.string().uuid(),
});

function asJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

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
          const openRouterKey = process.env.OPENROUTER_API_KEY;
          if (!openRouterKey)
            return new Response("Missing OPENROUTER_API_KEY", {
              status: 500,
              headers: corsHeaders,
            });
          const approvalSecret =
            process.env.TOOL_APPROVAL_SECRET ||
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            openRouterKey;
          const auth = request.headers.get("authorization") || "";
          const token = auth.replace(/^Bearer\s+/i, "");
          if (!token) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_PUBLISHABLE_KEY!,
            {
              auth: { persistSession: false, autoRefreshToken: false },
              global: { headers: { Authorization: `Bearer ${token}` } },
            },
          );
          const { data: userData, error: userErr } = await supabase.auth.getUser(token);
          if (userErr || !userData.user)
            return new Response("Unauthorized", { status: 401, headers: corsHeaders });
          const userId = userData.user.id;

          const rawBody = await request.text();
          if (new TextEncoder().encode(rawBody).byteLength > 256_000) {
            return new Response("Request too large", { status: 413, headers: corsHeaders });
          }
          let decodedBody: unknown;
          try {
            decodedBody = JSON.parse(rawBody);
          } catch {
            return new Response("Invalid JSON", { status: 400, headers: corsHeaders });
          }
          const body = chatBodySchema.safeParse(decodedBody);
          if (!body.success) {
            return new Response("Invalid request", { status: 400, headers: corsHeaders });
          }
          const validatedMessages = await safeValidateUIMessages<UIMessage>({
            messages: body.data.messages,
          });
          if (!validatedMessages.success) {
            return new Response("Invalid messages", { status: 400, headers: corsHeaders });
          }
          const messages = validatedMessages.data;
          const { threadId } = body.data;

          const { data: ownedThread, error: threadError } = await supabase
            .from("agent_threads")
            .select("id")
            .eq("id", threadId)
            .eq("user_id", userId)
            .maybeSingle();
          if (threadError || !ownedThread) {
            return new Response("Forbidden", { status: 403, headers: corsHeaders });
          }

          const { data: quota, error: quotaError } = await supabase.rpc("consume_chat_quota");
          if (quotaError) {
            console.error("chat quota error", quotaError);
            return new Response("Rate limiter unavailable", { status: 503, headers: corsHeaders });
          }
          const quotaState = quota as Record<string, unknown> | null;
          if (quotaState?.ok === false) {
            return new Response("Rate limit exceeded", {
              status: 429,
              headers: { ...corsHeaders, "Retry-After": "3600" },
            });
          }

          // Free-tier models get overloaded unpredictably — probe for a healthy
          // one now, in parallel with the context queries below, so a single
          // down model doesn't stall (or corrupt) the reply.
          const modelIdPromise = pickHealthyModel(openRouterKey, process.env.OPENROUTER_MODEL);

          // Build a tiny context snapshot the model sees in the system prompt.
          const [
            { data: profile },
            { data: projects },
            { data: quests },
            { data: schedule },
            { data: supportThreads },
            { count: unreadCount },
          ] = await Promise.all([
            supabase
              .from("profiles")
              .select("full_name,xp,interests,skills,bio,goal,preferred_project_type,availability")
              .eq("id", userId)
              .maybeSingle(),
            supabase
              .from("started_projects")
              .select("id,title,status,difficulty_tier")
              .eq("user_id", userId)
              .in("status", ["active", "submitted"])
              .limit(10),
            supabase
              .from("user_quests")
              .select("template_id,progress,awarded")
              .eq("user_id", userId)
              .limit(20),
            supabase
              .from("schedule_events")
              .select("id,title,starts_at,ends_at,kind")
              .eq("user_id", userId)
              .gte("ends_at", new Date().toISOString())
              .order("starts_at")
              .limit(20),
            // Recent AI-relayed questions to admins, so the agent can proactively
            // relay the admin's answer back to the student in conversation instead
            // of just leaving it in a notification the student may not open.
            // support_threads has no `origin` column — the "[AI] " subject
            // prefix (set by ask_admin below) is the real discriminator.
            supabase
              .from("support_threads")
              .select("id,subject,status,last_message_at")
              .eq("user_id", userId)
              .ilike("subject", "[AI]%")
              .order("last_message_at", { ascending: false })
              .limit(5),
            supabase
              .from("notifications")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("read", false),
          ]);

          // Pull the admin's latest reply (if any) for each pending/answered relay thread.
          let relayDetail = "";
          if (supportThreads && supportThreads.length) {
            const threadIds = supportThreads.map((t) => t.id);
            const { data: adminReplies } = await supabase
              .from("support_messages")
              .select("thread_id,content,created_at")
              .in("thread_id", threadIds)
              .eq("sender_role", "admin")
              .order("created_at", { ascending: false });
            relayDetail = supportThreads
              .map((t) => {
                const reply = adminReplies?.find((m) => m.thread_id === t.id);
                return `- [${t.id}] "${t.subject}" (${t.status})${reply ? ` → ադմինի պատասխան. "${reply.content}"` : " → դեռ չպատասխանված"}`;
              })
              .join("\n");
          }

          const contextSummary = `\n\nՈՒՍԱՆՈՂԻ ՀԱՄԱՏԵՔՍՏ՝\nՊրոֆիլ: ${JSON.stringify(profile || {})}\nԱկտիվ նախագծեր: ${JSON.stringify(projects || [])}\nՔվեսթներ: ${JSON.stringify(quests || [])}\nՕրակարգ (առաջիկա): ${JSON.stringify(schedule || [])}\nԱնընթերցված ծանուցումներ: ${unreadCount ?? 0}\nԱդմինին ուղարկված հարցեր (վերջին 5)${relayDetail ? ":\n" + relayDetail : ": չկան"}`;

          const model = createOpenRouterProvider(openRouterKey)(await modelIdPromise);

          const tools = {
            get_profile: tool({
              description: "Բերում է ուսանողի պրոֆիլը՝ XP, հետաքրքրություններ, bio։",
              inputSchema: z.object({}),
              execute: async () => {
                const { data } = await supabase
                  .from("profiles")
                  .select(
                    "full_name,xp,interests,skills,bio,goal,preferred_project_type,availability",
                  )
                  .eq("id", userId)
                  .maybeSingle();
                return data || {};
              },
            }),
            list_schedule: tool({
              description: "Բերում է առաջիկա օրակարգային իրադարձությունները։",
              inputSchema: z.object({ days_ahead: z.number().int().min(1).max(60).default(14) }),
              execute: async ({ days_ahead }) => {
                const until = new Date(Date.now() + days_ahead * 86400000).toISOString();
                const { data } = await supabase
                  .from("schedule_events")
                  .select("*")
                  .eq("user_id", userId)
                  .lte("starts_at", until)
                  .gte("ends_at", new Date().toISOString())
                  .order("starts_at");
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
                const { data, error } = await supabase
                  .from("schedule_events")
                  .insert({
                    user_id: userId,
                    title: input.title,
                    description: input.description,
                    starts_at: input.starts_at,
                    ends_at: input.ends_at,
                    kind: input.kind,
                    location: input.location,
                    source: "ai",
                  })
                  .select()
                  .single();
                if (error) return { ok: false, error: error.message };
                return { ok: true, event: data };
              },
            }),
            update_schedule_event: tool({
              description:
                "Թարմացնում է գոյություն ունեցող օրակարգային իրադարձություն ID-ով (վերնագիր, ժամ, վայր և այլն)։ Փոխանցիր միայն փոփոխվող դաշտերը։",
              inputSchema: z.object({
                id: z.string().uuid(),
                title: z.string().min(1).max(200).optional(),
                description: z.string().max(2000).nullable().optional(),
                starts_at: z.string().describe("ISO 8601 datetime").optional(),
                ends_at: z.string().describe("ISO 8601 datetime").optional(),
                kind: z.enum(["study", "project", "meeting", "quest", "other"]).optional(),
                location: z.string().max(200).nullable().optional(),
              }),
              execute: async ({ id, ...patch }) => {
                const fields = Object.fromEntries(
                  Object.entries(patch).filter(([, v]) => v !== undefined),
                );
                if (!Object.keys(fields).length) return { ok: false, error: "no fields to update" };
                const { data, error } = await supabase
                  .from("schedule_events")
                  .update(fields)
                  .eq("id", id)
                  .eq("user_id", userId)
                  .in("source", ["manual", "ai"])
                  .select()
                  .maybeSingle();
                if (error) return { ok: false, error: error.message };
                if (!data) return { ok: false, error: "event not found or read-only" };
                return { ok: true, event: data };
              },
            }),
            delete_schedule_event: tool({
              description: "Ջնջում է օրակարգային իրադարձություն ID-ով։",
              inputSchema: z.object({ id: z.string().uuid() }),
              execute: async ({ id }) => {
                const { error } = await supabase
                  .from("schedule_events")
                  .delete()
                  .eq("id", id)
                  .eq("user_id", userId)
                  .in("source", ["manual", "ai"]);
                return error ? { ok: false, error: error.message } : { ok: true };
              },
            }),
            list_opportunities: tool({
              description: "Բերում է հասանելի հնարավորությունների ցանկը։",
              inputSchema: z.object({ limit: z.number().int().min(1).max(20).default(8) }),
              execute: async ({ limit }) => {
                const { data } = await supabase
                  .from("opportunities")
                  .select("id,title,category,description,difficulty")
                  .limit(limit);
                return data || [];
              },
            }),
            ask_admin: tool({
              description:
                "Ուղարկում է հարց ադմինին ուսանողի անունից։ Օգտագործիր երբ ուսանողն ունի հարց, որի պատասխանը պետք է ադմինից։",
              inputSchema: z.object({
                subject: z.string().min(3).max(140),
                question: z.string().min(5).max(2000),
                urgency: z.enum(["low", "normal", "high"]).default("normal"),
              }),
              execute: async ({ subject, question, urgency }) => {
                const { data: thread, error: e1 } = await supabase.rpc("create_support_thread", {
                  _subject: `[AI] ${subject}`,
                  _first_message: `[AI օգնական, հրատապություն՝ ${urgency}]\n\n${question}`,
                });
                if (e1) return { ok: false, error: e1.message };
                return {
                  ok: true,
                  thread_id: thread.id,
                  message: "Հարցն ուղարկվել է ադմինին։ Պատասխանը կհայտնվի «Աջակցություն» բաժնում։",
                };
              },
            }),
            list_quests: tool({
              description: "Բերում է ուսանողի քվեսթների կարգավիճակը։",
              inputSchema: z.object({}),
              execute: async () => {
                const [{ data: templates }, { data: progress }, { data: subs }] = await Promise.all(
                  [
                    supabase.from("quest_templates").select("*").eq("active", true),
                    supabase.from("user_quests").select("*").eq("user_id", userId),
                    supabase
                      .from("quest_submissions")
                      .select("template_id,status,period_key")
                      .eq("user_id", userId),
                  ],
                );
                return {
                  templates: templates || [],
                  progress: progress || [],
                  submissions: subs || [],
                };
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
            update_profile: tool({
              description:
                "Խմբագրում է ուսանողի պրոֆիլի ինքնանկարագրական դաշտերը (ոչ id, email, XP, avatar)։ Փոխանցիր միայն փոփոխվող դաշտերը։",
              inputSchema: z.object({
                full_name: z.string().min(1).max(120).optional(),
                bio: z.string().max(1000).nullable().optional(),
                goal: z.string().max(500).nullable().optional(),
                interests: z.array(z.string().max(60)).max(20).optional(),
                skills: z.array(z.string().max(60)).max(20).optional(),
                preferred_project_type: z.string().max(100).nullable().optional(),
              }),
              execute: async (patch) => {
                const fields = Object.fromEntries(
                  Object.entries(patch).filter(([, v]) => v !== undefined),
                );
                if (!Object.keys(fields).length) return { ok: false, error: "no fields to update" };
                const { data, error } = await supabase
                  .from("profiles")
                  .update(fields)
                  .eq("id", userId)
                  .select()
                  .maybeSingle();
                if (error) return { ok: false, error: error.message };
                return { ok: true, profile: data };
              },
            }),
            list_notifications: tool({
              description: "Բերում է ուսանողի վերջին ծանուցումները (անընթերցվածները առաջին)։",
              inputSchema: z.object({ limit: z.number().int().min(1).max(30).default(10) }),
              execute: async ({ limit }) => {
                const { data } = await supabase
                  .from("notifications")
                  .select("id,title,body,kind,read,created_at")
                  .eq("user_id", userId)
                  .order("read", { ascending: true })
                  .order("created_at", { ascending: false })
                  .limit(limit);
                return data || [];
              },
            }),
            list_my_support_threads: tool({
              description:
                "Բերում է ուսանողի աջակցության հարցումները (ներառյալ AI-ի կողմից ադմինին ուղարկվածները) և ադմինի պատասխանները, եթե կան։",
              inputSchema: z.object({}),
              execute: async () => {
                const { data: threads } = await supabase
                  .from("support_threads")
                  .select("id,subject,status,last_message_at")
                  .eq("user_id", userId)
                  .order("last_message_at", { ascending: false })
                  .limit(10);
                if (!threads?.length) return [];
                const { data: msgs } = await supabase
                  .from("support_messages")
                  .select("thread_id,sender_role,content,created_at")
                  .in(
                    "thread_id",
                    threads.map((t) => t.id),
                  )
                  .order("created_at");
                return threads.map((t) => ({
                  ...t,
                  messages: (msgs || []).filter((m) => m.thread_id === t.id),
                }));
              },
            }),
            join_opportunity: tool({
              description:
                "Գրանցում է ուսանողին հնարավորության մասնակից՝ opportunity ID-ով։ Ամսաթվով հնարավորությունները ավտոմատ ավելանում են օրակարգում։",
              inputSchema: z.object({ opportunity_id: z.string().uuid() }),
              execute: async ({ opportunity_id }) => {
                const { data, error } = await supabase.rpc("join_opportunity", {
                  _opportunity_id: opportunity_id,
                });
                if (error) return { ok: false, error: error.message };
                return data;
              },
            }),
            list_my_projects: tool({
              description:
                "Բերում է ուսանողի բոլոր նախագծերը (ակտիվ, ուղարկված, հաստատված, մերժված, չեղարկված)՝ ID-ներով։",
              inputSchema: z.object({}),
              execute: async () => {
                const { data } = await supabase
                  .from("started_projects")
                  .select("id,title,status,difficulty_tier,progress,created_at")
                  .eq("user_id", userId)
                  .order("created_at", { ascending: false });
                return data || [];
              },
            }),
            start_project: tool({
              description:
                "Առաջարկում է սկսել նոր նախագիծ և ծախսել համապատասխան XP (easy=200, medium=400, hard=700)։ Գործողությունը կկանգնի մինչև ուսանողը հաստատի այն UI-ում։",
              inputSchema: z.object({
                title: z.string().min(1).max(200),
                short_description: z.string().max(500),
                full_description: z.string().max(3000).optional(),
                matching_interests: z.array(z.string()).max(10).optional(),
                team_size: z.string().max(100).optional(),
                first_steps: z.array(z.string()).max(10).optional(),
                difficulty_tier: z.enum(["easy", "medium", "hard"]),
              }),
              execute: async (input) => {
                const { data, error } = await supabase.rpc("start_project", {
                  _title: input.title,
                  _short_description: input.short_description,
                  _full_description: input.full_description || input.short_description,
                  _matching_interests: input.matching_interests || [],
                  _team_size: input.team_size || "",
                  _first_steps: input.first_steps || [],
                  _difficulty_tier: input.difficulty_tier,
                });
                if (error) return { ok: false, error: error.message };
                return { ok: true, project: data };
              },
            }),
            submit_project: tool({
              description: "Ուղարկում է ուսանողի ակտիվ նախագիծը ադմինի ստուգմանը։",
              inputSchema: z.object({ project_id: z.string().uuid() }),
              execute: async ({ project_id }) => {
                const { data, error } = await supabase.rpc("submit_project", {
                  _project_id: project_id,
                });
                if (error) return { ok: false, error: error.message };
                return { ok: true, project: data };
              },
            }),
            cancel_project: tool({
              description:
                "Առաջարկում է չեղարկել ուսանողի նախագիծը։ Գործողությունը կկանգնի մինչև ուսանողը հաստատի այն UI-ում, քանի որ այն անդառնալի է։",
              inputSchema: z.object({
                project_id: z.string().uuid(),
              }),
              execute: async ({ project_id }) => {
                const { data, error } = await supabase.rpc("cancel_project", {
                  _project_id: project_id,
                });
                if (error) return { ok: false, error: error.message };
                return { ok: true, project: data };
              },
            }),
            claim_quest: tool({
              description:
                "Հավաքում է ավարտված քվեսթի XP-ն (միայն ապացույց չպահանջող քվեսթների համար)։",
              inputSchema: z.object({ template_id: z.string(), period: z.string() }),
              execute: async ({ template_id, period }) => {
                const { data, error } = await supabase.rpc("claim_quest", {
                  _template_id: template_id,
                  _period: period,
                });
                if (error) return { ok: false, error: error.message };
                return { ok: true, result: data };
              },
            }),
            submit_quest_evidence: tool({
              description:
                "Ուղարկում է տեքստային ապացույց ապացույց-պահանջող քվեսթի համար՝ ադմինի ստուգմանը (առանց մեդիա ֆայլերի, միայն նկարագրություն)։",
              inputSchema: z.object({
                template_id: z.string(),
                period: z.string(),
                content: z.string().min(5).max(2000),
              }),
              execute: async ({ template_id, period, content }) => {
                const { data, error } = await supabase.rpc("submit_quest", {
                  _template_id: template_id,
                  _period: period,
                  _content: content,
                  _media: [],
                });
                if (error) return { ok: false, error: error.message };
                return { ok: true, submission: data };
              },
            }),
          };

          const result = streamText({
            model,
            system: STUDENT_AGENT_SYSTEM + contextSummary,
            messages: await convertToModelMessages(messages),
            tools,
            stopWhen: stepCountIs(20),
            toolApproval: {
              add_schedule_event: "user-approval",
              update_schedule_event: "user-approval",
              delete_schedule_event: "user-approval",
              ask_admin: "user-approval",
              update_profile: "user-approval",
              join_opportunity: "user-approval",
              start_project: "user-approval",
              submit_project: "user-approval",
              cancel_project: "user-approval",
              claim_quest: "user-approval",
              submit_quest_evidence: "user-approval",
            },
            experimental_toolApprovalSecret: approvalSecret,
          });

          return result.toUIMessageStreamResponse({
            headers: corsHeaders,
            originalMessages: messages,
            // Free-tier models can still fail mid-stream (the pickHealthyModel
            // probe only checks before starting). Without this, the client
            // shows the SDK's bare English default ("An error occurred.").
            onError: (error) => {
              console.error("chat stream error", error);
              return "AI-ի հետ կապն ընդհատվեց, հավանաբար ծանրաբեռնվածության պատճառով։ Փորձիր կրկին մի քանի վայրկյան հետո։";
            },
            // Persist in UIMessage shape (parts incl. tool calls) so threads
            // reload exactly as they streamed.
            onEnd: async ({ responseMessage, isAborted }) => {
              try {
                if (!threadId || isAborted) return;
                const userMsg = messages[messages.length - 1];
                if (userMsg?.role === "user") {
                  const { error: userMessageError } = await supabase.rpc("save_agent_message", {
                    _thread_id: threadId,
                    _role: "user",
                    _parts: asJson(userMsg.parts),
                    _ai_message_id: userMsg.id,
                  });
                  if (userMessageError) throw userMessageError;
                }
                if (responseMessage) {
                  const { error: assistantMessageError } = await supabase.rpc(
                    "save_agent_message",
                    {
                      _thread_id: threadId,
                      _role: responseMessage.role,
                      _parts: asJson(responseMessage.parts),
                      _ai_message_id: responseMessage.id,
                    },
                  );
                  if (assistantMessageError) throw assistantMessageError;
                }
              } catch (e) {
                console.error("agent persist failed", e);
              }
            },
          });
        } catch (error: unknown) {
          console.error("chat route error", error);
          return new Response(
            JSON.stringify({ error: "AI օգնականը ժամանակավորապես անհասանելի է։" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      },
    },
  },
});

// AI gateway via OpenRouter — supports recommendations, project_detail, admin_insights
// Falls back to rule-based output if OpenRouter is unavailable.

import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Strongest free model first (largest free MoE on OpenRouter); free-tier IDs
// rotate and get overloaded unpredictably, so this is a fallback chain
// (callOpenRouter tries each in order) and OPENROUTER_MODEL overrides the
// default without a deploy.
const OPENROUTER_MODEL =
  Deno.env.get("OPENROUTER_MODEL") || "nvidia/nemotron-3-ultra-550b-a55b:free";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const FALLBACK_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3-coder:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

type ChatMessage = { role: "system" | "user"; content: string };
type AIKind = "recommendations" | "project_detail" | "admin_insights";

const shortText = z.string().max(1000);
const stringList = z.array(shortText).max(20);
const projectIdeaSchema = z.object({
  title: shortText,
  shortDescription: shortText,
  fullDescription: z.string().max(5000),
  matchingInterests: stringList,
  difficulty: shortText,
  suggestedTeamSize: shortText,
  timeEstimate: shortText,
  weeklyCommitment: shortText,
  milestones: z.array(z.object({ week: shortText, goal: shortText })).max(12),
  resources: z.object({
    tools: stringList,
    materials: stringList,
    budgetEstimate: shortText,
    learningTopics: stringList,
  }),
  skillsLearned: stringList,
  impact: shortText,
  firstSteps: stringList,
});
const recommendationsSchema = z.object({
  recommendedLessons: z
    .array(
      z.object({
        title: shortText,
        reason: shortText,
        category: shortText,
        difficulty: shortText,
        duration: shortText,
      }),
    )
    .max(10),
  recommendedEvents: z
    .array(z.object({ title: shortText, reason: shortText, category: shortText, date: shortText }))
    .max(10),
  recommendedMasterclasses: z
    .array(
      z.object({ title: shortText, reason: shortText, skillFocus: shortText, duration: shortText }),
    )
    .max(10),
  suggestedProjects: z.array(projectIdeaSchema).max(5),
  growthSuggestions: z.array(z.object({ title: shortText, description: shortText })).max(10),
});
const projectDetailSchema = z.object({
  title: shortText,
  fullDescription: z.string().max(5000),
  goals: stringList,
  problem: shortText,
  targetAudience: shortText,
  requiredSkills: stringList,
  teamRoles: stringList,
  firstSteps: stringList,
  timeline: shortText,
  expectedOutcome: shortText,
  presentationFormat: shortText,
  nextAction: shortText,
});
const adminInsightsSchema = z.object({
  summary: z.string().max(5000),
  keyInsights: stringList,
  recommendedPrograms: stringList,
  recommendedProjectDirections: stringList,
  engagementRisks: stringList,
  nextActions: stringList,
});
const projectIdeaInputSchema = z.object({
  title: z.string().min(1).max(200),
  shortDescription: z.string().max(1000),
  matchingInterests: z.array(z.string().max(100)).max(20).default([]),
  difficulty: z.string().max(100).default(""),
  suggestedTeamSize: z.string().max(100).default(""),
  firstSteps: z.array(z.string().max(500)).max(20).default([]),
});
const adminDataInputSchema = z.object({
  totalStudents: z.number().int().min(0).max(1_000_000),
  activeStudents: z.number().int().min(0).max(1_000_000),
  interestsCount: z.record(z.string().max(100), z.number().int().min(0).max(1_000_000)),
  projectCount: z.number().int().min(0).max(1_000_000),
  categoryCount: z.record(z.string().max(100), z.number().int().min(0).max(1_000_000)),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAIKind(value: unknown): value is AIKind {
  return value === "recommendations" || value === "project_detail" || value === "admin_insights";
}

async function callOpenRouter(
  messages: ChatMessage[],
  model = OPENROUTER_MODEL,
): Promise<{ content: string; model: string } | null> {
  if (!OPENROUTER_API_KEY) return null;
  const tryModels = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  for (const m of tryModels) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://ejmiatsin-youth-house.lovable.app",
          "X-Title": "Ejmiatsin Youth House",
        },
        body: JSON.stringify({
          model: m,
          messages,
          temperature: 0.7,
          max_tokens: 6000,
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        console.error(`OpenRouter ${m} failed:`, res.status, await res.text());
        continue;
      }
      const data: unknown = await res.json();
      if (!isRecord(data) || !Array.isArray(data.choices)) continue;
      const firstChoice = data.choices[0];
      if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) continue;
      const content = firstChoice.message.content;
      if (typeof content === "string" && content) return { content, model: m };
    } catch (e) {
      console.error(`Model ${m} error`, e);
    }
  }
  return null;
}

function safeParseJSON(text: string | null): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON object from text
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
  }
  return null;
}

// ---------- Empty states ----------
function emptyRecommendations() {
  return {
    recommendedLessons: [],
    recommendedEvents: [],
    recommendedMasterclasses: [],
    suggestedProjects: [],
    growthSuggestions: [],
  };
}

function emptyAdminInsights() {
  return {
    summary: "",
    keyInsights: [],
    recommendedPrograms: [],
    recommendedProjectDirections: [],
    engagementRisks: [],
    nextActions: [],
  };
}

// ---------- Main handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Server auth is not configured" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const declaredLength = Number(req.headers.get("content-length") || 0);
    if (declaredLength > 256_000) {
      return new Response(JSON.stringify({ error: "Request is too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await admin.auth.getUser(jwt);
    if (!jwt || authError || !authData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > 256_000) {
      return new Response(JSON.stringify({ error: "Request is too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!isRecord(body) || !isAIKind(body.kind)) {
      return new Response(JSON.stringify({ error: "Unknown kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authData.user.id;
    const kind = body.kind;
    const payload = isRecord(body.payload) ? body.payload : {};

    if (kind === "admin_insights") {
      const { data: adminRole } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!adminRole) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const hourlyLimit = kind === "recommendations" ? 6 : kind === "project_detail" ? 20 : 10;
    const { data: quotaAvailable, error: quotaError } = await admin.rpc("consume_ai_quota", {
      _user_id: userId,
      _kind: kind,
      _hourly_limit: hourlyLimit,
    });
    if (quotaError) throw quotaError;
    if (!quotaAvailable) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
      });
    }
    const usingFallbackOnly = !OPENROUTER_API_KEY;
    let aiUsed = false;
    let usedModel: string | null = null;
    let result: Record<string, unknown> | null = null;

    if (kind === "recommendations") {
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("full_name,age,interests,skills,goal,preferred_project_type")
        .eq("id", userId)
        .single();
      if (profileError) throw profileError;
      if (!usingFallbackOnly) {
        const sys =
          'You are an AI mentor for an Armenian youth innovation house. ALL text fields MUST be written in natural, professional Eastern Armenian (Արևելահայերեն) — never English or transliteration. Return ONLY valid JSON matching exactly this schema: {"recommendedLessons":[{"title":"","reason":"","category":"","difficulty":"","duration":""}],"recommendedEvents":[{"title":"","reason":"","category":"","date":""}],"recommendedMasterclasses":[{"title":"","reason":"","skillFocus":"","duration":""}],"suggestedProjects":[{"title":"","shortDescription":"","fullDescription":"","matchingInterests":[],"difficulty":"","suggestedTeamSize":"","timeEstimate":"","weeklyCommitment":"","milestones":[{"week":"","goal":""}],"resources":{"tools":[],"materials":[],"budgetEstimate":"","learningTopics":[]},"skillsLearned":[],"impact":"","firstSteps":[]}],"growthSuggestions":[{"title":"","description":""}]}. Provide 3-5 lessons, 2-3 events, 2-3 masterclasses, EXACTLY 3 deeply detailed suggested projects, 3 growth suggestions. For each project: shortDescription = 1-2 sentences; fullDescription = 3-4 rich sentences; timeEstimate like "4-6 շաբաթ"; weeklyCommitment like "5-7 ժամ շաբաթական"; 4-6 weekly milestones; resources.tools 3-6 concrete tools (Figma, Notion, GitHub, Canva և այլն); resources.materials 2-4 items; budgetEstimate in AMD like "0–15,000 ֏"; learningTopics 2-3 topic keywords (no URLs); skillsLearned 4-6 skills; impact 1 sentence on community value; firstSteps 5 concrete actions. Be specific to the student profile.';
        const user = `Ուսանողի պրոֆիլ:\nԱնուն: ${profile.full_name}\nՏարիք: ${profile.age}\nՀետաքրքրություններ: ${(profile.interests || []).join(", ")}\nՀմտություններ: ${(profile.skills || []).join(", ")}\nՆպատակ: ${profile.goal}\nՆախընտրած նախագծի տեսակ: ${profile.preferred_project_type}`;
        const response = await callOpenRouter([
          { role: "system", content: sys },
          { role: "user", content: user },
        ]);
        const parsed = safeParseJSON(response?.content || null);
        const validated = recommendationsSchema.safeParse(parsed);
        if (validated.success) {
          result = validated.data;
          aiUsed = true;
          usedModel = response?.model || null;
        }
      }
      if (!result) result = emptyRecommendations();
    } else if (kind === "project_detail") {
      const parsedIdea = projectIdeaInputSchema.safeParse(payload.idea);
      if (!parsedIdea.success) {
        return new Response(JSON.stringify({ error: "Invalid project idea" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const idea = parsedIdea.data;
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("full_name,age,interests,skills,goal,preferred_project_type")
        .eq("id", userId)
        .single();
      if (profileError) throw profileError;
      if (!usingFallbackOnly) {
        const sys =
          'ALL text fields MUST be natural Eastern Armenian. Return ONLY valid JSON matching: {"title":"","fullDescription":"","goals":[],"problem":"","targetAudience":"","requiredSkills":[],"teamRoles":[],"firstSteps":[],"timeline":"","expectedOutcome":"","presentationFormat":"","nextAction":""}.';
        const response = await callOpenRouter([
          { role: "system", content: sys },
          {
            role: "user",
            content: `Project idea: ${JSON.stringify(idea)}\nStudent: ${JSON.stringify(profile)}\nGenerate a complete project plan.`,
          },
        ]);
        const parsed = safeParseJSON(response?.content || null);
        const validated = projectDetailSchema.safeParse(parsed);
        if (validated.success) {
          result = validated.data;
          aiUsed = true;
          usedModel = response?.model || null;
        }
      }
      if (!result) {
        return new Response(
          JSON.stringify({ error: "AI project details are unavailable right now." }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    } else if (kind === "admin_insights") {
      const parsedData = adminDataInputSchema.safeParse(payload.data);
      if (!parsedData.success) {
        return new Response(JSON.stringify({ error: "Invalid analytics payload" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const data = parsedData.data;
      if (!usingFallbackOnly) {
        const sys =
          'ALL text fields MUST be natural Eastern Armenian. Return ONLY valid JSON: {"summary":"","keyInsights":[],"recommendedPrograms":[],"recommendedProjectDirections":[],"engagementRisks":[],"nextActions":[]}. Be concise and actionable.';
        const response = await callOpenRouter([
          { role: "system", content: sys },
          {
            role: "user",
            content: `Analytics: ${JSON.stringify(data)}\nGenerate insights for the youth house director.`,
          },
        ]);
        const parsed = safeParseJSON(response?.content || null);
        const validated = adminInsightsSchema.safeParse(parsed);
        if (validated.success) {
          result = validated.data;
          aiUsed = true;
          usedModel = response?.model || null;
        }
      }
      if (!result) result = emptyAdminInsights();
    }

    if (kind === "recommendations") {
      const generatedAt = new Date().toISOString();
      const { error: cacheError } = await admin.from("recommendations").upsert(
        {
          user_id: userId,
          data: result,
          source: aiUsed ? "ai" : "not-generated",
          generated_at: generatedAt,
        },
        { onConflict: "user_id" },
      );
      if (cacheError) throw cacheError;
      if (aiUsed) {
        await admin.from("notifications").insert({
          user_id: userId,
          title: "Նոր առաջարկները պատրաստ են",
          body: "Ստուգիր քո անհատականացված դասերն ու նախագծերը։",
          kind: "info",
        });
        const { error: questError } = await admin.rpc("record_ai_refresh", {
          _user_id: userId,
          _request_id: crypto.randomUUID(),
        });
        if (questError) console.error("Could not record AI quest activity", questError);
      }
    }

    return new Response(
      JSON.stringify({
        result,
        aiUsed,
        model: aiUsed ? usedModel : "not-generated",
        generatedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai function error", e);
    return new Response(JSON.stringify({ error: "AI request failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

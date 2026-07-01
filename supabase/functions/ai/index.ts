// AI gateway via OpenRouter — supports recommendations, project_detail, admin_insights
// Falls back to rule-based output if OpenRouter is unavailable.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENROUTER_MODEL = Deno.env.get("OPENROUTER_MODEL") || "openrouter/auto";
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

const FALLBACK_MODELS = [
  "openrouter/auto",
  "qwen/qwen-2.5-7b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "google/gemma-2-9b-it:free",
];

async function callOpenRouter(messages: any[], model = OPENROUTER_MODEL): Promise<string | null> {
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
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) {
        console.error(`OpenRouter ${m} failed:`, res.status, await res.text());
        continue;
      }
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (content) return content;
    } catch (e) {
      console.error(`Model ${m} error`, e);
    }
  }
  return null;
}

function safeParseJSON(text: string | null): any | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // Try to extract JSON object from text
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {}
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
    const { kind, payload } = await req.json();
    const usingFallbackOnly = !OPENROUTER_API_KEY;
    let aiUsed = false;
    let result: any = null;

    if (kind === "recommendations") {
      const profile = payload?.profile || {};
      if (!usingFallbackOnly) {
        const sys =
          'You are an AI mentor for an Armenian youth innovation house. ALL text fields MUST be written in natural, professional Eastern Armenian (Արևելահայերեն) — never English or transliteration. Return ONLY valid JSON matching exactly this schema: {"recommendedLessons":[{"title":"","reason":"","category":"","difficulty":"","duration":""}],"recommendedEvents":[{"title":"","reason":"","category":"","date":""}],"recommendedMasterclasses":[{"title":"","reason":"","skillFocus":"","duration":""}],"suggestedProjects":[{"title":"","shortDescription":"","fullDescription":"","matchingInterests":[],"difficulty":"","suggestedTeamSize":"","timeEstimate":"","weeklyCommitment":"","milestones":[{"week":"","goal":""}],"resources":{"tools":[],"materials":[],"budgetEstimate":"","learningTopics":[]},"skillsLearned":[],"impact":"","firstSteps":[]}],"growthSuggestions":[{"title":"","description":""}]}. Provide 3-5 lessons, 2-3 events, 2-3 masterclasses, EXACTLY 3 deeply detailed suggested projects, 3 growth suggestions. For each project: shortDescription = 1-2 sentences; fullDescription = 3-4 rich sentences; timeEstimate like "4-6 շաբաթ"; weeklyCommitment like "5-7 ժամ շաբաթական"; 4-6 weekly milestones; resources.tools 3-6 concrete tools (Figma, Notion, GitHub, Canva և այլն); resources.materials 2-4 items; budgetEstimate in AMD like "0–15,000 ֏"; learningTopics 2-3 topic keywords (no URLs); skillsLearned 4-6 skills; impact 1 sentence on community value; firstSteps 5 concrete actions. Be specific to the student profile.';
        const user = `Ուսանողի պրոֆիլ:\nԱնուն: ${profile.full_name}\nՏարիք: ${profile.age}\nՀետաքրքրություններ: ${(profile.interests || []).join(", ")}\nՀմտություններ: ${(profile.skills || []).join(", ")}\nՆպատակ: ${profile.goal}\nՆախընտրած նախագծի տեսակ: ${profile.preferred_project_type}`;
        const text = await callOpenRouter([
          { role: "system", content: sys },
          { role: "user", content: user },
        ]);
        const parsed = safeParseJSON(text);
        if (parsed && parsed.suggestedProjects) {
          result = parsed;
          aiUsed = true;
        }
      }
      if (!result) result = emptyRecommendations();
    } else if (kind === "project_detail") {
      const { idea, profile } = payload || {};
      if (!usingFallbackOnly) {
        const sys =
          'Return ONLY valid JSON matching: {"title":"","fullDescription":"","goals":[],"problem":"","targetAudience":"","requiredSkills":[],"teamRoles":[],"firstSteps":[],"timeline":"","expectedOutcome":"","presentationFormat":"","nextAction":""}.';
        const text = await callOpenRouter([
          { role: "system", content: sys },
          {
            role: "user",
            content: `Project idea: ${JSON.stringify(idea)}\nStudent: ${JSON.stringify(profile)}\nGenerate a complete project plan.`,
          },
        ]);
        const parsed = safeParseJSON(text);
        if (parsed && parsed.fullDescription) {
          result = parsed;
          aiUsed = true;
        }
      }
      if (!result) {
        return new Response(JSON.stringify({ error: "AI project details are unavailable right now." }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (kind === "admin_insights") {
      const data = payload?.data || {};
      if (!usingFallbackOnly) {
        const sys =
          'Return ONLY valid JSON: {"summary":"","keyInsights":[],"recommendedPrograms":[],"recommendedProjectDirections":[],"engagementRisks":[],"nextActions":[]}. Be concise and actionable.';
        const text = await callOpenRouter([
          { role: "system", content: sys },
          { role: "user", content: `Analytics: ${JSON.stringify(data)}\nGenerate insights for the youth house director.` },
        ]);
        const parsed = safeParseJSON(text);
        if (parsed && parsed.summary) {
          result = parsed;
          aiUsed = true;
        }
      }
      if (!result) result = emptyAdminInsights();
    } else {
      return new Response(JSON.stringify({ error: "Unknown kind" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ result, aiUsed, model: aiUsed ? OPENROUTER_MODEL : "not-generated", generatedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ai function error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const text = z.string().default("");
const textList = z.array(z.string()).default([]);

const milestoneSchema = z.object({
  week: text,
  goal: text,
});

export const projectIdeaSchema = z.object({
  title: text,
  shortDescription: text,
  fullDescription: text,
  matchingInterests: textList,
  difficulty: text,
  suggestedTeamSize: text,
  timeEstimate: text,
  weeklyCommitment: text,
  milestones: z.array(milestoneSchema).default([]),
  resources: z
    .object({
      tools: textList,
      materials: textList,
      budgetEstimate: text,
      learningTopics: textList,
    })
    .default({
      tools: [],
      materials: [],
      budgetEstimate: "",
      learningTopics: [],
    }),
  skillsLearned: textList,
  impact: text,
  firstSteps: textList,
});

export type ProjectIdea = z.infer<typeof projectIdeaSchema>;

const recommendationsSchema = z.object({
  recommendedLessons: z
    .array(
      z.object({
        title: text,
        reason: text,
        category: text,
        difficulty: text,
        duration: text,
      }),
    )
    .default([]),
  recommendedEvents: z
    .array(z.object({ title: text, reason: text, category: text, date: text }))
    .default([]),
  recommendedMasterclasses: z
    .array(z.object({ title: text, reason: text, skillFocus: text, duration: text }))
    .default([]),
  suggestedProjects: z.array(projectIdeaSchema).default([]),
  growthSuggestions: z.array(z.object({ title: text, description: text })).default([]),
});

export type RecommendationsResult = z.infer<typeof recommendationsSchema>;

export function parseRecommendations(value: unknown): RecommendationsResult {
  return recommendationsSchema.parse(value);
}

const projectDetailSchema = z.object({
  title: text,
  fullDescription: text,
  goals: textList,
  problem: text,
  targetAudience: text,
  requiredSkills: textList,
  teamRoles: textList,
  firstSteps: textList,
  timeline: text,
  expectedOutcome: text,
  presentationFormat: text,
  nextAction: text,
});

export type ProjectDetailResult = z.infer<typeof projectDetailSchema>;

export function parseProjectIdea(value: unknown): ProjectIdea {
  return projectIdeaSchema.parse(value);
}

const adminInsightsSchema = z.object({
  summary: text,
  keyInsights: textList,
  recommendedPrograms: textList,
  recommendedProjectDirections: textList,
  engagementRisks: textList,
  nextActions: textList,
});

export type AdminInsightsResult = z.infer<typeof adminInsightsSchema>;

type AIResponse<T> = {
  result: T;
  aiUsed: boolean;
  model: string;
  generatedAt: string;
};

const responseEnvelopeSchema = z.object({
  result: z.unknown(),
  aiUsed: z.boolean(),
  model: z.string(),
  generatedAt: z.string(),
});

export function callAI(
  kind: "recommendations",
  payload: unknown,
): Promise<AIResponse<RecommendationsResult>>;
export function callAI(
  kind: "project_detail",
  payload: unknown,
): Promise<AIResponse<ProjectDetailResult>>;
export function callAI(
  kind: "admin_insights",
  payload: unknown,
): Promise<AIResponse<AdminInsightsResult>>;
export async function callAI(
  kind: "recommendations" | "project_detail" | "admin_insights",
  payload: unknown,
): Promise<AIResponse<RecommendationsResult | ProjectDetailResult | AdminInsightsResult>> {
  const { data, error } = await supabase.functions.invoke("ai", { body: { kind, payload } });
  if (error) throw error;

  const envelope = responseEnvelopeSchema.parse(data);
  const result =
    kind === "recommendations"
      ? recommendationsSchema.parse(envelope.result)
      : kind === "project_detail"
        ? projectDetailSchema.parse(envelope.result)
        : adminInsightsSchema.parse(envelope.result);

  return { ...envelope, result };
}

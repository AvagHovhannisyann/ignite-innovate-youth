import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

/**
 * Strongest free OpenRouter model with tool-calling support. Free-tier model
 * IDs rotate over time — override with the OPENROUTER_MODEL env var without
 * touching code.
 */
export const DEFAULT_OPENROUTER_MODEL = "deepseek/deepseek-chat-v3.1:free";

export function createOpenRouterProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://ejmiatsin-youth-house.lovable.app",
      "X-Title": "Ejmiatsin Youth House",
    },
  });
}

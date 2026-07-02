import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

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
      "X-Title": "Ejmiatsin Youth House",
    },
  });
}

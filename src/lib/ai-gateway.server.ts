import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Strongest free OpenRouter model with tool-calling support. Verified live
 * against the OpenRouter catalog (largest free tool-calling model, frontier
 * MoE, confirmed correct Armenian + tool-call behavior). Free-tier model IDs
 * rotate over time — override with the OPENROUTER_MODEL env var without
 * touching code.
 */
export const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

/** Ordered fallback chain if the primary free model is rate-limited or down. */
export const OPENROUTER_FALLBACK_MODELS = [
  "qwen/qwen3-coder:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3-next-80b-a3b-instruct:free",
  "openai/gpt-oss-120b:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

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

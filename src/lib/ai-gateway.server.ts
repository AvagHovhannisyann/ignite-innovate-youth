import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

/**
 * Free OpenRouter models, ordered by observed reliability, not raw size.
 * The single biggest free model (nemotron-3-ultra-550b) is frequently
 * over its shared worker-capacity limit and — under that load — has been
 * observed returning garbled, multi-language-mixed output instead of a
 * clean error. nemotron-3-super-120b is smaller but was verified live to
 * respond cleanly and supports structured output. Free-tier availability
 * shifts hour to hour, so pickHealthyModel() below probes before every
 * conversation rather than trusting a static default. Override the whole
 * chain with OPENROUTER_MODEL without touching code.
 */
export const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free";

/** Ordered fallback chain if the primary free model is rate-limited or down. */
export const OPENROUTER_FALLBACK_MODELS = [
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "qwen/qwen3-coder:free",
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

/**
 * Free-tier OpenRouter models get rate-limited or overloaded unpredictably.
 * Probe the chain with a 1-token completion (fast, ~cheap) and use the
 * first model that responds, instead of committing the whole conversation
 * to a model that's currently down.
 */
export async function pickHealthyModel(apiKey: string, preferred?: string): Promise<string> {
  const provider = createOpenRouterProvider(apiKey);
  const chain = [preferred || DEFAULT_OPENROUTER_MODEL, ...OPENROUTER_FALLBACK_MODELS].filter(
    (id, i, arr) => arr.indexOf(id) === i,
  );
  for (const id of chain) {
    try {
      await generateText({
        model: provider(id),
        prompt: "hi",
        maxOutputTokens: 1,
        abortSignal: AbortSignal.timeout(5000),
      });
      return id;
    } catch {
      continue;
    }
  }
  return chain[0]; // everything's down — let the real call surface a clear error
}

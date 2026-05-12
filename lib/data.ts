import { cacheLife } from "next/cache";
import { z } from "zod";
import { normalizeOpenRouterModel, OPENROUTER_URL } from "./pricing";
import type { DashboardData, NormalizedModel } from "./types";

const openRouterModelSchema = z.object({
  id: z.string(),
  canonical_slug: z.string().nullable().optional(),
  hugging_face_id: z.string().nullable().optional(),
  name: z.string().optional(),
  created: z.number().optional(),
  description: z.string().optional(),
  context_length: z.number().optional(),
  architecture: z
    .object({
      modality: z.string().optional(),
      input_modalities: z.array(z.string()).optional(),
      output_modalities: z.array(z.string()).optional(),
      tokenizer: z.string().optional(),
      instruct_type: z.string().nullable().optional(),
    })
    .partial()
    .optional(),
  pricing: z
    .object({
      prompt: z.string().optional(),
      completion: z.string().optional(),
      input_cache_read: z.string().optional(),
      input_cache_write: z.string().optional(),
      web_search: z.string().optional(),
    })
    .partial()
    .optional(),
  top_provider: z
    .object({
      context_length: z.number().optional(),
      max_completion_tokens: z.number().optional(),
      is_moderated: z.boolean().optional(),
    })
    .partial()
    .nullable()
    .optional(),
  supported_parameters: z.array(z.string()).optional(),
  knowledge_cutoff: z.string().nullable().optional(),
});
const openRouterResponseSchema = z.object({ data: z.array(openRouterModelSchema) });

export async function fetchOpenRouterModels() {
  "use cache";
  cacheLife("days");
  try {
    const response = await fetch(OPENROUTER_URL, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`OpenRouter ${response.status}`);
    return openRouterResponseSchema.parse(await response.json()).data;
  } catch {
    return [];
  }
}

export async function getDashboardData(): Promise<DashboardData> {
  "use cache";
  cacheLife("days");
  const models = (await fetchOpenRouterModels())
    .map(normalizeOpenRouterModel)
    .filter((model): model is NormalizedModel => Boolean(model))
    .sort((a, b) => a.priceIndex - b.priceIndex);
  const latestModels = [...models]
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 24);

  return {
    models,
    latestModels,
    generatedAt: new Date().toISOString(),
    sourceUrl: OPENROUTER_URL,
  };
}

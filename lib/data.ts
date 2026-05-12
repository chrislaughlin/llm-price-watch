import { cacheLife } from "next/cache";
import { z } from "zod";
import { mergeOfficialOverrides, normalizeOpenRouterModel, OPENROUTER_URL } from "./pricing";
import type { DashboardData, NormalizedModel } from "./types";

const openRouterModelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  context_length: z.number().optional(),
  architecture: z.object({ output_modalities: z.array(z.string()).optional(), modality: z.string().optional() }).partial().optional(),
  pricing: z.object({ prompt: z.string().optional(), completion: z.string().optional(), input_cache_read: z.string().optional(), input_cache_write: z.string().optional() }).partial().optional(),
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
  const catalogue = (await fetchOpenRouterModels()).map(normalizeOpenRouterModel).filter((model): model is NormalizedModel => Boolean(model));
  const models = mergeOfficialOverrides(catalogue);
  const textModels = models.filter((model) => model.modality === "text");
  const embeddingModels = models.filter((model) => model.modality === "embedding");
  return {
    models,
    textModels,
    embeddingModels,
    generatedAt: new Date().toISOString(),
    sourceUrl: OPENROUTER_URL,
    stats: {
      cheapestText: textModels[0],
      cheapestEmbedding: embeddingModels[0],
      officialOverrides: models.filter((model) => model.pricingSource.type === "Official override").length,
      qualityCovered: models.filter((model) => model.quality).length,
    },
  };
}

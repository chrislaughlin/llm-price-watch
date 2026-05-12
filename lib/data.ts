import { cacheLife } from "next/cache";
import { fetch as undiciFetch, ProxyAgent } from "undici";
import { z } from "zod";
import { normalizeOpenRouterModel, OPENROUTER_URL } from "./pricing";
import type { OpenRouterModel } from "./pricing";
import type { DashboardData, NormalizedModel } from "./types";

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();
const nullableBoolean = z.boolean().nullable().optional();

const openRouterModelSchema = z.object({
  id: z.string(),
  canonical_slug: nullableString,
  hugging_face_id: nullableString,
  name: nullableString,
  created: nullableNumber,
  description: nullableString,
  context_length: nullableNumber,
  architecture: z
    .object({
      modality: nullableString,
      input_modalities: z.array(z.string()).nullable().optional(),
      output_modalities: z.array(z.string()).nullable().optional(),
      tokenizer: nullableString,
      instruct_type: z.string().nullable().optional(),
    })
    .partial()
    .optional(),
  pricing: z
    .object({
      prompt: nullableString,
      completion: nullableString,
      input_cache_read: nullableString,
      input_cache_write: nullableString,
      web_search: nullableString,
    })
    .partial()
    .optional(),
  top_provider: z
    .object({
      context_length: nullableNumber,
      max_completion_tokens: nullableNumber,
      is_moderated: nullableBoolean,
    })
    .partial()
    .nullable()
    .optional(),
  supported_parameters: z.array(z.string()).nullable().optional(),
  knowledge_cutoff: nullableString,
});
const openRouterResponseSchema = z.object({ data: z.array(z.unknown()) });

export async function fetchOpenRouterModels() {
  "use cache";
  cacheLife("days");
  try {
    const response = await fetchOpenRouterCatalogue();
    if (!response.ok) throw new Error(`OpenRouter ${response.status}`);
    const payload = openRouterResponseSchema.parse(await response.json());
    return payload.data.flatMap((item): OpenRouterModel[] => {
      const parsed = openRouterModelSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch (error) {
    console.error("Unable to load OpenRouter model catalogue", error);
    return [];
  }
}

function fetchOpenRouterCatalogue() {
  const proxyUrl = process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy;
  const headers = { Accept: "application/json", "User-Agent": "llm-price-watch/1.0" };

  if (!proxyUrl) return fetch(OPENROUTER_URL, { headers });

  return undiciFetch(OPENROUTER_URL, {
    dispatcher: new ProxyAgent(proxyUrl),
    headers,
  });
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

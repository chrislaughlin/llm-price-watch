import type { EquivalentFilter, ModelModality, ModelUse, NormalizedModel, Provider } from "./types";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/models";

export type OpenRouterModel = {
  id: string;
  canonical_slug?: string | null;
  hugging_face_id?: string | null;
  name?: string;
  created?: number;
  description?: string;
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string | null;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
    input_cache_read?: string;
    input_cache_write?: string;
    web_search?: string;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  } | null;
  supported_parameters?: string[];
  knowledge_cutoff?: string | null;
};

const providerMatchers: Array<[Provider, RegExp]> = [
  ["OpenAI", /^openai\//i],
  ["Anthropic", /^anthropic\//i],
  ["Google", /^google\//i],
  ["Meta", /^(meta|meta-llama)\//i],
  ["Mistral", /^mistral(ai)?\//i],
  ["Cohere", /^cohere\//i],
];

const modelUses = ["text", "image", "audio", "video", "file", "embedding"] as const satisfies readonly ModelUse[];

export function classifyProvider(id: string): Provider {
  return providerMatchers.find(([, test]) => test.test(id))?.[0] ?? "Other";
}

function normalizeUse(value: string): ModelUse | undefined {
  const lower = value.toLowerCase();
  if (lower === "embeddings") return "embedding";
  return modelUses.find((use) => use === lower);
}

function uniqueUses(values: Array<string | undefined>): ModelUse[] {
  return Array.from(new Set(values.flatMap((value) => (value ? [normalizeUse(value)] : [])).filter(Boolean) as ModelUse[]));
}

export function classifyModality(model: OpenRouterModel): ModelModality {
  const uses = uniqueUses([
    ...(model.architecture?.input_modalities ?? []),
    ...(model.architecture?.output_modalities ?? []),
    model.architecture?.modality,
  ]);
  const joined = [model.architecture?.modality, model.id, model.name ?? ""].join(" ").toLowerCase();
  if (uses.includes("embedding") || /embed|embedding/.test(joined)) return "embedding";
  return uses[0] ?? "text";
}

function dollarsPerTokenToPerMillion(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1_000_000 : undefined;
}

function parsePrice(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function computePriceIndex(modality: ModelModality, inputPricePer1M: number, outputPricePer1M?: number): number {
  return modality === "embedding" ? inputPricePer1M : 0.8 * inputPricePer1M + 0.2 * (outputPricePer1M ?? inputPricePer1M);
}

export function normalizeOpenRouterModel(model: OpenRouterModel): NormalizedModel | undefined {
  const inputPricePer1M = dollarsPerTokenToPerMillion(model.pricing?.prompt);
  if (inputPricePer1M === undefined) return undefined;

  const outputPricePer1M = dollarsPerTokenToPerMillion(model.pricing?.completion);
  const modality = classifyModality(model);
  const inputModalities = uniqueUses(model.architecture?.input_modalities ?? []);
  const outputModalities = uniqueUses(model.architecture?.output_modalities ?? []);
  const uses = uniqueUses([...inputModalities, ...outputModalities, modality]);
  const priceIndex = computePriceIndex(modality, inputPricePer1M, outputPricePer1M);

  return {
    id: model.id,
    canonicalSlug: model.canonical_slug ?? undefined,
    huggingFaceId: model.hugging_face_id ?? undefined,
    name: model.name ?? model.id,
    provider: classifyProvider(model.id),
    modality,
    uses,
    description: model.description,
    contextWindow: model.context_length ?? model.top_provider?.context_length ?? 0,
    createdAt: model.created ? new Date(model.created * 1000).toISOString() : undefined,
    price: {
      inputPricePer1M,
      outputPricePer1M,
      cacheReadPricePer1M: dollarsPerTokenToPerMillion(model.pricing?.input_cache_read),
      cacheWritePricePer1M: dollarsPerTokenToPerMillion(model.pricing?.input_cache_write),
      webSearchPrice: parsePrice(model.pricing?.web_search),
    },
    architecture: {
      modality: model.architecture?.modality,
      inputModalities,
      outputModalities,
      tokenizer: model.architecture?.tokenizer,
      instructType: model.architecture?.instruct_type ?? undefined,
    },
    topProvider: model.top_provider
      ? {
          contextWindow: model.top_provider.context_length,
          maxCompletionTokens: model.top_provider.max_completion_tokens,
          isModerated: model.top_provider.is_moderated,
        }
      : undefined,
    supportedParameters: model.supported_parameters ?? [],
    knowledgeCutoff: model.knowledge_cutoff ?? undefined,
    priceIndex,
  };
}

export function findCheaperEquivalents(
  selected: NormalizedModel,
  models: NormalizedModel[],
  filters: EquivalentFilter = {},
): NormalizedModel[] {
  return models
    .filter((candidate) => {
      return (
        candidate.id !== selected.id &&
        candidate.modality === selected.modality &&
        candidate.priceIndex < selected.priceIndex &&
        (!filters.providers?.length || filters.providers.includes(candidate.provider)) &&
        (!filters.minContextWindow || candidate.contextWindow >= filters.minContextWindow)
      );
    })
    .sort((a, b) => a.priceIndex - b.priceIndex)
    .slice(0, 8);
}

export function formatUsd(value: number | undefined): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1 ? 2 : 4,
  }).format(value);
}

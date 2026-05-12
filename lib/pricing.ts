import type { EquivalentFilter, ModelModality, ModelUse, NormalizedModel, Provider } from "./types";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/models";

export type OpenRouterModel = {
  id: string;
  canonical_slug?: string | null;
  hugging_face_id?: string | null;
  name?: string | null;
  created?: number | null;
  description?: string | null;
  context_length?: number | null;
  architecture?: {
    modality?: string | null;
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
    tokenizer?: string | null;
    instruct_type?: string | null;
  };
  pricing?: {
    prompt?: string | null;
    completion?: string | null;
    input_cache_read?: string | null;
    input_cache_write?: string | null;
    web_search?: string | null;
  };
  top_provider?: {
    context_length?: number | null;
    max_completion_tokens?: number | null;
    is_moderated?: boolean | null;
  } | null;
  supported_parameters?: string[] | null;
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
const premiumCapabilityParameters = new Set(["tools", "tool_choice", "structured_outputs", "response_format", "reasoning", "include_reasoning"]);

export function classifyProvider(id: string): Provider {
  return providerMatchers.find(([, test]) => test.test(id))?.[0] ?? "Other";
}

function normalizeUse(value: string): ModelUse | undefined {
  const lower = value.toLowerCase();
  if (lower === "embeddings") return "embedding";
  return modelUses.find((use) => use === lower);
}

function uniqueUses(values: Array<string | null | undefined>): ModelUse[] {
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

function dollarsPerTokenToPerMillion(value: string | null | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1_000_000 : undefined;
}

function parsePrice(value: string | null | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function computePriceIndex(modality: ModelModality, inputPricePer1M: number, outputPricePer1M?: number): number {
  return modality === "embedding" ? inputPricePer1M : 0.8 * inputPricePer1M + 0.2 * (outputPricePer1M ?? inputPricePer1M);
}

export function computeTopPickScore(model: Pick<NormalizedModel, "priceIndex" | "contextWindow" | "price" | "supportedParameters" | "uses" | "createdAt" | "topProvider">): number {
  const affordability = model.priceIndex <= 0 ? 42 : Math.max(0, 42 - Math.log10(model.priceIndex + 1) * 18);
  const context = Math.min(24, Math.log2(Math.max(model.contextWindow, 1) / 8000 + 1) * 6);
  const maxOutput = Math.min(10, ((model.topProvider?.maxCompletionTokens ?? 0) / 32000) * 10);
  const capability = Math.min(16, model.uses.length * 2.5 + model.supportedParameters.filter((parameter) => premiumCapabilityParameters.has(parameter)).length * 1.5);
  const cacheBonus = model.price.cacheReadPricePer1M !== undefined || model.price.cacheWritePricePer1M !== undefined ? 4 : 0;
  const created = model.createdAt ? new Date(model.createdAt).getTime() : 0;
  const ageDays = created ? (Date.now() - created) / 86_400_000 : Number.POSITIVE_INFINITY;
  const recency = ageDays <= 30 ? 4 : ageDays <= 180 ? 2 : 0;

  return Math.round((affordability + context + maxOutput + capability + cacheBonus + recency) * 10) / 10;
}

export function getTopPickReasons(model: Pick<NormalizedModel, "priceIndex" | "contextWindow" | "price" | "supportedParameters" | "uses" | "topProvider">): string[] {
  const reasons: string[] = [];
  if (model.priceIndex === 0) reasons.push("Free route");
  else if (model.priceIndex <= 0.25) reasons.push("Ultra-low blended price");
  else if (model.priceIndex <= 1) reasons.push("Low blended price");
  if (model.contextWindow >= 1_000_000) reasons.push("1M+ context");
  else if (model.contextWindow >= 128_000) reasons.push("Long context");
  if ((model.topProvider?.maxCompletionTokens ?? 0) >= 32_000) reasons.push("Large output budget");
  if (model.uses.length >= 3) reasons.push("Multimodal");
  if (model.supportedParameters.includes("tools") || model.supportedParameters.includes("tool_choice")) reasons.push("Tool use");
  if (model.supportedParameters.includes("structured_outputs") || model.supportedParameters.includes("response_format")) reasons.push("Structured output");
  if (model.supportedParameters.includes("reasoning") || model.supportedParameters.includes("include_reasoning")) reasons.push("Reasoning controls");
  if (model.price.cacheReadPricePer1M !== undefined || model.price.cacheWritePricePer1M !== undefined) reasons.push("Cache pricing");
  return reasons.slice(0, 4);
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
  const normalized = {
    id: model.id,
    canonicalSlug: model.canonical_slug ?? undefined,
    huggingFaceId: model.hugging_face_id ?? undefined,
    name: model.name ?? model.id,
    provider: classifyProvider(model.id),
    modality,
    uses,
    description: model.description ?? undefined,
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
      modality: model.architecture?.modality ?? undefined,
      inputModalities,
      outputModalities,
      tokenizer: model.architecture?.tokenizer ?? undefined,
      instructType: model.architecture?.instruct_type ?? undefined,
    },
    topProvider: model.top_provider
      ? {
          contextWindow: model.top_provider.context_length ?? undefined,
          maxCompletionTokens: model.top_provider.max_completion_tokens ?? undefined,
          isModerated: model.top_provider.is_moderated ?? undefined,
        }
      : undefined,
    supportedParameters: model.supported_parameters ?? [],
    knowledgeCutoff: model.knowledge_cutoff ?? undefined,
    priceIndex,
  } satisfies Omit<NormalizedModel, "topPickScore" | "topPickReasons">;

  return {
    ...normalized,
    topPickScore: computeTopPickScore(normalized),
    topPickReasons: getTopPickReasons(normalized),
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

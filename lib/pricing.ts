import { officialOverrides } from "@/fixtures/official-overrides";
import { qualityScores } from "@/fixtures/quality-scores";
import type { EquivalentFilter, ModelModality, NormalizedModel, OfficialOverride, Provider, QualityBand } from "./types";

export const OPENROUTER_URL = "https://openrouter.ai/api/v1/models?output_modalities=text,embeddings";

export type OpenRouterModel = {
  id: string;
  name?: string;
  context_length?: number;
  architecture?: { output_modalities?: string[]; modality?: string };
  pricing?: { prompt?: string; completion?: string; input_cache_read?: string; input_cache_write?: string };
};

const providerMatchers: Array<[Provider, RegExp]> = [
  ["OpenAI", /^openai\//i], ["Anthropic", /^anthropic\//i], ["Google", /^google\//i], ["Meta", /^(meta|meta-llama)\//i], ["Mistral", /^mistral(ai)?\//i], ["Cohere", /^cohere\//i],
];

const qualityRank: Record<QualityBand, number> = { unknown: 0, utility: 1, balanced: 2, frontier: 3 };

export function classifyProvider(id: string): Provider {
  return providerMatchers.find(([, test]) => test.test(id))?.[0] ?? "Other";
}

export function classifyModality(model: OpenRouterModel): ModelModality {
  const joined = [...(model.architecture?.output_modalities ?? []), model.architecture?.modality ?? "", model.id, model.name ?? ""].join(" ").toLowerCase();
  return /embed|embedding/.test(joined) ? "embedding" : "text";
}

function dollarsPerTokenToPerMillion(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed * 1_000_000 : undefined;
}

export function computePriceIndex(modality: ModelModality, inputPricePer1M: number, outputPricePer1M?: number): number {
  return modality === "embedding" ? inputPricePer1M : 0.8 * inputPricePer1M + 0.2 * (outputPricePer1M ?? inputPricePer1M);
}

export function normalizeOpenRouterModel(model: OpenRouterModel): NormalizedModel | undefined {
  const modality = classifyModality(model);
  const inputPricePer1M = dollarsPerTokenToPerMillion(model.pricing?.prompt);
  if (inputPricePer1M === undefined) return undefined;
  const outputPricePer1M = dollarsPerTokenToPerMillion(model.pricing?.completion);
  const quality = qualityScores.find((item) => item.modelId === model.id);
  const priceIndex = computePriceIndex(modality, inputPricePer1M, outputPricePer1M);
  return {
    id: model.id,
    name: model.name ?? model.id,
    provider: classifyProvider(model.id),
    modality,
    contextWindow: model.context_length ?? 0,
    price: {
      inputPricePer1M,
      outputPricePer1M,
      cacheReadPricePer1M: dollarsPerTokenToPerMillion(model.pricing?.input_cache_read),
      cacheWritePricePer1M: dollarsPerTokenToPerMillion(model.pricing?.input_cache_write),
    },
    pricingSource: { type: "OpenRouter", sourceUrl: OPENROUTER_URL, verifiedAt: new Date().toISOString().slice(0, 10) },
    quality,
    priceIndex,
    costPerQuality: quality ? priceIndex / quality.score : undefined,
  };
}

export function overrideToModel(override: OfficialOverride): NormalizedModel {
  const quality = qualityScores.find((item) => item.modelId === override.id);
  const priceIndex = computePriceIndex(override.modality, override.inputPricePer1M, override.outputPricePer1M);
  return {
    id: override.id,
    name: override.name,
    provider: override.provider,
    modality: override.modality,
    contextWindow: override.contextWindow,
    price: {
      inputPricePer1M: override.inputPricePer1M,
      outputPricePer1M: override.outputPricePer1M,
      cacheReadPricePer1M: override.cacheReadPricePer1M,
      cacheWritePricePer1M: override.cacheWritePricePer1M,
    },
    pricingSource: { type: "Official override", sourceUrl: override.sourceUrl, verifiedAt: override.verifiedAt, notes: override.notes },
    quality,
    priceIndex,
    costPerQuality: quality ? priceIndex / quality.score : undefined,
  };
}

export function mergeOfficialOverrides(models: NormalizedModel[]): NormalizedModel[] {
  const byId = new Map(models.map((model) => [model.id, model]));
  for (const override of officialOverrides) byId.set(override.id, overrideToModel(override));
  return [...byId.values()].sort((a, b) => a.priceIndex - b.priceIndex);
}

export function findCheaperEquivalents(selected: NormalizedModel, models: NormalizedModel[], filters: EquivalentFilter = {}): NormalizedModel[] {
  const selectedBand = selected.quality?.band ?? "unknown";
  return models.filter((candidate) => {
    const candidateBand = candidate.quality?.band ?? "unknown";
    return candidate.id !== selected.id && candidate.modality === selected.modality && candidate.priceIndex < selected.priceIndex && (!filters.providers?.length || filters.providers.includes(candidate.provider)) && (!filters.minContextWindow || candidate.contextWindow >= filters.minContextWindow) && (selectedBand === "unknown" || qualityRank[candidateBand] >= qualityRank[selectedBand]);
  }).sort((a, b) => a.priceIndex - b.priceIndex).slice(0, 8);
}

export function formatUsd(value: number | undefined): string {
  if (value === undefined) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: value < 1 ? 4 : 2 }).format(value);
}

import { describe, expect, it } from "vitest";
import { classifyModality, computePriceIndex, findCheaperEquivalents, mergeOfficialOverrides, normalizeOpenRouterModel } from "@/lib/pricing";
import type { NormalizedModel } from "@/lib/types";

const base: NormalizedModel = {
  id: "provider/base",
  name: "Base",
  provider: "OpenAI",
  modality: "text",
  contextWindow: 128000,
  price: { inputPricePer1M: 10, outputPricePer1M: 20 },
  pricingSource: { type: "OpenRouter", sourceUrl: "test", verifiedAt: "2026-05-10" },
  quality: { modelId: "provider/base", score: 80, band: "balanced", source: "test" },
  priceIndex: 12,
  costPerQuality: 0.15,
};

describe("pricing data layer", () => {
  it("parses and normalizes OpenRouter text prices from dollars per token", () => {
    const model = normalizeOpenRouterModel({ id: "openai/example", name: "Example", context_length: 32000, architecture: { output_modalities: ["text"] }, pricing: { prompt: "0.000001", completion: "0.000004" } });
    expect(model?.provider).toBe("OpenAI");
    expect(model?.modality).toBe("text");
    expect(model?.price.inputPricePer1M).toBe(1);
    expect(model?.price.outputPricePer1M).toBe(4);
  });

  it("classifies embedding models by modality metadata or name", () => {
    expect(classifyModality({ id: "openai/text-embedding-3-small", architecture: { output_modalities: ["embeddings"] } })).toBe("embedding");
  });

  it("lets official overrides replace OpenRouter rows", () => {
    const merged = mergeOfficialOverrides([{ ...base, id: "openai/gpt-4.1", priceIndex: 999 }]);
    const gpt = merged.find((model) => model.id === "openai/gpt-4.1");
    expect(gpt?.pricingSource.type).toBe("Official override");
    expect(gpt?.priceIndex).toBeCloseTo(3.2);
  });

  it("computes the 80/20 text price index", () => {
    expect(computePriceIndex("text", 2, 8)).toBeCloseTo(3.2);
  });

  it("computes embedding price index from input price", () => {
    expect(computePriceIndex("embedding", 0.02)).toBeCloseTo(0.02);
  });

  it("filters cheaper equivalents by modality, price, quality, provider, and context", () => {
    const cheapBalanced = { ...base, id: "provider/cheap", provider: "Anthropic" as const, priceIndex: 6, contextWindow: 200000 };
    const cheapUtility = { ...cheapBalanced, id: "provider/utility", quality: { modelId: "provider/utility", score: 50, band: "utility" as const, source: "test" } };
    const wrongProvider = { ...cheapBalanced, id: "provider/wrong", provider: "Google" as const };
    const matches = findCheaperEquivalents(base, [base, cheapBalanced, cheapUtility, wrongProvider], { providers: ["Anthropic"], minContextWindow: 128000 });
    expect(matches.map((model) => model.id)).toEqual(["provider/cheap"]);
  });
});

import { describe, expect, it } from "vitest";
import { classifyModality, computePriceIndex, findCheaperEquivalents, normalizeOpenRouterModel } from "@/lib/pricing";
import type { NormalizedModel } from "@/lib/types";

const base: NormalizedModel = {
  id: "provider/base",
  name: "Base",
  provider: "OpenAI",
  modality: "text",
  uses: ["text"],
  contextWindow: 128000,
  price: { inputPricePer1M: 10, outputPricePer1M: 20 },
  architecture: { inputModalities: ["text"], outputModalities: ["text"], modality: "text->text" },
  topProvider: { maxCompletionTokens: 8192, isModerated: true },
  supportedParameters: ["tools"],
  priceIndex: 12,
};

describe("pricing data layer", () => {
  it("parses and normalizes model prices from dollars per token", () => {
    const model = normalizeOpenRouterModel({
      id: "openai/example",
      name: "Example",
      created: 1778613011,
      context_length: 32000,
      architecture: { modality: "text->text", input_modalities: ["text"], output_modalities: ["text"], tokenizer: "GPT" },
      pricing: { prompt: "0.000001", completion: "0.000004" },
      top_provider: { context_length: 32000, max_completion_tokens: 4096, is_moderated: true },
      supported_parameters: ["tools", "response_format"],
    });

    expect(model?.provider).toBe("OpenAI");
    expect(model?.modality).toBe("text");
    expect(model?.uses).toEqual(["text"]);
    expect(model?.price.inputPricePer1M).toBe(1);
    expect(model?.price.outputPricePer1M).toBe(4);
    expect(model?.architecture.tokenizer).toBe("GPT");
    expect(model?.topProvider?.maxCompletionTokens).toBe(4096);
  });

  it("classifies embedding models by modality metadata or name", () => {
    expect(classifyModality({ id: "openai/text-embedding-3-small", architecture: { output_modalities: ["embeddings"] } })).toBe("embedding");
  });

  it("captures image, audio, video, and file use filters from model modalities", () => {
    const model = normalizeOpenRouterModel({
      id: "provider/multimodal",
      name: "Multimodal",
      architecture: { modality: "text+image+audio+video+file->text", input_modalities: ["text", "image", "audio", "video", "file"], output_modalities: ["text"] },
      pricing: { prompt: "0.000001", completion: "0.000002" },
    });

    expect(model?.uses).toEqual(["text", "image", "audio", "video", "file"]);
  });

  it("computes the 80/20 text price index", () => {
    expect(computePriceIndex("text", 2, 8)).toBeCloseTo(3.2);
  });

  it("computes embedding price index from input price", () => {
    expect(computePriceIndex("embedding", 0.02)).toBeCloseTo(0.02);
  });

  it("filters cheaper equivalents by modality, price, provider, and context", () => {
    const cheapText = { ...base, id: "provider/cheap", provider: "Anthropic" as const, priceIndex: 6, contextWindow: 200000 };
    const cheapImage = { ...cheapText, id: "provider/image", modality: "image" as const, uses: ["image" as const] };
    const wrongProvider = { ...cheapText, id: "provider/wrong", provider: "Google" as const };
    const matches = findCheaperEquivalents(base, [base, cheapText, cheapImage, wrongProvider], {
      providers: ["Anthropic"],
      minContextWindow: 128000,
    });

    expect(matches.map((model) => model.id)).toEqual(["provider/cheap"]);
  });
});

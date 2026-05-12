export type Provider = "OpenAI" | "Anthropic" | "Google" | "Meta" | "Mistral" | "Cohere" | "Other";
export type ModelModality = "text" | "embedding";
export type QualityBand = "frontier" | "balanced" | "utility" | "unknown";

export type PricePoint = {
  inputPricePer1M: number;
  outputPricePer1M?: number;
  cacheWritePricePer1M?: number;
  cacheReadPricePer1M?: number;
};

export type PricingSource = {
  type: "OpenRouter" | "Official override";
  sourceUrl: string;
  verifiedAt: string;
  notes?: string;
};

export type QualityScore = {
  modelId: string;
  score: number;
  band: Exclude<QualityBand, "unknown">;
  source: string;
  notes?: string;
};

export type NormalizedModel = {
  id: string;
  name: string;
  provider: Provider;
  modality: ModelModality;
  contextWindow: number;
  price: PricePoint;
  pricingSource: PricingSource;
  quality?: QualityScore;
  priceIndex: number;
  costPerQuality?: number;
};

export type OfficialOverride = PricePoint & {
  id: string;
  name: string;
  provider: Provider;
  modality: ModelModality;
  contextWindow: number;
  sourceUrl: string;
  verifiedAt: string;
  notes?: string;
};

export type DashboardData = {
  models: NormalizedModel[];
  textModels: NormalizedModel[];
  embeddingModels: NormalizedModel[];
  generatedAt: string;
  sourceUrl: string;
  stats: {
    cheapestText?: NormalizedModel;
    cheapestEmbedding?: NormalizedModel;
    officialOverrides: number;
    qualityCovered: number;
  };
};

export type EquivalentFilter = {
  providers?: Provider[];
  minContextWindow?: number;
};

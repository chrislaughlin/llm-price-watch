export type Provider = "OpenAI" | "Anthropic" | "Google" | "Meta" | "Mistral" | "Cohere" | "Other";
export type ModelUse = "text" | "image" | "audio" | "video" | "file" | "embedding";
export type ModelModality = ModelUse;
export type QualityBand = "frontier" | "balanced" | "utility" | "unknown";

export type PricePoint = {
  inputPricePer1M: number;
  outputPricePer1M?: number;
  cacheWritePricePer1M?: number;
  cacheReadPricePer1M?: number;
  webSearchPrice?: number;
};

export type ModelArchitecture = {
  modality?: string;
  inputModalities: ModelUse[];
  outputModalities: ModelUse[];
  tokenizer?: string;
  instructType?: string;
};

export type TopProviderAttributes = {
  contextWindow?: number;
  maxCompletionTokens?: number;
  isModerated?: boolean;
};

export type NormalizedModel = {
  id: string;
  canonicalSlug?: string;
  huggingFaceId?: string;
  name: string;
  provider: Provider;
  modality: ModelModality;
  uses: ModelUse[];
  description?: string;
  contextWindow: number;
  createdAt?: string;
  price: PricePoint;
  architecture: ModelArchitecture;
  topProvider?: TopProviderAttributes;
  supportedParameters: string[];
  knowledgeCutoff?: string;
  priceIndex: number;
  topPickScore: number;
  topPickReasons: string[];
};

export type DashboardData = {
  models: NormalizedModel[];
  latestModels: NormalizedModel[];
  generatedAt: string;
  sourceUrl: string;
};

export type EquivalentFilter = {
  providers?: Provider[];
  minContextWindow?: number;
};

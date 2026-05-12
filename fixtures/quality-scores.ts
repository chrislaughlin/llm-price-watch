import type { QualityScore } from "@/lib/types";

export const qualityScores: QualityScore[] = [
  { modelId: "openai/gpt-4.1", score: 92, band: "frontier", source: "Curated benchmark blend", notes: "Strong general text and coding coverage." },
  { modelId: "openai/gpt-4.1-mini", score: 78, band: "balanced", source: "Curated benchmark blend", notes: "High value mid-tier model." },
  { modelId: "anthropic/claude-sonnet-4.5", score: 94, band: "frontier", source: "Curated benchmark blend", notes: "Frontier coding and agentic performance." },
  { modelId: "anthropic/claude-haiku-4.5", score: 82, band: "balanced", source: "Curated benchmark blend", notes: "Fast, lower-cost Anthropic option." },
  { modelId: "openai/text-embedding-3-small", score: 70, band: "utility", source: "Curated embedding coverage", notes: "Low-cost embedding baseline." },
];

import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { cacheLife } from "next/cache";
import { z } from "zod";
import { getDashboardData } from "@/lib/data";
import { findCheaperEquivalents } from "@/lib/pricing";

const CLAUDE_MODEL_ID = "claude-haiku-4-5-20251001";
const bodySchema = z.object({ selectedId: z.string().min(1), candidateIds: z.array(z.string()).max(8).default([]) });

export async function GET() {
  return Response.json({ enabled: Boolean(process.env.ANTHROPIC_API_KEY) && process.env.DISABLE_CLAUDE_EXPLANATIONS !== "true", model: CLAUDE_MODEL_ID });
}

export async function POST(request: Request) {
  if (process.env.DISABLE_CLAUDE_EXPLANATIONS === "true") return Response.json({ error: "Claude explanations are disabled by environment flag." }, { status: 503 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "ANTHROPIC_API_KEY is not configured, so the click-triggered explanation is disabled." }, { status: 503 });
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: "Invalid explanation request." }, { status: 400 });
  const data = await getDashboardData();
  const selected = data.models.find((model) => model.id === parsed.data.selectedId);
  if (!selected) return Response.json({ error: "Selected model not found." }, { status: 404 });
  const byRequested = data.models.filter((model) => parsed.data.candidateIds.includes(model.id));
  const candidates = (byRequested.length ? byRequested : findCheaperEquivalents(selected, data.models)).slice(0, 5);
  return Response.json({ explanation: await explainSelectedModel(selected.id, candidates.map((candidate) => candidate.id)) });
}

async function explainSelectedModel(selectedId: string, candidateIds: string[]) {
  "use cache";
  cacheLife("days");
  const data = await getDashboardData();
  const selected = data.models.find((model) => model.id === selectedId);
  const candidates = data.models.filter((model) => candidateIds.includes(model.id)).slice(0, 5);
  if (!selected || !candidates.length) return "No cheaper equivalent candidate data is available for this selection.";
  const payload = { selected: compactModel(selected), candidates: candidates.map(compactModel) };
  const { text } = await generateText({
    model: anthropic(CLAUDE_MODEL_ID),
    temperature: 0.2,
    maxOutputTokens: 220,
    prompt: `Explain cheaper equivalent LLM choices for a pricing dashboard. Use only this normalized pricing and curated quality data. Be concise, neutral, and mention tradeoffs. Data: ${JSON.stringify(payload)}`,
  });
  return text;
}

function compactModel(model: Awaited<ReturnType<typeof getDashboardData>>["models"][number]) {
  return { id: model.id, name: model.name, provider: model.provider, modality: model.modality, contextWindow: model.contextWindow, priceIndex: model.priceIndex, inputPricePer1M: model.price.inputPricePer1M, outputPricePer1M: model.price.outputPricePer1M, qualityBand: model.quality?.band ?? "unknown", qualityScore: model.quality?.score };
}

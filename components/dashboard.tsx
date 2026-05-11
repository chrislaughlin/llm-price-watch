"use client";

import { ArrowDownUp, BadgeDollarSign, BrainCircuit, Database, Info, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { findCheaperEquivalents, formatUsd } from "@/lib/pricing";
import type { DashboardData, ModelModality, NormalizedModel, Provider, QualityBand } from "@/lib/types";

type SortKey = "priceIndex" | "name" | "provider" | "contextWindow" | "quality";
const providers: Provider[] = ["OpenAI", "Anthropic", "Google", "Meta", "Mistral", "Cohere", "Other"];
const bands: QualityBand[] = ["frontier", "balanced", "utility", "unknown"];

export function Dashboard({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState("");
  const [modality, setModality] = useState<ModelModality>("text");
  const [activeProviders, setActiveProviders] = useState<Provider[]>([]);
  const [minContext, setMinContext] = useState(0);
  const [activeBands, setActiveBands] = useState<QualityBand[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("priceIndex");
  const [selectedId, setSelectedId] = useState(data.textModels[0]?.id ?? data.models[0]?.id);
  const [explanation, setExplanation] = useState<string>("");
  const [explainStatus, setExplainStatus] = useState<"idle" | "loading" | "error">("idle");

  const filtered = useMemo(() => {
    const rows = data.models.filter((model) => {
      const haystack = `${model.name} ${model.id} ${model.provider}`.toLowerCase();
      const band = model.quality?.band ?? "unknown";
      return model.modality === modality && haystack.includes(query.toLowerCase()) && (!activeProviders.length || activeProviders.includes(model.provider)) && model.contextWindow >= minContext && (!activeBands.length || activeBands.includes(band));
    });
    return [...rows].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "provider") return a.provider.localeCompare(b.provider);
      if (sortKey === "contextWindow") return b.contextWindow - a.contextWindow;
      if (sortKey === "quality") return (b.quality?.score ?? -1) - (a.quality?.score ?? -1);
      return a.priceIndex - b.priceIndex;
    });
  }, [activeBands, activeProviders, data.models, minContext, modality, query, sortKey]);

  const selected = filtered.find((model) => model.id === selectedId) ?? filtered[0] ?? data.models[0];
  const equivalents = selected ? findCheaperEquivalents(selected, filtered, { providers: activeProviders, minContextWindow: minContext }) : [];

  async function explain() {
    if (!selected) return;
    setExplainStatus("loading");
    setExplanation("");
    const response = await fetch("/api/explain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selectedId: selected.id, candidateIds: equivalents.map((item) => item.id) }) });
    const json = await response.json();
    if (!response.ok) {
      setExplainStatus("error");
      setExplanation(json.error ?? "Explanation unavailable.");
      return;
    }
    setExplainStatus("idle");
    setExplanation(json.explanation);
  }

  return <main className="min-h-screen bg-slate-950 text-slate-100">
    <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-slate-950/40 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-cyan-300"><Sparkles size={16}/> LLMPriceWatch public market board</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Current text and embedding model pricing</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Daily cached OpenRouter catalogue with official overrides and curated quality bands. Text index uses an 80/20 input-output blend.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
          {['OpenRouter','Official override','Curated quality','Last checked daily'].map((badge) => <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-center" key={badge}>{badge}</span>)}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric icon={<BadgeDollarSign/>} label="Cheapest text index" value={data.stats.cheapestText ? formatUsd(data.stats.cheapestText.priceIndex) : "—"} detail={data.stats.cheapestText?.name ?? "No rows"}/>
        <Metric icon={<Database/>} label="Cheapest embedding" value={data.stats.cheapestEmbedding ? formatUsd(data.stats.cheapestEmbedding.priceIndex) : "—"} detail={data.stats.cheapestEmbedding?.name ?? "No rows"}/>
        <Metric icon={<Info/>} label="Official overrides" value={String(data.stats.officialOverrides)} detail="Provider source precedence"/>
        <Metric icon={<BrainCircuit/>} label="Quality covered" value={String(data.stats.qualityCovered)} detail="Cost-per-quality eligible"/>
      </div>

      <section className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <label className="relative"><Search className="absolute left-3 top-3 text-slate-500" size={18}/><input className="w-full rounded-2xl border border-white/10 bg-slate-900 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-cyan-300" placeholder="Search models or providers" value={query} onChange={(event) => setQuery(event.target.value)}/></label>
            <div className="flex rounded-2xl border border-white/10 bg-slate-900 p-1 text-sm">{(["text", "embedding"] as ModelModality[]).map((item) => <button className={`rounded-xl px-4 py-2 ${modality === item ? "bg-cyan-300 text-slate-950" : "text-slate-300"}`} key={item} onClick={() => setModality(item)}>{item}</button>)}</div>
            <select className="rounded-2xl border border-white/10 bg-slate-900 px-3 text-sm" value={minContext} onChange={(event) => setMinContext(Number(event.target.value))}><option value={0}>Any context</option><option value={32000}>32K+</option><option value={128000}>128K+</option><option value={200000}>200K+</option><option value={1000000}>1M+</option></select>
          </div>
          <FilterPills values={providers} active={activeProviders} setActive={setActiveProviders}/>
          <FilterPills values={bands} active={activeBands} setActive={setActiveBands}/>
          <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
            <table className="hidden w-full border-collapse text-left text-sm md:table"><thead className="bg-slate-900 text-xs uppercase text-slate-400"><tr>{[["name","Model"],["provider","Provider"],["priceIndex","Index"],["quality","Quality"],["contextWindow","Context"]].map(([key,label]) => <th className="px-4 py-3" key={key}><button className="inline-flex items-center gap-1" onClick={() => setSortKey(key as SortKey)}>{label}<ArrowDownUp size={12}/></button></th>)}</tr></thead><tbody>{filtered.map((model) => <ModelRow key={model.id} model={model} selected={selected?.id === model.id} onClick={() => setSelectedId(model.id)}/>)}</tbody></table>
            <div className="grid gap-3 p-3 md:hidden">{filtered.map((model) => <button className="rounded-2xl border border-white/10 bg-slate-900 p-4 text-left" key={model.id} onClick={() => setSelectedId(model.id)}><div className="font-semibold">{model.name}</div><div className="mt-2 flex justify-between text-sm text-slate-300"><span>{model.provider}</span><span>{formatUsd(model.priceIndex)}</span></div></button>)}</div>
          </div>
        </div>
        {selected && <aside className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><h2 className="text-xl font-semibold">{selected.name}</h2><p className="text-sm text-slate-400">{selected.id}</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><Stat label="Input" value={formatUsd(selected.price.inputPricePer1M)}/><Stat label="Output" value={formatUsd(selected.price.outputPricePer1M)}/><Stat label="Index" value={formatUsd(selected.priceIndex)}/><Stat label="Context" value={selected.contextWindow.toLocaleString()}/></div><p className="mt-4 rounded-2xl border border-white/10 bg-slate-900 p-3 text-sm text-slate-300">Source: {selected.pricingSource.type} · checked {selected.pricingSource.verifiedAt}</p><h3 className="mt-5 font-semibold">Cheaper equivalents</h3><div className="mt-3 space-y-2">{equivalents.length ? equivalents.map((item) => <div className="rounded-2xl bg-slate-900 p-3 text-sm" key={item.id}><div className="flex justify-between gap-2"><span>{item.name}</span><b>{formatUsd(item.priceIndex)}</b></div><p className="text-slate-400">{item.provider} · {item.quality?.band ?? "unknown"}</p></div>) : <p className="text-sm text-slate-400">No cheaper equivalent matches the active filters.</p>}</div><button className="mt-4 w-full rounded-2xl bg-cyan-300 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60" disabled={explainStatus === "loading" || !equivalents.length} onClick={explain}>{explainStatus === "loading" ? "Asking Claude…" : "Explain with Claude"}</button>{explanation && <p className={`mt-3 rounded-2xl p-3 text-sm ${explainStatus === "error" ? "bg-amber-500/10 text-amber-200" : "bg-cyan-300/10 text-cyan-100"}`}>{explanation}</p>}</aside>}
      </section>
    </section>
  </main>;
}

function Metric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4"><div className="text-cyan-300">{icon}</div><p className="mt-3 text-sm text-slate-400">{label}</p><p className="text-2xl font-semibold">{value}</p><p className="truncate text-sm text-slate-300">{detail}</p></div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-900 p-3"><p className="text-slate-400">{label}</p><p className="font-semibold text-white">{value}</p></div>; }
function FilterPills<T extends string>({ values, active, setActive }: { values: T[]; active: T[]; setActive: (values: T[]) => void }) { return <div className="mt-3 flex flex-wrap gap-2">{values.map((value) => <button className={`rounded-full border px-3 py-1 text-xs ${active.includes(value) ? "border-cyan-300 bg-cyan-300 text-slate-950" : "border-white/10 bg-slate-900 text-slate-300"}`} key={value} onClick={() => setActive(active.includes(value) ? active.filter((item) => item !== value) : [...active, value])}>{value}</button>)}</div>; }
function ModelRow({ model, selected, onClick }: { model: NormalizedModel; selected: boolean; onClick: () => void }) { return <tr className={`cursor-pointer border-t border-white/10 hover:bg-cyan-300/5 ${selected ? "bg-cyan-300/10" : ""}`} onClick={onClick}><td className="px-4 py-3"><div className="font-medium text-white">{model.name}</div><div className="text-xs text-slate-500">{model.id}</div></td><td className="px-4 py-3 text-slate-300">{model.provider}</td><td className="px-4 py-3 font-semibold">{formatUsd(model.priceIndex)}</td><td className="px-4 py-3"><span className="rounded-full bg-white/10 px-2 py-1 text-xs">{model.quality?.band ?? "unknown"}{model.quality ? ` · ${model.quality.score}` : ""}</span></td><td className="px-4 py-3 text-slate-300">{model.contextWindow.toLocaleString()}</td></tr>; }

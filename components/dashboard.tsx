"use client";

import { ArrowDownUp, BadgeDollarSign, Brain, CalendarDays, Database, Search, ShieldCheck, Sparkles, Trophy, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { formatUsd } from "@/lib/pricing";
import type { DashboardData, ModelUse, NormalizedModel, Provider } from "@/lib/types";

type SortKey = "topPickScore" | "priceIndex" | "name" | "provider" | "contextWindow" | "createdAt";
type ViewMode = "leaderboard" | "new";

const providers: Provider[] = ["OpenAI", "Anthropic", "Google", "Meta", "Mistral", "Cohere", "Other"];
const modelUses: ModelUse[] = ["text", "image", "audio", "video", "file", "embedding"];

export function Dashboard({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState("");
  const [activeUses, setActiveUses] = useState<ModelUse[]>([]);
  const [activeProviders, setActiveProviders] = useState<Provider[]>([]);
  const [minContext, setMinContext] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("topPickScore");
  const [viewMode, setViewMode] = useState<ViewMode>("leaderboard");
  const [selectedId, setSelectedId] = useState(data.models[0]?.id ?? data.latestModels[0]?.id);

  const filtered = useMemo(() => {
    const source = viewMode === "new" ? data.latestModels : data.models;
    const normalizedQuery = query.trim().toLowerCase();

    const rows = source.filter((model) => {
      const haystack = [
        model.name,
        model.id,
        model.provider,
        model.description ?? "",
        model.architecture.modality ?? "",
        model.supportedParameters.join(" "),
        model.topPickReasons.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (!activeUses.length || activeUses.some((use) => model.uses.includes(use))) &&
        (!activeProviders.length || activeProviders.includes(model.provider)) &&
        model.contextWindow >= minContext
      );
    });

    return [...rows].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "provider") return a.provider.localeCompare(b.provider);
      if (sortKey === "contextWindow") return b.contextWindow - a.contextWindow;
      if (sortKey === "createdAt") return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
      if (sortKey === "priceIndex") return a.priceIndex - b.priceIndex;
      return b.topPickScore - a.topPickScore;
    });
  }, [activeProviders, activeUses, data.latestModels, data.models, minContext, query, sortKey, viewMode]);

  const selected = filtered.find((model) => model.id === selectedId) ?? filtered[0] ?? data.models[0];
  const topPicks = filtered.slice(0, 3);
  const freeCount = data.models.filter((model) => model.priceIndex === 0).length;
  const toolReadyCount = data.models.filter((model) => model.supportedParameters.includes("tools") || model.supportedParameters.includes("tool_choice")).length;

  return (
    <main className="min-h-screen overflow-hidden bg-[#060816] text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_0%,rgba(124,58,237,0.35),transparent_32rem),radial-gradient(circle_at_85%_8%,rgba(14,165,233,0.24),transparent_30rem),linear-gradient(180deg,#070816_0%,#090b18_52%,#03040a_100%)]" />
      <section className="mx-auto flex max-w-[92rem] flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between rounded-[2rem] border border-white/10 bg-white/[0.04] px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-cyan-300 via-violet-400 to-fuchsia-500 text-[#060816] shadow-lg shadow-violet-500/25">
              <Brain size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200">Model Ledger</p>
              <p className="text-xs text-slate-500">OpenRouter model intelligence</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-1 text-sm text-slate-400 md:flex">
            <span className="rounded-xl bg-white/10 px-4 py-2 text-white">Leaderboard</span>
            <span className="px-4 py-2">Pricing</span>
            <span className="px-4 py-2">Capabilities</span>
          </div>
          <a className="rounded-2xl border border-cyan-300/30 px-4 py-2 text-sm font-semibold text-cyan-100 shadow-[inset_0_0_24px_rgba(34,211,238,0.08)]" href={data.sourceUrl}>
            Source API
          </a>
        </nav>

        <header className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-[#0b1022]/85 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl lg:p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
          <div className="grid gap-7 lg:grid-cols-[1fr_430px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-violet-100">
                <Sparkles size={14} /> Dark leaderboard theme
              </div>
              <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-white sm:text-7xl">
                Top picks for model spend, context, and capability.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-400">
                Ranked from live OpenRouter catalogue fields: blended price per million tokens, context window, max output, modalities, tool/structured-output support, cache pricing, and recency.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <HeroMetric icon={<Database size={18} />} label="Models indexed" value={data.models.length.toLocaleString()} />
              <HeroMetric icon={<BadgeDollarSign size={18} />} label="Free routes" value={freeCount.toLocaleString()} />
              <HeroMetric icon={<Zap size={18} />} label="Tool ready" value={toolReadyCount.toLocaleString()} />
              <HeroMetric icon={<CalendarDays size={18} />} label="Updated" value={formatDate(data.generatedAt)} />
            </div>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1fr_390px]">
          <div className="min-w-0 rounded-[2rem] border border-white/10 bg-[#0b1022]/90 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto]">
              <label className="relative">
                <Search className="absolute left-4 top-3.5 text-slate-500" size={18} />
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.06] py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300/60 focus:ring-4 focus:ring-cyan-300/10"
                  placeholder="Search models, providers, parameters, top-pick reasons…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <SegmentedControl value={viewMode} setValue={setViewMode} />
              <select
                className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 text-sm text-slate-100 outline-none focus:border-cyan-300/60"
                value={minContext}
                onChange={(event) => setMinContext(Number(event.target.value))}
              >
                <option className="bg-[#0b1022]" value={0}>Any context</option>
                <option className="bg-[#0b1022]" value={32000}>32K+</option>
                <option className="bg-[#0b1022]" value={128000}>128K+</option>
                <option className="bg-[#0b1022]" value={200000}>200K+</option>
                <option className="bg-[#0b1022]" value={1000000}>1M+</option>
              </select>
            </div>

            <div className="mt-4 grid gap-4 border-y border-white/10 py-4 xl:grid-cols-2">
              <FilterPills label="Use" values={modelUses} active={activeUses} setActive={setActiveUses} />
              <FilterPills label="Maker" values={providers} active={activeProviders} setActive={setActiveProviders} />
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-3">
              {topPicks.map((model, index) => (
                <TopPickCard index={index} key={model.id} model={model} selected={selected?.id === model.id} onClick={() => setSelectedId(model.id)} />
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <span>{filtered.length.toLocaleString()} matching models</span>
              <span className="inline-flex items-center gap-2"><ShieldCheck size={15} /> Scores use API attributes; downloads are not exposed by /models.</span>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black/20">
              <table className="hidden w-full border-collapse text-left text-sm md:table">
                <thead className="bg-white/[0.04] text-xs uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    {[
                      ["topPickScore", "Pick score"],
                      ["name", "Model"],
                      ["provider", "Maker"],
                      ["priceIndex", "Blended $ / 1M"],
                      ["contextWindow", "Context"],
                      ["createdAt", "Added"],
                    ].map(([key, label]) => (
                      <th className="px-4 py-3" key={key}>
                        <button className="inline-flex items-center gap-1 transition hover:text-cyan-200" onClick={() => setSortKey(key as SortKey)}>
                          {label}
                          <ArrowDownUp size={12} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((model, index) => (
                    <ModelRow index={index} key={model.id} model={model} selected={selected?.id === model.id} onClick={() => setSelectedId(model.id)} />
                  ))}
                </tbody>
              </table>
              <div className="grid gap-3 p-3 md:hidden">
                {filtered.map((model) => (
                  <button
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-cyan-300/40"
                    key={model.id}
                    onClick={() => setSelectedId(model.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold text-white">{model.name}</div>
                      <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">{model.topPickScore}</span>
                    </div>
                    <div className="mt-2 flex justify-between text-sm text-slate-400">
                      <span>{model.provider}</span>
                      <span>{formatUsd(model.priceIndex)}</span>
                    </div>
                    <UseTags uses={model.uses} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {selected && <ModelDetails model={selected} />}
        </section>
      </section>
    </main>
  );
}

function HeroMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.05] p-4 shadow-inner shadow-white/5">
      <div className="text-cyan-200">{icon}</div>
      <p className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function SegmentedControl({ value, setValue }: { value: ViewMode; setValue: (value: ViewMode) => void }) {
  return (
    <div className="flex rounded-2xl border border-white/10 bg-black/20 p-1 text-sm">
      {[
        ["leaderboard", "Leaderboard"],
        ["new", "New models"],
      ].map(([key, label]) => (
        <button
          className={`rounded-xl px-4 py-2 font-medium transition ${
            value === key ? "bg-gradient-to-r from-cyan-300 to-violet-400 text-[#060816]" : "text-slate-400 hover:bg-white/[0.06] hover:text-white"
          }`}
          key={key}
          onClick={() => setValue(key as ViewMode)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function FilterPills<T extends string>({
  label,
  values,
  active,
  setActive,
}: {
  label: string;
  values: T[];
  active: T[];
  setActive: (values: T[]) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <button
            className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
              active.includes(value)
                ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100"
                : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/25 hover:text-white"
            }`}
            key={value}
            onClick={() => setActive(active.includes(value) ? active.filter((item) => item !== value) : [...active, value])}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

function TopPickCard({ model, selected, onClick, index }: { model: NormalizedModel; selected: boolean; onClick: () => void; index: number }) {
  const medals = ["from-amber-200 to-orange-400", "from-slate-200 to-slate-500", "from-orange-200 to-amber-700"];

  return (
    <button
      className={`group min-w-0 rounded-3xl border p-4 text-left transition ${
        selected ? "border-violet-300/70 bg-violet-400/10 shadow-[0_0_28px_rgba(168,85,247,0.22)]" : "border-white/10 bg-white/[0.04] hover:border-cyan-300/40"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${medals[index] ?? medals[0]} text-[#060816] shadow-lg`}>
          <Trophy size={22} />
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">{model.topPickScore}</span>
      </div>
      <h3 className="mt-4 line-clamp-2 min-h-12 font-semibold leading-6 text-white">{model.name}</h3>
      <p className="mt-1 text-xs text-slate-500">{model.provider} · {formatUsd(model.priceIndex)} blended</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <MiniMetric label="Input" value={formatUsd(model.price.inputPricePer1M)} />
        <MiniMetric label="Context" value={compactNumber(model.contextWindow)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {model.topPickReasons.slice(0, 3).map((reason) => (
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-300" key={reason}>{reason}</span>
        ))}
      </div>
    </button>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-black/20 p-2">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function ModelRow({ model, selected, onClick, index }: { model: NormalizedModel; selected: boolean; onClick: () => void; index: number }) {
  return (
    <tr
      className={`cursor-pointer border-t border-white/10 transition hover:bg-white/[0.04] ${selected ? "bg-cyan-300/[0.08]" : ""}`}
      onClick={onClick}
    >
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-600">#{index + 1}</span>
          <span className="rounded-full bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">{model.topPickScore}</span>
        </div>
      </td>
      <td className="px-4 py-4">
        <div className="max-w-[420px]">
          <div className="truncate font-semibold text-white">{model.name}</div>
          <div className="truncate text-xs text-slate-500">{model.id}</div>
          <UseTags uses={model.uses} />
        </div>
      </td>
      <td className="px-4 py-4 text-slate-300">{model.provider}</td>
      <td className="px-4 py-4 font-semibold text-emerald-200">{formatUsd(model.priceIndex)}</td>
      <td className="px-4 py-4 text-slate-300">{model.contextWindow.toLocaleString()}</td>
      <td className="px-4 py-4 text-slate-500">{formatDate(model.createdAt)}</td>
    </tr>
  );
}

function ModelDetails({ model }: { model: NormalizedModel }) {
  const visibleParameters = model.supportedParameters.slice(0, 12);

  return (
    <aside className="rounded-[2rem] border border-white/10 bg-[#0b1022]/90 p-5 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur-xl lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Selected model</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">{model.name}</h2>
          <p className="mt-1 break-all font-mono text-xs text-slate-500">{model.id}</p>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-violet-400/10 text-violet-200">
          <Sparkles />
        </div>
      </div>

      {model.description && <p className="mt-4 line-clamp-5 text-sm leading-6 text-slate-400">{stripMarkdown(model.description)}</p>}

      <div className="mt-5 rounded-3xl border border-cyan-300/20 bg-cyan-300/10 p-4">
        <p className="text-xs uppercase tracking-[0.18em] text-cyan-200">Top-pick score</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <p className="text-4xl font-semibold text-white">{model.topPickScore}</p>
          <p className="text-right text-xs leading-5 text-slate-400">Balanced score for price, context, output, capabilities, cache, and freshness.</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {model.topPickReasons.length ? model.topPickReasons.map((reason) => <span className="rounded-full bg-black/20 px-2.5 py-1 text-xs text-cyan-100" key={reason}>{reason}</span>) : <span className="text-sm text-slate-400">No standout tags yet.</span>}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Input / 1M" value={formatUsd(model.price.inputPricePer1M)} />
        <Stat label="Output / 1M" value={formatUsd(model.price.outputPricePer1M)} />
        <Stat label="Context" value={model.contextWindow.toLocaleString()} />
        <Stat label="Max output" value={model.topProvider?.maxCompletionTokens?.toLocaleString() ?? "—"} />
      </div>

      <AttributeSection title="Capabilities">
        <Attribute label="Use" value={model.uses.join(", ")} />
        <Attribute label="Input" value={model.architecture.inputModalities.join(", ") || "—"} />
        <Attribute label="Output" value={model.architecture.outputModalities.join(", ") || "—"} />
        <Attribute label="Architecture" value={model.architecture.modality ?? "—"} />
      </AttributeSection>

      <AttributeSection title="Model attributes">
        <Attribute label="Added" value={formatDate(model.createdAt)} />
        <Attribute label="Tokenizer" value={model.architecture.tokenizer ?? "—"} />
        <Attribute label="Moderated" value={model.topProvider?.isModerated === undefined ? "—" : model.topProvider.isModerated ? "Yes" : "No"} />
        <Attribute label="Knowledge cutoff" value={model.knowledgeCutoff ?? "—"} />
        {model.price.cacheReadPricePer1M !== undefined && <Attribute label="Cache read" value={`${formatUsd(model.price.cacheReadPricePer1M)} / 1M`} />}
        {model.price.cacheWritePricePer1M !== undefined && <Attribute label="Cache write" value={`${formatUsd(model.price.cacheWritePricePer1M)} / 1M`} />}
        {model.price.webSearchPrice !== undefined && <Attribute label="Web search" value={formatUsd(model.price.webSearchPrice)} />}
      </AttributeSection>

      <AttributeSection title="Supported parameters">
        <div className="flex flex-wrap gap-2">
          {visibleParameters.length ? (
            visibleParameters.map((parameter) => (
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs text-slate-300" key={parameter}>
                {parameter}
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-400">No parameters listed.</span>
          )}
        </div>
      </AttributeSection>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function AttributeSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 border-t border-white/10 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
      <div className="mt-3 grid gap-2">{children}</div>
    </section>
  );
}

function Attribute({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="capitalize text-slate-100">{value}</span>
    </div>
  );
}

function UseTags({ uses }: { uses: ModelUse[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {uses.map((use) => (
        <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-[11px] font-medium capitalize text-violet-100" key={use}>
          {use}
        </span>
      ))}
    </div>
  );
}

function formatDate(value: string | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function stripMarkdown(value: string) {
  return value.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/[*_`#>]/g, "");
}

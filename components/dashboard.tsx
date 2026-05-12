"use client";

import { ArrowDownUp, CalendarDays, Search, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { formatUsd } from "@/lib/pricing";
import type { DashboardData, ModelUse, NormalizedModel, Provider } from "@/lib/types";

type SortKey = "priceIndex" | "name" | "provider" | "contextWindow" | "createdAt";
type ViewMode = "leaderboard" | "new";

const providers: Provider[] = ["OpenAI", "Anthropic", "Google", "Meta", "Mistral", "Cohere", "Other"];
const modelUses: ModelUse[] = ["text", "image", "audio", "video", "file", "embedding"];

export function Dashboard({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState("");
  const [activeUses, setActiveUses] = useState<ModelUse[]>([]);
  const [activeProviders, setActiveProviders] = useState<Provider[]>([]);
  const [minContext, setMinContext] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("priceIndex");
  const [viewMode, setViewMode] = useState<ViewMode>("leaderboard");
  const [selectedId, setSelectedId] = useState(data.latestModels[0]?.id ?? data.models[0]?.id);

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
      return a.priceIndex - b.priceIndex;
    });
  }, [activeProviders, activeUses, data.latestModels, data.models, minContext, query, sortKey, viewMode]);

  const selected = filtered.find((model) => model.id === selectedId) ?? filtered[0] ?? data.models[0];

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#171512]">
      <section className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="grid gap-5 border-b border-[#171512]/15 pb-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#766b5e]">Model ledger</p>
            <h1 className="mt-3 max-w-4xl text-5xl font-semibold tracking-[-0.055em] text-[#171512] sm:text-6xl">
              A leaderboard for the newest and most useful models.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#5f574d]">
              Search every listed model, sort by price or recency, filter by use case, and inspect the attributes that matter before choosing a model.
            </p>
          </div>
          <div className="rounded-[2rem] border border-[#171512]/15 bg-[#fffaf0] p-4 shadow-[8px_8px_0_#171512]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#766b5e]">Updated</p>
            <p className="mt-2 text-2xl font-semibold">{formatDate(data.generatedAt)}</p>
            <p className="mt-2 text-sm text-[#6f665b]">{data.models.length.toLocaleString()} models indexed</p>
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[1fr_390px]">
          <div className="rounded-[2rem] border border-[#171512]/15 bg-[#fffaf0] p-4 shadow-[6px_6px_0_#d8c7a3]">
            <div className="grid gap-3 xl:grid-cols-[1fr_auto_auto]">
              <label className="relative">
                <Search className="absolute left-4 top-3.5 text-[#8b7f70]" size={18} />
                <input
                  className="w-full rounded-2xl border border-[#171512]/15 bg-white py-3 pl-11 pr-4 text-sm outline-none transition focus:border-[#171512] focus:ring-4 focus:ring-[#e1d1b1]"
                  placeholder="Search models, providers, parameters, capabilities…"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <SegmentedControl value={viewMode} setValue={setViewMode} />
              <select
                className="rounded-2xl border border-[#171512]/15 bg-white px-4 text-sm outline-none focus:border-[#171512]"
                value={minContext}
                onChange={(event) => setMinContext(Number(event.target.value))}
              >
                <option value={0}>Any context</option>
                <option value={32000}>32K+</option>
                <option value={128000}>128K+</option>
                <option value={200000}>200K+</option>
                <option value={1000000}>1M+</option>
              </select>
            </div>

            <div className="mt-4 grid gap-3 border-y border-[#171512]/10 py-4 xl:grid-cols-2">
              <FilterPills label="Use" values={modelUses} active={activeUses} setActive={setActiveUses} />
              <FilterPills label="Maker" values={providers} active={activeProviders} setActive={setActiveProviders} />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#6f665b]">
              <span>{filtered.length.toLocaleString()} matching models</span>
              <span className="inline-flex items-center gap-2"><SlidersHorizontal size={15} /> Click a row for attributes</span>
            </div>

            <div className="mt-4 overflow-hidden rounded-3xl border border-[#171512]/15 bg-white">
              <table className="hidden w-full border-collapse text-left text-sm md:table">
                <thead className="bg-[#171512] text-xs uppercase tracking-[0.14em] text-[#f4f1ea]">
                  <tr>
                    {[
                      ["name", "Model"],
                      ["provider", "Maker"],
                      ["priceIndex", "Blended $ / 1M"],
                      ["createdAt", "New"],
                      ["contextWindow", "Context"],
                    ].map(([key, label]) => (
                      <th className="px-4 py-3" key={key}>
                        <button className="inline-flex items-center gap-1" onClick={() => setSortKey(key as SortKey)}>
                          {label}
                          <ArrowDownUp size={12} />
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((model, index) => (
                    <ModelRow
                      index={index}
                      key={model.id}
                      model={model}
                      selected={selected?.id === model.id}
                      onClick={() => setSelectedId(model.id)}
                    />
                  ))}
                </tbody>
              </table>
              <div className="grid gap-3 p-3 md:hidden">
                {filtered.map((model) => (
                  <button
                    className="rounded-2xl border border-[#171512]/15 bg-[#fffaf0] p-4 text-left"
                    key={model.id}
                    onClick={() => setSelectedId(model.id)}
                  >
                    <div className="font-semibold">{model.name}</div>
                    <div className="mt-2 flex justify-between text-sm text-[#6f665b]">
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

function SegmentedControl({ value, setValue }: { value: ViewMode; setValue: (value: ViewMode) => void }) {
  return (
    <div className="flex rounded-2xl border border-[#171512]/15 bg-white p-1 text-sm">
      {[
        ["leaderboard", "Leaderboard"],
        ["new", "New models"],
      ].map(([key, label]) => (
        <button
          className={`rounded-xl px-4 py-2 font-medium transition ${
            value === key ? "bg-[#171512] text-[#fffaf0]" : "text-[#5f574d] hover:bg-[#f4f1ea]"
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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#766b5e]">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => (
          <button
            className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition ${
              active.includes(value)
                ? "border-[#171512] bg-[#171512] text-[#fffaf0]"
                : "border-[#171512]/15 bg-white text-[#4f473f] hover:border-[#171512]/40"
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

function ModelRow({ model, selected, onClick, index }: { model: NormalizedModel; selected: boolean; onClick: () => void; index: number }) {
  return (
    <tr
      className={`cursor-pointer border-t border-[#171512]/10 transition hover:bg-[#f4f1ea] ${selected ? "bg-[#efe3ca]" : ""}`}
      onClick={onClick}
    >
      <td className="px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 min-w-8 font-mono text-xs text-[#8b7f70]">#{index + 1}</span>
          <div>
            <div className="font-semibold text-[#171512]">{model.name}</div>
            <div className="max-w-[360px] truncate text-xs text-[#8b7f70]">{model.id}</div>
            <UseTags uses={model.uses} />
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-[#4f473f]">{model.provider}</td>
      <td className="px-4 py-4 font-semibold">{formatUsd(model.priceIndex)}</td>
      <td className="px-4 py-4 text-[#4f473f]">{formatDate(model.createdAt)}</td>
      <td className="px-4 py-4 text-[#4f473f]">{model.contextWindow.toLocaleString()}</td>
    </tr>
  );
}

function ModelDetails({ model }: { model: NormalizedModel }) {
  const visibleParameters = model.supportedParameters.slice(0, 12);

  return (
    <aside className="rounded-[2rem] border border-[#171512]/15 bg-[#171512] p-5 text-[#fffaf0] shadow-[6px_6px_0_#d8c7a3] lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c7bda8]">Selected model</p>
          <h2 className="mt-2 text-2xl font-semibold leading-tight">{model.name}</h2>
          <p className="mt-1 break-all font-mono text-xs text-[#c7bda8]">{model.id}</p>
        </div>
        <CalendarDays className="shrink-0 text-[#e1d1b1]" />
      </div>

      {model.description && <p className="mt-4 line-clamp-5 text-sm leading-6 text-[#ded5c2]">{stripMarkdown(model.description)}</p>}

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Input" value={formatUsd(model.price.inputPricePer1M)} />
        <Stat label="Output" value={formatUsd(model.price.outputPricePer1M)} />
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
              <span className="rounded-full bg-[#fffaf0]/10 px-2.5 py-1 text-xs text-[#ded5c2]" key={parameter}>
                {parameter}
              </span>
            ))
          ) : (
            <span className="text-sm text-[#c7bda8]">No parameters listed.</span>
          )}
        </div>
      </AttributeSection>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#fffaf0]/10 bg-[#fffaf0]/10 p-3">
      <p className="text-xs uppercase tracking-[0.14em] text-[#c7bda8]">{label}</p>
      <p className="mt-1 font-semibold text-white">{value}</p>
    </div>
  );
}

function AttributeSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5 border-t border-[#fffaf0]/10 pt-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c7bda8]">{title}</h3>
      <div className="mt-3 grid gap-2">{children}</div>
    </section>
  );
}

function Attribute({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 text-sm">
      <span className="text-[#c7bda8]">{label}</span>
      <span className="capitalize text-[#fffaf0]">{value}</span>
    </div>
  );
}

function UseTags({ uses }: { uses: ModelUse[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {uses.map((use) => (
        <span className="rounded-full bg-[#171512]/10 px-2 py-0.5 text-[11px] font-medium capitalize text-[#4f473f]" key={use}>
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

function stripMarkdown(value: string) {
  return value.replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1").replace(/[*_`#>]/g, "");
}

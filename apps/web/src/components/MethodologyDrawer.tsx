import { useEffect, useMemo, useRef, useState } from "react";
import {
  WATER_SCALE_COMPARISONS,
  type MethodologyResponse,
  type MethodologySourceLink,
  type MethodologyTabId,
  type OverviewResponse
} from "@agentic-insights/shared";
import { formatLitres, formatNumber } from "../lib/format";
import { MethodologySourceCard } from "./MethodologySourceCard";
import { ModelUsageList } from "./ModelUsageList";
import { ModelUsageStatusKey } from "./ModelUsageStatusKey";
import { SkeletonBlock } from "./SkeletonBlock";
import { UsageSummaryMetrics } from "./UsageSummaryMetrics";

interface MethodologyDrawerProps {
  open: boolean;
  methodology: MethodologyResponse | null;
  overview: OverviewResponse | null;
  defaultTab: MethodologyTabId;
  loading: boolean;
  onClose: () => void;
}

const tabs: Array<{ id: MethodologyTabId; label: string }> = [
  { id: "prompts", label: "Prompts" },
  { id: "water", label: "Water" },
  { id: "energy", label: "Energy" },
  { id: "carbon", label: "Carbon" }
];

const WATER_REFERENCE_DESCRIPTION_BY_URL: Record<string, string> = {
  "https://doi.org/10.1145/3724499":
    "Overview article explaining why AI systems consume freshwater and how water demand shifts across infrastructure and regions.",
  "https://arxiv.org/abs/2304.03271":
    "Research paper quantifying the hidden operational water footprint of modern AI models and the data centers behind them."
};
const WATER_COMPARISON_BY_URL = new Map(WATER_SCALE_COMPARISONS.map((comparison) => [comparison.sourceUrl, comparison]));

function formatUsdPerMillion(value: number): string {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 3,
    maximumFractionDigits: 6
  })}`;
}

function formatGeneratedAt(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(parsed);
}

function formatComparisonTypeLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

export function MethodologyDrawer({ open, methodology, overview, defaultTab, loading, onClose }: MethodologyDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<MethodologyTabId>("prompts");
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [searchValue, setSearchValue] = useState("");

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setActiveTab(defaultTab);
    setSelectedProvider("all");
    setSearchValue("");
  }, [defaultTab, open]);

  const providers = useMemo(() => {
    if (!methodology) {
      return [];
    }

    return [...new Set(methodology.pricingTable.map((entry) => entry.provider))].sort((left, right) =>
      left.localeCompare(right)
    );
  }, [methodology]);

  const filteredPricingTable = useMemo(() => {
    if (!methodology) {
      return [];
    }

    const query = searchValue.trim().toLowerCase();
    return methodology.pricingTable.filter((entry) => {
      if (selectedProvider !== "all" && entry.provider !== selectedProvider) {
        return false;
      }

      if (!query) {
        return true;
      }

      return entry.model.includes(query) || entry.provider.includes(query);
    });
  }, [methodology, searchValue, selectedProvider]);

  if (!open) return null;

  const hasExceptions = overview
    ? overview.exclusions.length > 0 || overview.tokenTotals.unestimatedTokens > 0
    : false;
  const topModels = overview?.modelUsage.slice(0, 3) ?? [];
  const activeSources = methodology?.sourcesByTab[activeTab] ?? [];

  function renderSources() {
    if (activeSources.length === 0) {
      return null;
    }

    function buildCardData(link: MethodologySourceLink) {
      if (activeTab === "water") {
        const comparison = WATER_COMPARISON_BY_URL.get(link.url);
        if (comparison) {
          return {
            title: comparison.label,
            href: link.url,
            linkLabel: link.label,
            badges: [formatComparisonTypeLabel(comparison.comparisonType)],
            value: formatLitres(comparison.litres),
            description: comparison.description,
            ...(comparison.sourceNote ? { note: comparison.sourceNote } : {})
          };
        }

        return {
          title: link.label,
          href: link.url,
          description:
            WATER_REFERENCE_DESCRIPTION_BY_URL[link.url] ??
            "Reference used to explain or benchmark the AI water-estimation methodology."
        };
      }

      return {
        title: link.label,
        href: link.url
      };
    }

    return (
      <section>
        <h3 className="text-sm font-semibold text-ink">Sources</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {activeSources.map((link) => (
            <MethodologySourceCard key={link.url} {...buildCardData(link)} />
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="How it works"
        tabIndex={-1}
        className="absolute bottom-0 right-0 top-0 flex w-full max-w-2xl flex-col overflow-x-hidden bg-white shadow-2xl outline-none transition-transform duration-300"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/60 bg-white px-6 py-4">
          <h2 className="text-base font-semibold text-ink">How it works</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-secondary transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-6">
          {loading || !methodology ? (
            <div className="space-y-4">
              <SkeletonBlock className="h-20" />
              <SkeletonBlock className="h-32" />
              <SkeletonBlock className="h-48" />
            </div>
          ) : (
            <div className="space-y-8">
              <div className="inline-flex max-w-full flex-wrap self-start rounded-lg bg-surface-muted p-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      activeTab === tab.id ? "bg-white text-ink shadow-sm" : "text-ink-secondary hover:text-ink"
                    }`}
                    aria-pressed={activeTab === tab.id}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeTab === "prompts" ? (
                <div className="space-y-6">
                  <section>
                    <p className="text-[15px] leading-relaxed text-ink-secondary">
                      Prompts show how much local agent activity the dashboard could read and how that activity maps to
                      the bundled Portkey pricing snapshot used for model-cost weighting.
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                      Bundled pricing snapshot: {formatNumber(methodology.pricingCatalog.modelCount)} text-token model
                      entries across {formatNumber(methodology.pricingCatalog.providerCount)} providers, generated{" "}
                      {formatGeneratedAt(methodology.pricingCatalog.generatedAt)}.
                    </p>
                  </section>

                  <UsageSummaryMetrics
                    sessions={overview?.coverageSummary.sessions ?? 0}
                    prompts={overview?.coverageSummary.prompts ?? 0}
                    tokens={overview?.tokenTotals.supportedTokens ?? 0}
                  />
                  <ModelUsageStatusKey />

                  <section>
                    <h3 className="text-sm font-semibold text-ink">What counts</h3>
                    <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-secondary">
                      <p>
                        Sessions are distinct Codex and Claude Code runs. Prompts count readable user turns from local
                        logs, not just the turns that had enough token detail for water estimation.
                      </p>
                      <p>
                        Agent usage is grouped by canonical provider and model so repeated dated Claude IDs roll up into
                        one model row instead of fragmenting the ranking.
                      </p>
                    </div>
                  </section>

                  {topModels.length > 0 ? (
                    <section>
                      <h3 className="text-sm font-semibold text-ink">Agent usage by model</h3>
                      <div className="mt-3">
                        <ModelUsageList items={topModels} />
                      </div>
                    </section>
                  ) : null}

                  <section>
                    <h3 className="text-sm font-semibold text-ink">Model-cost formula</h3>
                    <div className="mt-3 space-y-2">
                      <code className="block overflow-x-hidden whitespace-normal break-words rounded-lg bg-slate-900 px-4 py-3 text-xs leading-6 text-slate-100">
                        eventCostUsd = input/1e6 * inputPrice + cachedInput/1e6 * cachedInputPrice + output/1e6 * outputPrice
                      </code>
                    </div>
                  </section>

                  <section>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <label className="flex-1">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink-tertiary">
                          Search models
                        </span>
                        <input
                          type="search"
                          value={searchValue}
                          onChange={(event) => setSearchValue(event.target.value)}
                          placeholder="Search provider or model"
                          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent"
                        />
                      </label>
                      <label className="sm:w-48">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-ink-tertiary">
                          Provider
                        </span>
                        <select
                          value={selectedProvider}
                          onChange={(event) => setSelectedProvider(event.target.value)}
                          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent"
                        >
                          <option value="all">All providers</option>
                          {providers.map((provider) => (
                            <option key={provider} value={provider}>
                              {provider}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>

                  <section>
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-ink">Priced model catalog</h3>
                      <p className="text-xs text-ink-tertiary">
                        Showing {formatNumber(filteredPricingTable.length)} of {formatNumber(methodology.pricingTable.length)} models
                      </p>
                    </div>
                    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200/60">
                      <div className="max-h-[26rem] overflow-y-auto overflow-x-hidden">
                        <table className="w-full table-fixed border-collapse text-left text-sm">
                          <thead className="sticky top-0 bg-surface-muted text-xs font-medium text-ink-secondary">
                            <tr>
                              <th className="w-[16%] px-3 py-2.5 font-medium">Provider</th>
                              <th className="w-[36%] px-3 py-2.5 font-medium">Model</th>
                              <th className="w-[16%] px-3 py-2.5 font-medium">Input</th>
                              <th className="w-[16%] px-3 py-2.5 font-medium">Cached</th>
                              <th className="w-[16%] px-3 py-2.5 font-medium">Output</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredPricingTable.map((entry) => (
                              <tr key={`${entry.provider}:${entry.model}`} className="border-t border-slate-200/60">
                                <td className="break-words px-3 py-2.5 align-top font-medium text-ink">{entry.provider}</td>
                                <td className="break-words px-3 py-2.5 align-top text-ink-secondary">{entry.model}</td>
                                <td className="break-words px-3 py-2.5 align-top text-ink-secondary">{formatUsdPerMillion(entry.inputUsdPerMillion)}</td>
                                <td className="break-words px-3 py-2.5 align-top text-ink-secondary">{formatUsdPerMillion(entry.cachedInputUsdPerMillion)}</td>
                                <td className="break-words px-3 py-2.5 align-top text-ink-secondary">{formatUsdPerMillion(entry.outputUsdPerMillion)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </section>

                  {overview && hasExceptions ? (
                    <section>
                      <h3 className="text-sm font-semibold text-ink">Why exclusions happen</h3>
                      <div className="mt-3 space-y-2">
                        {overview.exclusions.map((item) => (
                          <div key={`${item.provider}:${item.model}:${item.source}`} className="flex items-start gap-3 rounded-lg bg-surface-muted px-4 py-3">
                            <div className="mt-0.5 h-8 w-1 flex-shrink-0 rounded-full bg-accent" />
                            <div>
                              <p className="text-sm font-medium text-ink">
                                {item.provider} / {item.model}
                              </p>
                              <p className="mt-0.5 text-sm text-ink-secondary">
                                {item.source} · {formatNumber(item.tokens)} tokens — {item.reason.toLowerCase()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}

                  {renderSources()}
                </div>
              ) : null}

              {activeTab === "water" ? (
                <div className="space-y-8">
                  <section>
                    <p className="text-[15px] leading-relaxed text-ink-secondary">
                      Water estimates are calculated from local coding-agent token activity using pricing-weighted
                      normalization and published benchmark coefficients.
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-ink-secondary">
                      The scale chart mixes direct intake, embedded product footprints, and operational water use so
                      you can read your AI estimate as an order-of-magnitude marker rather than a like-for-like total.
                      Hovering the chart reveals what each point means, and the source cards below explain where each
                      comparison comes from.
                    </p>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-ink">Formulas</h3>
                    <div className="mt-3 space-y-2">
                      <code className="block overflow-x-hidden whitespace-normal break-words rounded-lg bg-surface-muted px-4 py-3 text-xs leading-6 text-ink-secondary">
                        waterLitres = eventCostUsd / referenceEventCostUsd * benchmarkCoefficient
                      </code>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-ink">Benchmark coefficients</h3>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div className="rounded-lg bg-surface-muted px-3 py-3">
                        <p className="text-xs text-ink-tertiary">Low</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{formatLitres(methodology.benchmarkCoefficients.low)}</p>
                      </div>
                      <div className="rounded-lg bg-surface-muted px-3 py-3">
                        <p className="text-xs text-ink-tertiary">Central</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{formatLitres(methodology.benchmarkCoefficients.central)}</p>
                      </div>
                      <div className="rounded-lg bg-surface-muted px-3 py-3">
                        <p className="text-xs text-ink-tertiary">High</p>
                        <p className="mt-1 text-sm font-semibold text-ink">{formatLitres(methodology.benchmarkCoefficients.high)}</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-semibold text-ink">Calibration</h3>
                    <div className="mt-3 rounded-lg bg-surface-muted px-4 py-3">
                      {methodology.calibration ? (
                        <p className="text-sm leading-relaxed text-ink-secondary">
                          Median event cost: {methodology.calibration.referenceEventCostUsd.toFixed(6)} USD across{" "}
                          {formatNumber(methodology.calibration.supportedEventCount)} supported events.
                        </p>
                      ) : (
                        <p className="text-sm leading-relaxed text-ink-secondary">
                          No supported events available for calibration yet.
                        </p>
                      )}
                    </div>
                  </section>

                  {overview && hasExceptions ? (
                    <section>
                      <h3 className="text-sm font-semibold text-ink">Exclusions</h3>
                      <div className="mt-3 space-y-2">
                        {overview.exclusions.map((item) => (
                          <div key={`${item.provider}:${item.model}:${item.source}`} className="flex items-start gap-3 rounded-lg bg-surface-muted px-4 py-3">
                            <div className="mt-0.5 h-8 w-1 flex-shrink-0 rounded-full bg-accent" />
                            <div>
                              <p className="text-sm font-medium text-ink">
                                {item.provider} / {item.model}
                              </p>
                              <p className="mt-0.5 text-sm text-ink-secondary">
                                {item.source} · {formatNumber(item.tokens)} tokens — {item.reason.toLowerCase()}
                              </p>
                            </div>
                          </div>
                        ))}
                        {overview.tokenTotals.unestimatedTokens > 0 ? (
                          <div className="flex items-start gap-3 rounded-lg bg-surface-muted px-4 py-3">
                            <div className="mt-0.5 h-8 w-1 flex-shrink-0 rounded-full bg-ink-tertiary" />
                            <div>
                              <p className="text-sm font-medium text-ink">Fallback-only sessions</p>
                              <p className="mt-0.5 text-sm text-ink-secondary">
                                {formatNumber(overview.tokenTotals.unestimatedTokens)} tokens without split data
                              </p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  {renderSources()}
                </div>
              ) : null}

              {activeTab === "energy" ? (
                <div className="space-y-6">
                  <section className="space-y-3">
                    <p className="text-[15px] leading-relaxed text-ink-secondary">
                      Energy estimates are not live yet. This tab will explain how token activity maps to electricity
                      use once the model is implemented.
                    </p>
                    <div className="rounded-lg bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-secondary">
                      For now, water is the only fully implemented footprint estimate in this dashboard.
                    </div>
                  </section>

                  {renderSources()}
                </div>
              ) : null}

              {activeTab === "carbon" ? (
                <div className="space-y-6">
                  <section className="space-y-3">
                    <p className="text-[15px] leading-relaxed text-ink-secondary">
                      Carbon estimates are also still upcoming. When this lands, it will sit alongside water and energy
                      so you can compare the same local usage across multiple footprint views.
                    </p>
                    <div className="rounded-lg bg-surface-muted px-4 py-3 text-sm leading-relaxed text-ink-secondary">
                      Nothing is being estimated for carbon yet, so this tab is intentionally descriptive rather than
                      formula-driven.
                    </div>
                  </section>

                  {renderSources()}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

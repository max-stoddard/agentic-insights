import { createHash } from "node:crypto";
import type { PricingEntry } from "@agentic-insights/shared";
import type { GeneratedPricingCatalog } from "./pricing-catalog-transform.js";

export const MONITORED_PRICING_PROVIDERS = ["anthropic", "dashscope", "google", "openai", "openrouter"] as const;

export type PricingField = "inputUsdPerMillion" | "cachedInputUsdPerMillion" | "outputUsdPerMillion";
export type PricingChangeKind = "added" | "removed" | "repriced";

export interface PricingFieldChange {
  field: PricingField;
  before: number;
  after: number;
  percentageChange: number | null;
}

export interface PricingCatalogChange {
  provider: string;
  model: string;
  kind: PricingChangeKind;
  fields: PricingFieldChange[];
}

export interface PricingProviderSummary {
  provider: string;
  added: number;
  removed: number;
  repriced: number;
}

export interface PricingCatalogDiffReport {
  sourceRevision: string;
  generatedAt: string;
  monitoredProviders: string[];
  decision: "no-change" | "safe" | "blocked";
  approvedSuspiciousChange: boolean;
  fingerprint: string;
  hardFailures: string[];
  suspiciousReasons: string[];
  providerSummaries: PricingProviderSummary[];
  changes: PricingCatalogChange[];
  totalCatalogChangeCount: number;
}

const PRICE_FIELDS: PricingField[] = [
  "inputUsdPerMillion",
  "cachedInputUsdPerMillion",
  "outputUsdPerMillion"
];

export function validateSuspiciousApprovalRequest(
  approveSuspicious: boolean,
  sourceRevision: string | null
): void {
  if (approveSuspicious && !sourceRevision) {
    throw new Error("Suspicious pricing approval requires an exact Portkey commit SHA.");
  }
  if (sourceRevision && !/^[a-f0-9]{40,64}$/i.test(sourceRevision)) {
    throw new Error("Portkey source revision must be an exact 40-64 character hexadecimal commit SHA.");
  }
}

function entryKey(entry: PricingEntry): string {
  return `${entry.provider.trim().toLowerCase()}:${entry.model.trim().toLowerCase()}`;
}

function priceSignature(entry: PricingEntry): string {
  return PRICE_FIELDS.map((field) => entry[field]).join(":");
}

function getPercentageChange(before: number, after: number): number | null {
  if (before === 0) {
    return after === 0 ? 0 : null;
  }

  return Math.abs(after - before) / Math.abs(before);
}

function buildChanges(current: GeneratedPricingCatalog, candidate: GeneratedPricingCatalog): PricingCatalogChange[] {
  const currentEntries = new Map(current.entries.map((entry) => [entryKey(entry), entry]));
  const candidateEntries = new Map(candidate.entries.map((entry) => [entryKey(entry), entry]));
  const keys = [...new Set([...currentEntries.keys(), ...candidateEntries.keys()])].sort();
  const changes: PricingCatalogChange[] = [];

  for (const key of keys) {
    const before = currentEntries.get(key);
    const after = candidateEntries.get(key);

    if (!before && after) {
      changes.push({ provider: after.provider, model: after.model, kind: "added", fields: [] });
      continue;
    }

    if (before && !after) {
      changes.push({ provider: before.provider, model: before.model, kind: "removed", fields: [] });
      continue;
    }

    if (!before || !after || priceSignature(before) === priceSignature(after)) {
      continue;
    }

    const fields = PRICE_FIELDS.flatMap((field): PricingFieldChange[] =>
      before[field] === after[field]
        ? []
        : [
            {
              field,
              before: before[field],
              after: after[field],
              percentageChange: getPercentageChange(before[field], after[field])
            }
          ]
    );
    changes.push({ provider: after.provider, model: after.model, kind: "repriced", fields });
  }

  return changes;
}

function getDuplicateSignatures(catalog: GeneratedPricingCatalog): Map<string, string> {
  const groupedEntries = new Map<string, PricingEntry[]>();
  for (const entry of catalog.entries) {
    const key = entryKey(entry);
    const entries = groupedEntries.get(key) ?? [];
    entries.push(entry);
    groupedEntries.set(key, entries);
  }

  return new Map(
    [...groupedEntries.entries()]
      .filter(([, entries]) => entries.length > 1)
      .map(([key, entries]) => [
        key,
        JSON.stringify(
          entries
            .map((entry) => [entry.model, ...PRICE_FIELDS.map((field) => entry[field])])
            .sort((left, right) => String(left[0]).localeCompare(String(right[0])))
        )
      ])
  );
}

function validateCatalog(
  current: GeneratedPricingCatalog,
  catalog: GeneratedPricingCatalog,
  monitoredProviders: Set<string>
): string[] {
  const failures: string[] = [];
  const providers = new Set(catalog.providerSources.map((source) => source.provider));
  const currentDuplicateSignatures = getDuplicateSignatures(current);
  const candidateDuplicateSignatures = getDuplicateSignatures(catalog);

  if (!/^[a-f0-9]{40,64}$/i.test(catalog.metadata.sourceRevision)) {
    failures.push("The candidate catalog does not identify an exact Portkey commit SHA.");
  }
  if (!Number.isFinite(Date.parse(catalog.metadata.generatedAt))) {
    failures.push("The candidate catalog has an invalid generatedAt timestamp.");
  }
  if (catalog.metadata.providerCount !== catalog.providerSources.length) {
    failures.push("The provider count does not match the generated provider sources.");
  }
  if (catalog.metadata.modelCount !== catalog.entries.length) {
    failures.push("The model count does not match the generated pricing entries.");
  }

  for (const provider of monitoredProviders) {
    if (!providers.has(provider) || !catalog.entries.some((entry) => entry.provider === provider)) {
      failures.push(`Monitored provider ${provider} is missing or empty.`);
    }
  }

  for (const source of catalog.providerSources) {
    if (!source.sourceUrl.includes(`/${catalog.metadata.sourceRevision}/`)) {
      failures.push(`Unpinned provider source URL for ${source.provider}.`);
    }
  }

  for (const [key, signature] of candidateDuplicateSignatures) {
    const provider = key.slice(0, key.indexOf(":"));
    if (monitoredProviders.has(provider) || currentDuplicateSignatures.get(key) !== signature) {
      failures.push(`New or changed duplicate pricing identity: ${key}.`);
    }
  }

  for (const entry of catalog.entries) {
    const key = entryKey(entry);
    for (const field of PRICE_FIELDS) {
      if (!Number.isFinite(entry[field]) || entry[field] < 0) {
        failures.push(`Invalid ${field} for ${key}.`);
      }
    }

    if (!entry.sourceUrl.includes(`/${catalog.metadata.sourceRevision}/`)) {
      failures.push(`Unpinned source URL for ${key}.`);
    }
  }

  return [...new Set(failures)].sort();
}

function summarizeProviders(changes: PricingCatalogChange[]): PricingProviderSummary[] {
  const summaries = new Map<string, PricingProviderSummary>();
  for (const change of changes) {
    const summary = summaries.get(change.provider) ?? {
      provider: change.provider,
      added: 0,
      removed: 0,
      repriced: 0
    };
    summary[change.kind] += 1;
    summaries.set(change.provider, summary);
  }

  return [...summaries.values()].sort((left, right) => left.provider.localeCompare(right.provider));
}

function fingerprintReport(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function diffPricingCatalogs(
  current: GeneratedPricingCatalog,
  candidate: GeneratedPricingCatalog,
  options: { monitoredProviders?: readonly string[]; approveSuspicious?: boolean } = {}
): PricingCatalogDiffReport {
  const monitoredProviders = [...(options.monitoredProviders ?? MONITORED_PRICING_PROVIDERS)].sort();
  const monitoredSet = new Set(monitoredProviders);
  const allChanges = buildChanges(current, candidate);
  const changes = allChanges.filter((change) => monitoredSet.has(change.provider));
  const providerSummaries = summarizeProviders(changes);
  const hardFailures = validateCatalog(current, candidate, monitoredSet);
  const suspiciousReasons: string[] = [];

  for (const change of changes) {
    if (change.kind === "removed") {
      suspiciousReasons.push(`Monitored model removed: ${change.provider}:${change.model}.`);
    }

    for (const field of change.fields) {
      if ((field.before === 0) !== (field.after === 0)) {
        suspiciousReasons.push(
          `Price changed between zero and non-zero for ${change.provider}:${change.model} ${field.field}.`
        );
      } else if (field.percentageChange !== null && field.percentageChange > 0.2) {
        suspiciousReasons.push(
          `Price moved more than 20% for ${change.provider}:${change.model} ${field.field}.`
        );
      }
    }
  }

  for (const summary of providerSummaries) {
    if (summary.added + summary.removed + summary.repriced > 20) {
      suspiciousReasons.push(`More than 20 models changed for monitored provider ${summary.provider}.`);
    }
  }

  const uniqueSuspiciousReasons = [...new Set(suspiciousReasons)].sort();
  const approvedSuspiciousChange = Boolean(options.approveSuspicious && uniqueSuspiciousReasons.length > 0);
  const decision =
    hardFailures.length > 0 || (uniqueSuspiciousReasons.length > 0 && !approvedSuspiciousChange)
      ? "blocked"
      : changes.length === 0
        ? "no-change"
        : "safe";
  const fingerprint = fingerprintReport({
    hardFailures,
    suspiciousReasons: uniqueSuspiciousReasons,
    changes
  });

  return {
    sourceRevision: candidate.metadata.sourceRevision,
    generatedAt: candidate.metadata.generatedAt,
    monitoredProviders,
    decision,
    approvedSuspiciousChange,
    fingerprint,
    hardFailures,
    suspiciousReasons: uniqueSuspiciousReasons,
    providerSummaries,
    changes,
    totalCatalogChangeCount: allChanges.length
  };
}

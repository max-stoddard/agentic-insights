import type { HighSpendSessionEntry } from "@agentic-insights/shared";
import { formatCarbon, formatDateTime, formatEnergy, formatNumber, formatScaledLitres, formatUsdCost } from "../lib/format";
import { FootprintIcon } from "./FootprintIcon";

interface HighestSpendSessionsCardProps {
  sessions: HighSpendSessionEntry[];
}

function ImpactChip({
  label,
  property,
  value
}: {
  label: string;
  property: "water" | "energy" | "carbon";
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-ink-secondary">
      <span className="text-slate-500" aria-hidden="true">
        <FootprintIcon property={property} className="h-3.5 w-3.5" />
      </span>
      <span className="sr-only">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function formatModelLabel(session: HighSpendSessionEntry): string {
  return `${session.primaryProvider} / ${session.primaryModel}`;
}

function formatAdditionalModels(count: number): string | null {
  if (count <= 0) {
    return null;
  }

  return `+${count} more ${count === 1 ? "model" : "models"}`;
}

export function HighestSpendSessionsCard({ sessions }: HighestSpendSessionsCardProps) {
  return (
    <section className="card px-6 py-5 sm:px-8 sm:py-6" data-testid="highest-spend-sessions-card">
      <div>
        <h2 className="text-base font-semibold text-ink">Highest spend sessions</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-ink-secondary">
          Rank the sessions that drove the most estimated spend so you can quickly connect costly conversations to their
          tokens, prompts, models, and estimated footprint.
        </p>
      </div>

      {sessions.length > 0 ? (
        <>
          <div className="mt-5 space-y-3 md:hidden">
            {sessions.map((session, index) => {
              const additionalModels = formatAdditionalModels(session.additionalModelCount);
              return (
                <article key={session.sessionId} className="rounded-xl border border-slate-200/80 bg-surface-muted px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-secondary">#{index + 1}</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{session.title}</p>
                      {session.statusNote ? (
                        <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{session.statusNote}</p>
                      ) : null}
                    </div>
                    <p className="flex-shrink-0 text-sm font-semibold text-ink">{formatUsdCost(session.apiCostUsd)}</p>
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <dt className="text-xs uppercase tracking-[0.08em] text-ink-secondary">Model</dt>
                      <dd className="mt-1 text-ink">
                        {formatModelLabel(session)}
                        {additionalModels ? <span className="block text-xs text-ink-secondary">{additionalModels}</span> : null}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.08em] text-ink-secondary">Last active</dt>
                      <dd className="mt-1 text-xs text-ink-secondary">{formatDateTime(session.lastActiveAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.08em] text-ink-secondary">Prompts</dt>
                      <dd className="mt-1 text-ink">{formatNumber(session.promptCount)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-[0.08em] text-ink-secondary">Tokens</dt>
                      <dd className="mt-1 text-ink">{formatNumber(session.totalTokens)}</dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ImpactChip label="Water" property="water" value={formatScaledLitres(session.waterLitres.central)} />
                    <ImpactChip label="Energy" property="energy" value={formatEnergy(session.energyKwh)} />
                    <ImpactChip label="Carbon" property="carbon" value={formatCarbon(session.carbonKgCo2)} />
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-5 hidden md:block">
            <table className="w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-xs uppercase tracking-[0.08em] text-ink-secondary">
                <th scope="col" className="border-b border-slate-200/80 pb-3 pr-4 font-medium">#</th>
                <th scope="col" className="border-b border-slate-200/80 pb-3 pr-5 font-medium">Session</th>
                <th scope="col" className="border-b border-slate-200/80 pb-3 pr-5 font-medium">Model</th>
                <th scope="col" className="w-28 border-b border-slate-200/80 pb-3 pr-4 font-medium">Last active</th>
                <th scope="col" className="border-b border-slate-200/80 pb-3 pr-5 text-right font-medium">Prompts</th>
                <th scope="col" className="border-b border-slate-200/80 pb-3 pr-5 text-right font-medium">Tokens</th>
                <th scope="col" className="border-b border-slate-200/80 pb-3 pr-5 text-right font-medium">Spend</th>
                <th scope="col" className="border-b border-slate-200/80 pb-3 font-medium">Impact</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session, index) => {
                const additionalModels = formatAdditionalModels(session.additionalModelCount);
                return (
                  <tr key={session.sessionId} className="align-top">
                    <td className="border-b border-slate-200/60 py-4 pr-4 text-sm font-semibold text-ink">{index + 1}</td>
                    <td className="border-b border-slate-200/60 py-4 pr-5">
                      <p className="max-w-xs text-sm font-medium text-ink">{session.title}</p>
                      {session.statusNote ? (
                        <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{session.statusNote}</p>
                      ) : null}
                    </td>
                    <td className="border-b border-slate-200/60 py-4 pr-5">
                      <p className="text-sm font-medium text-ink">{formatModelLabel(session)}</p>
                      {additionalModels ? (
                        <p className="mt-1 text-xs text-ink-secondary">{additionalModels}</p>
                      ) : null}
                    </td>
                    <td className="w-28 border-b border-slate-200/60 py-4 pr-4 text-xs text-ink-secondary whitespace-nowrap">
                      {formatDateTime(session.lastActiveAt)}
                    </td>
                    <td className="border-b border-slate-200/60 py-4 pr-5 text-right text-sm text-ink whitespace-nowrap">
                      {formatNumber(session.promptCount)}
                    </td>
                    <td className="border-b border-slate-200/60 py-4 pr-5 text-right text-sm text-ink whitespace-nowrap">
                      {formatNumber(session.totalTokens)}
                    </td>
                    <td className="border-b border-slate-200/60 py-4 pr-5 text-right text-sm font-semibold text-ink whitespace-nowrap">
                      {formatUsdCost(session.apiCostUsd)}
                    </td>
                    <td className="border-b border-slate-200/60 py-4">
                      <div className="flex flex-wrap gap-2">
                        <ImpactChip label="Water" property="water" value={formatScaledLitres(session.waterLitres.central)} />
                        <ImpactChip label="Energy" property="energy" value={formatEnergy(session.energyKwh)} />
                        <ImpactChip label="Carbon" property="carbon" value={formatCarbon(session.carbonKgCo2)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-secondary">
          No priced sessions have been indexed yet, so there is no spend ranking to show.
        </p>
      )}
    </section>
  );
}

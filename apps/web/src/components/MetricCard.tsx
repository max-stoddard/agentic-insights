import type { ReactNode } from "react";

interface MetricCardProps {
  eyebrow: string;
  title: string;
  value: string;
  detail: string;
  footer?: ReactNode;
  tone?: "default" | "feature";
  size?: "default" | "compact";
  className?: string;
}

function joinClasses(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

export function MetricCard({
  eyebrow,
  title,
  value,
  detail,
  footer,
  tone = "default",
  size = "default",
  className
}: MetricCardProps) {
  const featured = tone === "feature";
  const compact = size === "compact";

  return (
    <article
      className={joinClasses(
        "flex h-full flex-col rounded-[28px] border px-5 py-5 shadow-[0_24px_70px_-56px_rgba(28,25,23,0.35)] sm:px-6 sm:py-6",
        featured
          ? "border-stone-900 bg-stone-950 text-stone-50"
          : "border-stone-200/80 bg-white/90 text-stone-950",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={joinClasses(
              "text-[0.68rem] font-semibold uppercase tracking-[0.22em]",
              featured ? "text-cyan-200" : "text-stone-500"
            )}
          >
            {eyebrow}
          </p>
          <p className={joinClasses("mt-3 text-base font-medium", featured ? "text-stone-300" : "text-stone-700")}>
            {title}
          </p>
        </div>
        <div
          className={joinClasses(
            "rounded-2xl border px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.24em]",
            featured
              ? "border-white/10 bg-white/5 text-cyan-200"
              : "border-stone-200 bg-stone-50 text-stone-500"
          )}
        >
          {featured ? "Primary" : "Snapshot"}
        </div>
      </div>

      <p
        className={joinClasses(
          "mt-8 font-semibold tracking-[-0.06em]",
          featured ? "text-5xl text-white sm:text-6xl" : compact ? "text-[1.9rem] text-stone-950" : "text-4xl text-stone-950"
        )}
      >
        {value}
      </p>
      <p className={joinClasses("mt-4 text-sm leading-6", featured ? "text-stone-300" : "text-stone-600")}>{detail}</p>

      {footer ? (
        <div
          className={joinClasses(
            "mt-auto pt-6 text-sm",
            featured ? "border-t border-white/10 text-stone-400" : "border-t border-stone-200 text-stone-600"
          )}
        >
          {footer}
        </div>
      ) : null}
    </article>
  );
}

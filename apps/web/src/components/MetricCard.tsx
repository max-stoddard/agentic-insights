import type { ReactNode } from "react";

interface MetricCardProps {
  eyebrow: string;
  title: string;
  value: string;
  detail: string;
  footer?: ReactNode;
  aside?: ReactNode;
  tone?: "default" | "feature";
  className?: string;
  eyebrowClassName?: string;
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
  aside,
  tone = "default",
  className,
  eyebrowClassName
}: MetricCardProps) {
  const featured = tone === "feature";

  return (
    <article
      className={joinClasses(
        "flex flex-col rounded-xl p-6 sm:p-8",
        featured ? "card-dark" : "card",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className={joinClasses(
              "text-sm font-medium",
              featured ? "text-accent-light" : "text-ink-secondary",
              eyebrowClassName
            )}
          >
            {eyebrow}
          </p>
          <p className={joinClasses("mt-1.5 text-sm", featured ? "text-slate-300" : "text-ink-secondary")}>
            {title}
          </p>
        </div>
        {aside ? <div className="flex-shrink-0">{aside}</div> : null}
      </div>

      <p
        className={joinClasses(
          "mt-6 font-bold tracking-[-0.04em]",
          featured
            ? "text-4xl text-white sm:text-5xl lg:text-6xl"
            : "text-3xl text-ink sm:text-4xl"
        )}
      >
        {value}
      </p>
      <p className={joinClasses("mt-3 text-[15px] leading-relaxed", featured ? "text-slate-300" : "text-ink-secondary")}>
        {detail}
      </p>

      {footer ? (
        <div
          className={joinClasses(
            "mt-auto pt-5 text-sm",
            featured ? "border-t border-white/10 text-slate-400" : "border-t border-slate-200/60 text-ink-secondary"
          )}
        >
          {footer}
        </div>
      ) : null}
    </article>
  );
}

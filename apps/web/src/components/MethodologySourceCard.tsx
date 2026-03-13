interface MethodologySourceCardProps {
  title: string;
  href: string;
  linkLabel?: string;
  badges?: string[];
  value?: string;
  description?: string;
  note?: string;
}

export function MethodologySourceCard({
  title,
  href,
  linkLabel = title,
  badges,
  value,
  description,
  note
}: MethodologySourceCardProps) {
  return (
    <article
      data-testid="methodology-source-card"
      className="rounded-xl border border-slate-200/70 bg-surface-muted/60 px-4 py-4"
    >
      {badges && badges.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <span
              key={badge}
              className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-xs font-medium text-ink-secondary"
            >
              {badge}
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-2 text-sm font-semibold text-ink">{title}</p>
      {value ? <p className="mt-1 text-sm text-ink-secondary">{value}</p> : null}
      {description ? <p className="mt-2 text-sm leading-relaxed text-ink-secondary">{description}</p> : null}
      {note ? <p className="mt-2 text-xs leading-relaxed text-ink-tertiary">{note}</p> : null}
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-3 block text-sm font-medium text-accent no-underline transition-colors hover:text-accent-hover"
      >
        {linkLabel}
      </a>
    </article>
  );
}

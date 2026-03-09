import type { ReactNode } from "react";

interface MetricCardProps {
  eyebrow: string;
  title: string;
  value: string;
  detail: string;
  footer?: ReactNode;
}

export function MetricCard({ eyebrow, title, value, detail, footer }: MetricCardProps) {
  return (
    <article className="metric-card shimmer-panel">
      <div className="metric-header">
        <p className="metric-eyebrow">{eyebrow}</p>
        <h2 className="metric-title">{title}</h2>
      </div>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
      {footer ? <div className="metric-footer">{footer}</div> : null}
    </article>
  );
}

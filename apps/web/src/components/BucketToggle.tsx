import type { Bucket } from "@ai-water-usage/shared";

const options: Bucket[] = ["day", "week", "month"];

interface BucketToggleProps {
  active: Bucket;
  onChange: (bucket: Bucket) => void;
}

export function BucketToggle({ active, onChange }: BucketToggleProps) {
  return (
    <div className="bucket-toggle shimmer-panel" role="tablist" aria-label="Water aggregation">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="tab"
          aria-selected={active === option}
          className={active === option ? "bucket-button is-active" : "bucket-button"}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

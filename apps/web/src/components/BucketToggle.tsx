import type { KeyboardEvent } from "react";
import type { Bucket } from "@ai-water-usage/shared";

const options: Array<{ label: string; value: Bucket }> = [
  { label: "Day", value: "day" },
  { label: "Week", value: "week" },
  { label: "Month", value: "month" }
];

interface BucketToggleProps {
  active: Bucket;
  onChange: (bucket: Bucket) => void;
}

function nextIndex(index: number, direction: 1 | -1): number {
  return (index + direction + options.length) % options.length;
}

export function BucketToggle({ active, onChange }: BucketToggleProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      onChange(options[nextIndex(index, 1)]!.value);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onChange(options[nextIndex(index, -1)]!.value);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      onChange(options[0]!.value);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      onChange(options[options.length - 1]!.value);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Water aggregation"
      className="inline-flex w-full rounded-full border border-stone-200 bg-stone-100/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] sm:w-auto"
    >
      {options.map((option, index) => {
        const selected = option.value === active;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={
              selected
                ? "min-w-[5.25rem] rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_-18px_rgba(28,25,23,0.75)] transition"
                : "min-w-[5.25rem] rounded-full px-4 py-2.5 text-sm font-medium text-stone-600 transition hover:text-stone-950"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

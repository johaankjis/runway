"use client";

import { cn } from "@/lib/cn";

export interface FilterOption<K extends string> {
  key: K;
  label: string;
  count?: number;
}

export function FilterPills<K extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
              active
                ? "border-navy-900 bg-navy-900 text-white"
                : "border-line-strong bg-white text-ink-soft hover:border-navy-600 hover:text-ink",
            )}
          >
            {option.label}
            {option.count != null ? (
              <span className={cn("tabular", active ? "text-white/70" : "text-muted")}>
                ({option.count})
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

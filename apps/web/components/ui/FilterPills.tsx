"use client";

import { cn } from "@/lib/cn";

export interface FilterOption<K extends string> {
  key: K;
  label: string;
  count?: number;
}

/**
 * Segmented filter pills: the active option is a solid navy pill, the rest sit
 * on a soft gray fill. Used for list filters and lightweight mode switches.
 */
export function FilterPills<K extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: {
  options: FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap items-center gap-2", className)}>
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full font-semibold transition-colors",
              size === "sm" ? "h-7 px-3 text-[12px]" : "h-8 px-3.5 text-[12.5px]",
              active
                ? "bg-navy-900 text-white shadow-sm"
                : "bg-slate-100 text-ink-soft hover:bg-slate-200/80 hover:text-ink",
            )}
          >
            {option.label}
            {option.count != null ? (
              <span className={cn("tabular font-medium", active ? "text-white/75" : "text-muted")}>
                ({option.count})
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { cn } from "@/lib/cn";

export interface TabOption<K extends string> {
  key: K;
  label: string;
}

export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
}: {
  tabs: TabOption<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-6 border-b border-line", className)}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              "-mb-px border-b-2 px-0.5 pb-2.5 pt-1 text-[13px] font-medium transition-colors",
              active
                ? "border-info-600 text-ink"
                : "border-transparent text-muted hover:border-line-strong hover:text-ink-soft",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

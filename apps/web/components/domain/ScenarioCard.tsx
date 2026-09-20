"use client";

import type { ScenarioResult } from "@runway/contracts";
import { ArrowDownRight, ArrowUpRight, Check, Minus } from "lucide-react";

import { Skeleton } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import type { QuickScenario } from "@/lib/scenarios";

export function ScenarioCard({
  scenario,
  result,
  loading,
  error,
  selected,
  onSelect,
}: {
  scenario: QuickScenario;
  result: ScenarioResult | null;
  loading: boolean;
  error: Error | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const runway = result?.projected.cash_runway_days ?? null;
  const baseRunway = result?.baseline.cash_runway_days ?? null;
  const delta = runway != null && baseRunway != null ? runway - baseRunway : null;
  const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "relative flex w-full flex-col items-start rounded-2xl border p-5 text-left transition-all",
        selected
          ? "border-info-500 bg-info-50/50 shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
          : "border-line bg-white hover:border-line-strong hover:shadow-card-hover",
      )}
    >
      {selected ? (
        <span
          aria-hidden
          className="absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full bg-info-600 text-white"
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </span>
      ) : null}
      <p className={cn("pr-6 text-[14.5px] font-semibold", selected ? "text-info-600" : "text-ink")}>{scenario.title}</p>
      <p className="mt-1 text-[12.5px] text-muted">{scenario.subtitle}</p>
      <div className="mt-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ) : error ? (
          <p className="text-xs font-medium text-danger-600">Unavailable</p>
        ) : result ? (
          <>
            <p className="tabular text-[28px] font-bold leading-none tracking-tight text-ink">
              {runway != null ? `${runway} days` : "No burn"}
            </p>
            <p
              className={cn(
                "mt-2 flex items-center gap-1 text-[13px] font-semibold",
                delta == null || delta === 0 ? "text-muted" : delta > 0 ? "text-success-600" : "text-danger-600",
              )}
            >
              <DeltaIcon className="h-3.5 w-3.5" aria-hidden />
              {delta == null ? "n/a" : delta === 0 ? "No change" : `${delta > 0 ? "+" : ""}${delta} days`}
            </p>
          </>
        ) : null}
      </div>
    </button>
  );
}

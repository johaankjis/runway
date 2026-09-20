"use client";

import type { FinancialState, Signal } from "@runway/contracts";
import { AlertCircle, ArrowRight, CheckCircle2, Volume2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatCents, formatDate } from "@/lib/format";
import { effectHeadline, effectTone, impactTone, sortByImpact } from "@/lib/presentation";

import { SignalIcon } from "./SignalIcon";

export function AlertCard({ state, signals }: { state: FinancialState; signals: Signal[] }) {
  const runway = state.cash_runway_days;
  const shortfall = state.projected_shortfall_cents;
  const drivers = sortByImpact(signals).slice(0, 5);
  const isCritical = shortfall > 0 || (runway != null && runway <= 30);

  return (
    <section
      aria-labelledby="alert-heading"
      className={cn(
        "grid grid-cols-1 gap-6 rounded-2xl border p-6 shadow-card lg:grid-cols-[1.3fr_1fr] lg:gap-8",
        isCritical ? "border-danger-100 bg-[#FFF5F5]" : "border-success-100 bg-success-50/60",
      )}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full text-white",
              isCritical ? "bg-danger-500 shadow-[0_0_0_6px_rgba(225,29,72,0.10)]" : "bg-success-500 shadow-[0_0_0_6px_rgba(16,185,129,0.12)]",
            )}
          >
            {isCritical ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <span
            className={cn(
              "text-[11.5px] font-bold uppercase tracking-[0.14em]",
              isCritical ? "text-danger-600" : "text-success-600",
            )}
          >
            {isCritical ? "Cash flow alert" : "Cash flow status"}
          </span>
        </div>

        <h2 id="alert-heading" className="mt-4 text-[30px] font-bold leading-[1.15] tracking-tight text-ink">
          {shortfall > 0 ? (
            <>Projected shortfall in {runway != null ? `${runway} days` : "the forecast window"}</>
          ) : (
            <>Cash position is on track</>
          )}
        </h2>

        <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-ink-soft">
          {shortfall > 0 ? (
            <>
              Based on scheduled cash flow, your business is projected to be{" "}
              <strong className="font-semibold text-ink">{formatCents(shortfall)}</strong> short of its minimum
              reserve by {formatDate(state.forecast_end_date)}. At the current burn rate, cash runway is{" "}
              <strong className="font-semibold text-ink">
                {runway != null ? `${runway} days` : "not measurable"}
              </strong>
              .
            </>
          ) : (
            <>
              Projected ending cash of {formatCents(state.projected_ending_cash_cents)} stays above the{" "}
              {formatCents(state.minimum_cash_reserve_cents)} reserve through {formatDate(state.forecast_end_date)}.
            </>
          )}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button href="/cash-flow" size="lg" iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}>
            View details
          </Button>
          <Button href="/voice" size="lg" variant="secondary" icon={<Volume2 className="h-4 w-4" aria-hidden />}>
            Hear summary
          </Button>
        </div>
      </div>

      <div className={cn("border-t pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1", isCritical ? "border-danger-100" : "border-success-100")}>
        <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-ink-soft">Key drivers</p>
        <ul className="mt-3.5 space-y-3.5">
          {drivers.map((signal) => {
            const headline = effectHeadline(signal.financial_effect);
            const tone = effectTone(signal.financial_effect) === "neutral" ? impactTone[signal.impact_level] : effectTone(signal.financial_effect);
            return (
              <li key={signal.id}>
                <Link
                  href={`/signals/${signal.id}`}
                  className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-white/70"
                >
                  <SignalIcon signal={signal} tone={tone} size="sm" className="mt-0.5 bg-white" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink group-hover:underline">
                      {signal.title}
                    </span>
                    <span className="block text-[12px] text-muted">
                      {headline ?? signal.financial_effect.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

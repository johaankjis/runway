"use client";

import type { FinancialState, Signal } from "@runway/contracts";
import { AlertCircle, ArrowRight, Volume2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/Button";
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
      className="grid grid-cols-1 gap-6 rounded-2xl border border-danger-100 bg-white p-6 shadow-card lg:grid-cols-[1.35fr_1fr]"
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid h-8 w-8 place-items-center rounded-full bg-danger-500 text-white shadow-[0_0_0_6px_rgba(225,29,72,0.10)]"
          >
            <AlertCircle className="h-[18px] w-[18px]" />
          </span>
          <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-danger-600">
            {isCritical ? "Cash flow alert" : "Cash flow status"}
          </span>
        </div>

        <h2 id="alert-heading" className="mt-3 text-[30px] font-bold leading-tight tracking-tight text-ink">
          {shortfall > 0 ? (
            <>
              Projected shortfall in{" "}
              <span className="text-danger-600">{runway != null ? `${runway} days` : "the forecast window"}</span>
            </>
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

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Button href="/cash-flow" iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}>
            View details
          </Button>
          <Button href="/voice" variant="secondary" icon={<Volume2 className="h-4 w-4" aria-hidden />}>
            Hear summary
          </Button>
        </div>
      </div>

      <div className="border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Key drivers</p>
        <ul className="mt-3 space-y-3">
          {drivers.map((signal) => {
            const headline = effectHeadline(signal.financial_effect);
            return (
              <li key={signal.id}>
                <Link
                  href={`/signals/${signal.id}`}
                  className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-slate-50"
                >
                  <SignalIcon signal={signal} tone={effectTone(signal.financial_effect) === "neutral" ? impactTone[signal.impact_level] : effectTone(signal.financial_effect)} size="sm" className="mt-0.5" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink group-hover:underline">
                      {signal.title}
                    </span>
                    <span className="block text-[11.5px] text-muted">
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

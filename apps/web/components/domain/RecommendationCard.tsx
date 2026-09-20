"use client";

import type { Recommendation, Signal } from "@runway/contracts";
import { ArrowRight, Landmark, PhoneCall, ShieldCheck, Store, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { horizonFor, horizonLabel, horizonTone } from "@/lib/presentation";

const iconById: Record<string, LucideIcon> = {
  "recommendation-collect-inv-1042": PhoneCall,
  "recommendation-protect-payroll": ShieldCheck,
  "recommendation-review-supplier-mix": Store,
};

const actionLabel: Record<ReturnType<typeof horizonFor>, string> = {
  immediate: "Take action",
  short_term: "View details",
  long_term: "Plan now",
};

export function RecommendationCard({
  recommendation,
  signalsById,
  compact = false,
}: {
  recommendation: Recommendation;
  signalsById: Map<string, Signal>;
  compact?: boolean;
}) {
  const horizon = horizonFor(recommendation);
  const Icon = iconById[recommendation.id] ?? Landmark;
  const urgent = horizon === "immediate";
  const relatedSignals = recommendation.related_signal_ids
    .map((id) => signalsById.get(id))
    .filter((signal): signal is Signal => !!signal);
  const primarySignal = relatedSignals[0];

  return (
    <article
      className={cn(
        "flex items-start gap-4 rounded-2xl border bg-white transition-shadow hover:shadow-card-hover",
        compact ? "p-4" : "p-5",
        urgent ? "border-danger-100 bg-danger-50/50" : "border-line",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center ring-1",
          compact ? "h-10 w-10 rounded-lg" : "h-12 w-12 rounded-xl",
          urgent ? "bg-danger-500 text-white ring-danger-500" : "bg-slate-50 text-ink-soft ring-line",
        )}
      >
        <Icon className={compact ? "h-[18px] w-[18px]" : "h-5 w-5"} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={cn("font-semibold text-ink", compact ? "text-[14px]" : "text-[15px]")}>{recommendation.title}</h3>
          <Pill tone={horizonTone[horizon]} className={compact ? undefined : "sm:hidden"}>
            {horizonLabel[horizon]}
          </Pill>
        </div>
        <p className="mt-1 text-[12.5px] text-ink-soft">{recommendation.description}</p>
        {!compact ? (
          <div className="mt-2.5 space-y-1.5 text-[12px] text-muted">
            <p>
              <span className="font-semibold uppercase tracking-wide text-[10.5px] text-muted">Why</span>{" "}
              {recommendation.rationale}
            </p>
            {relatedSignals.length ? (
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="font-semibold uppercase tracking-wide text-[10.5px] text-muted">Related</span>
                {relatedSignals.map((signal, index) => (
                  <Link
                    key={signal.id}
                    href={`/signals/${signal.id}`}
                    className="rounded text-ink underline-offset-2 hover:underline"
                  >
                    {signal.title}
                    {index < relatedSignals.length - 1 ? "," : ""}
                  </Link>
                ))}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={cn("hidden shrink-0 items-center gap-4 sm:flex", !compact && "self-center")}>
        {!compact ? (
          <Pill tone={horizonTone[horizon]} className="px-3 py-1">
            {horizonLabel[horizon]}
          </Pill>
        ) : null}
        <Button
          href={primarySignal ? `/signals/${primarySignal.id}` : "/signals"}
          variant={urgent ? "primary" : "secondary"}
          size={compact ? "sm" : "md"}
          className={compact ? undefined : "min-w-[132px]"}
          iconRight={urgent ? <ArrowRight className="h-3.5 w-3.5" aria-hidden /> : undefined}
        >
          {actionLabel[horizon]}
        </Button>
      </div>
    </article>
  );
}

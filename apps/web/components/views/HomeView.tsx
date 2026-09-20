"use client";

import { ArrowDownRight, ArrowRight, Info, RefreshCw } from "lucide-react";
import { useState } from "react";

import { CashPositionChart } from "@/components/charts/CashPositionChart";
import { RunwayChart } from "@/components/charts/RunwayChart";
import { AlertCard } from "@/components/domain/AlertCard";
import { InlineStat } from "@/components/domain/MetricCard";
import { RecommendationCard } from "@/components/domain/RecommendationCard";
import { SignalRow } from "@/components/domain/SignalRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState, LoadingState, Skeleton } from "@/components/ui/States";
import { invalidateApiCache, useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { daysBetween, formatCents, formatDate, formatDateTime } from "@/lib/format";
import { sortByImpact } from "@/lib/presentation";

export function HomeView() {
  const business = useApi("business", api.getBusiness);
  const state = useApi("financial-state", api.getFinancialState, { revalidate: true });
  const signals = useApi("signals", api.getSignals);
  const documents = useApi("documents", api.getDocuments);
  const recommendations = useApi("recommendations", api.getRecommendations);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<Error | null>(null);

  const documentTitles = new Map((documents.data ?? []).map((doc) => [doc.id, doc.title]));
  const signalsById = new Map((signals.data ?? []).map((signal) => [signal.id, signal]));

  const refreshAll = () => {
    invalidateApiCache();
    state.refetch();
    signals.refetch();
    documents.refetch();
    recommendations.refetch();
    business.refetch();
  };

  const resetDemo = async () => {
    setResetting(true);
    setResetError(null);
    try {
      await api.resetDemo();
      refreshAll();
    } catch (error) {
      setResetError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      setResetting(false);
    }
  };

  const latest = state.data?.forecast_adjustments?.at(-1);
  const exactMoney = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  const horizon = state.data ? Math.max(daysBetween(state.data.as_of, state.data.forecast_end_date), (state.data.cash_runway_days ?? 0) + 2) : 30;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title={business.data ? `Good morning, ${business.data.owner_name.split(" ")[0]}` : "Overview"}
        subtitle={
          state.data
            ? `${business.data?.name ?? "Your business"} · cash position as of ${formatDate(state.data.as_of)}`
            : "Cash-flow early warning for your business"
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={resetDemo}
            disabled={resetting}
            icon={<RefreshCw className={resetting ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} aria-hidden />}
          >
            {resetting ? "Resetting…" : "Reset demo"}
          </Button>
        }
      />

      {latest ? (
        <Card className="border-info-100 bg-info-50/60" aria-live="polite">
          <p className="text-xs font-bold uppercase tracking-widest text-info-600">Forecast updated</p>
          <p className="mt-1 font-semibold text-ink">{latest.entity} surcharge incorporated</p>
          <p className="mt-1 text-sm text-ink-soft">+{exactMoney(latest.monthly_amount_cents)}/month · +{exactMoney(latest.amount_cents)} in this forecast</p>
          <p className="mt-1 text-xs text-muted">Effective {formatDate(latest.effective_date)} · Source: {latest.source_filename} · Updated {formatDateTime(latest.applied_at)}</p>
          <details className="mt-2 text-xs text-ink-soft">
            <summary className="cursor-pointer">How this was calculated</summary>
            <p className="mt-2">{latest.calculation_explanation}</p>
          </details>
        </Card>
      ) : null}

      {resetError ? <ErrorState title="Reset failed" error={resetError} /> : null}

      {state.error ? (
        <ErrorState title="Could not load financial state" error={state.error} onRetry={state.refetch} />
      ) : state.data && signals.data ? (
        <AlertCard state={state.data} signals={signals.data} />
      ) : (
        <Card className="p-6">
          <LoadingState label="Loading cash-flow alert" lines={4} />
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.15fr]">
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                Forecast · Cash Runway
                <Info className="h-3.5 w-3.5 text-muted-light" aria-label="Days until cash reaches zero at the current burn rate" />
              </span>
            }
            action={state.data ? <Pill tone="danger" dot>Below reserve</Pill> : null}
          />
          {state.data ? (
            <>
              <p className="tabular text-[34px] font-bold leading-none tracking-tight text-ink">
                {state.data.cash_runway_days != null ? `${state.data.cash_runway_days} days` : "No net burn"}
              </p>
              <p className="mt-2 flex items-center gap-1 text-[12.5px] font-medium text-danger-600">
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
                {formatCents(state.data.average_daily_net_burn_cents)} average daily net burn
              </p>
              <div className="mt-4">
                <RunwayChart
                  currentCashCents={state.data.current_cash_cents}
                  dailyBurnCents={state.data.average_daily_net_burn_cents}
                  runwayDays={state.data.cash_runway_days}
                  reserveCents={state.data.minimum_cash_reserve_cents}
                  shortfallCents={state.data.projected_shortfall_cents}
                  startDate={state.data.as_of}
                  horizonDays={horizon}
                  height={190}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-[190px] w-full" />
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Cash Position"
            subtitle={state.data ? `Next ${daysBetween(state.data.as_of, state.data.forecast_end_date)} days · through ${formatDate(state.data.forecast_end_date)}` : undefined}
            action={
              <Button href="/cash-flow" variant="ghost" size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}>
                Cash flow
              </Button>
            }
          />
          {state.data ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <InlineStat label="Actual · Current cash" value={exactMoney(state.data.current_cash_cents)} />
                <InlineStat label="Forecast · Expected inflows" value={exactMoney(state.data.expected_inflows_cents)} tone="success" />
                <InlineStat label="Forecast · Expected outflows" value={exactMoney(state.data.expected_outflows_cents)} tone="danger" />
                <InlineStat label="Forecast · Ending cash" value={exactMoney(state.data.projected_ending_cash_cents)} />
                <InlineStat
                  label={state.data.projected_shortfall_cents > 0 ? "Forecast · Shortfall" : "Forecast · Balance"}
                  value={
                    state.data.projected_shortfall_cents > 0
                      ? exactMoney(state.data.projected_shortfall_cents)
                      : exactMoney(state.data.projected_ending_cash_cents)
                  }
                  tone={state.data.projected_shortfall_cents > 0 ? "danger" : "success"}
                />
              </div>
              <div className="mt-3">
                <CashPositionChart
                  currentCashCents={state.data.current_cash_cents}
                  inflowsCents={state.data.expected_inflows_cents}
                  outflowsCents={state.data.expected_outflows_cents}
                  projectedCents={state.data.projected_ending_cash_cents}
                  reserveCents={state.data.minimum_cash_reserve_cents}
                  height={176}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-[176px] w-full" />
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader
            title="What should I do next?"
            subtitle="Decision support, not automatic actions."
            action={
              <Button href="/recommendations" variant="ghost" size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}>
                All recommendations
              </Button>
            }
          />
          {recommendations.error ? (
            <ErrorState error={recommendations.error} onRetry={recommendations.refetch} />
          ) : recommendations.data ? (
            <div className="space-y-3">
              {recommendations.data.slice(0, 3).map((recommendation) => (
                <RecommendationCard key={recommendation.id} recommendation={recommendation} signalsById={signalsById} compact />
              ))}
            </div>
          ) : (
            <LoadingState lines={4} />
          )}
        </Card>

        <Card padded={false}>
          <CardHeader
            className="px-5 pt-5"
            title="Recent signals"
            subtitle="Every signal traces back to a source document."
            action={
              <Button href="/signals" variant="ghost" size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}>
                All signals
              </Button>
            }
          />
          {signals.error ? (
            <div className="px-5 pb-5">
              <ErrorState error={signals.error} onRetry={signals.refetch} />
            </div>
          ) : signals.data ? (
            <ul className="border-t border-line">
              {sortByImpact(signals.data).map((signal) => (
                <SignalRow
                  key={signal.id}
                  signal={signal}
                  sourceLabel={documentTitles.get(signal.source_document_id)}
                  dense
                />
              ))}
            </ul>
          ) : (
            <div className="px-5 pb-5">
              <LoadingState lines={5} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

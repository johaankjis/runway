"use client";

import { ArrowDownRight, ArrowRight, Info, RefreshCw, Sparkles } from "lucide-react";
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
  const signedExact = (cents: number) => `${cents < 0 ? "-" : "+"}${exactMoney(Math.abs(cents))}`;

  const horizon = state.data ? Math.max(daysBetween(state.data.as_of, state.data.forecast_end_date), (state.data.cash_runway_days ?? 0) + 2) : 30;
  const windowDays = state.data ? daysBetween(state.data.as_of, state.data.forecast_end_date) : null;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        className="mb-0"
        title={business.data ? `Good morning, ${business.data.owner_name.split(" ")[0]}` : "Home"}
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
        <Card tone="info" className="flex items-start gap-3.5 px-5 py-4" aria-live="polite">
          <span aria-hidden className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-info-100 text-info-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-info-600">Forecast updated</p>
            <p className="mt-0.5 text-[14px] font-semibold text-ink">
              {latest.entity} surcharge incorporated ·{" "}
              <span className="tabular">{signedExact(latest.monthly_amount_cents)}/month</span> ·{" "}
              <span className="tabular">{signedExact(latest.amount_cents)} in this forecast</span>
            </p>
            <p className="mt-1 text-[12px] text-muted">
              Effective {formatDate(latest.effective_date)} · Source {latest.source_filename} · Updated {formatDateTime(latest.applied_at)}
            </p>
            <details className="mt-1.5 text-[12px] text-ink-soft">
              <summary className="cursor-pointer font-medium text-info-600">How this was calculated</summary>
              <p className="mt-1.5 leading-relaxed">{latest.calculation_explanation}</p>
            </details>
          </div>
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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                Cash Runway
                <Info className="h-3.5 w-3.5 text-muted-light" aria-label="Days until cash reaches zero at the current burn rate" />
              </span>
            }
            action={state.data ? <Pill tone="danger" dot>Below reserve</Pill> : null}
          />
          {state.data ? (
            <>
              <p className="tabular text-[36px] font-bold leading-none tracking-tight text-ink">
                {state.data.cash_runway_days != null ? `${state.data.cash_runway_days} days` : "No net burn"}
              </p>
              <p className="mt-2.5 flex items-center gap-1 text-[13px] font-medium text-danger-600">
                <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
                {formatCents(state.data.average_daily_net_burn_cents)} average daily net burn
              </p>
              <div className="mt-5">
                <RunwayChart
                  currentCashCents={state.data.current_cash_cents}
                  dailyBurnCents={state.data.average_daily_net_burn_cents}
                  runwayDays={state.data.cash_runway_days}
                  reserveCents={state.data.minimum_cash_reserve_cents}
                  shortfallCents={state.data.projected_shortfall_cents}
                  startDate={state.data.as_of}
                  horizonDays={horizon}
                  height={200}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-9 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-[200px] w-full" />
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-1.5">
                Cash Position{windowDays != null ? ` (Next ${windowDays} Days)` : ""}
                <Info className="h-3.5 w-3.5 text-muted-light" aria-label="Scheduled inflows and outflows through the end of the forecast window" />
              </span>
            }
            subtitle={state.data ? `Forecast through ${formatDate(state.data.forecast_end_date)}` : undefined}
            action={
              <Button href="/cash-flow" variant="ghost" size="sm" iconRight={<ArrowRight className="h-3.5 w-3.5" aria-hidden />}>
                Cash flow
              </Button>
            }
          />
          {state.data ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <InlineStat label="Current cash" value={exactMoney(state.data.current_cash_cents)} />
                <InlineStat label="Expected inflows" value={signedExact(state.data.expected_inflows_cents)} tone="success" />
                <InlineStat label="Expected outflows" value={signedExact(-state.data.expected_outflows_cents)} tone="danger" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3.5">
                <p className="text-[12.5px] text-muted">
                  Projected ending cash{" "}
                  <span className="tabular font-semibold text-ink">{exactMoney(state.data.projected_ending_cash_cents)}</span>
                </p>
                <p className="text-[12.5px] text-muted">
                  Minimum reserve{" "}
                  <span className="tabular font-semibold text-ink">{exactMoney(state.data.minimum_cash_reserve_cents)}</span>
                </p>
                <p className="text-[12.5px] text-muted">
                  {state.data.projected_shortfall_cents > 0 ? "Projected shortfall" : "Buffer above reserve"}{" "}
                  <span
                    className={
                      state.data.projected_shortfall_cents > 0
                        ? "tabular font-semibold text-danger-600"
                        : "tabular font-semibold text-success-600"
                    }
                  >
                    {state.data.projected_shortfall_cents > 0
                      ? exactMoney(state.data.projected_shortfall_cents)
                      : exactMoney(state.data.projected_ending_cash_cents - state.data.minimum_cash_reserve_cents)}
                  </span>
                </p>
              </div>
              <div className="mt-3">
                <CashPositionChart
                  currentCashCents={state.data.current_cash_cents}
                  inflowsCents={state.data.expected_inflows_cents}
                  outflowsCents={state.data.expected_outflows_cents}
                  projectedCents={state.data.projected_ending_cash_cents}
                  reserveCents={state.data.minimum_cash_reserve_cents}
                  height={190}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-[190px] w-full" />
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

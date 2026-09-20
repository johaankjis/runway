"use client";

import type { CashFlowEntry } from "@runway/contracts";
import { ArrowDownLeft, ArrowUpRight, CalendarRange, Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CashFlowTimelineChart, TimelineLegend } from "@/components/charts/CashFlowTimelineChart";
import { CashPositionChart } from "@/components/charts/CashPositionChart";
import { MetricCard } from "@/components/domain/MetricCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { daysBetween, formatCents, formatDate, formatDateShort, formatSignedCents } from "@/lib/format";
import type { Tone } from "@/lib/presentation";

type Tab = "overview" | "upcoming" | "breakdown";

const statusTone: Record<CashFlowEntry["status"], Tone> = {
  expected: "info",
  overdue: "danger",
  scheduled: "neutral",
};

function EntryRow({ entry, asOf }: { entry: CashFlowEntry; asOf: string }) {
  const inflow = entry.direction === "inflow";
  const inDays = daysBetween(asOf, entry.expected_date);
  return (
    <tr className="border-b border-line last:border-b-0 hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "grid h-8 w-8 place-items-center rounded-lg",
              inflow ? "bg-success-50 text-success-600" : "bg-danger-50 text-danger-500",
            )}
          >
            {inflow ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-[13px] font-semibold text-ink">{entry.description}</p>
            <p className="text-[11.5px] text-muted">
              {inflow ? "Inflow" : "Outflow"}
              {entry.source_document_id ? " · from document" : ""}
            </p>
          </div>
        </div>
      </td>
      <td className="tabular px-4 py-3 text-[12.5px] text-ink-soft">
        {formatDate(entry.expected_date)}
        <span className="block text-[11px] text-muted">{inDays === 0 ? "today" : inDays > 0 ? `in ${inDays} days` : `${-inDays} days ago`}</span>
      </td>
      <td className="px-4 py-3">
        <Pill tone={statusTone[entry.status]} dot>
          {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
        </Pill>
      </td>
      <td className={cn("tabular px-4 py-3 text-right text-[13.5px] font-semibold", inflow ? "text-success-600" : "text-danger-600")}>
        {formatSignedCents(inflow ? entry.amount_cents : -entry.amount_cents)}
      </td>
    </tr>
  );
}

export function CashFlowView() {
  const state = useApi("financial-state", api.getFinancialState);
  const [tab, setTab] = useState<Tab>("overview");

  const data = state.data;
  const windowDays = data ? daysBetween(data.as_of, data.forecast_end_date) : null;
  const entries = data ? [...data.cash_flow].sort((a, b) => a.expected_date.localeCompare(b.expected_date)) : [];
  const inflows = entries.filter((entry) => entry.direction === "inflow");
  const outflows = entries.filter((entry) => entry.direction === "outflow");

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Cash Flow"
        subtitle="See your scheduled inflows, outflows, and projected balance against your minimum cash reserve."
        actions={
          <>
            {data ? (
              <Pill tone="neutral" icon={<CalendarRange className="h-3 w-3" aria-hidden />}>
                {formatDateShort(data.as_of)} – {formatDate(data.forecast_end_date)}
              </Pill>
            ) : null}
            <Button variant="secondary" size="sm" icon={<Download className="h-3.5 w-3.5" aria-hidden />} disabled title="Export is not available in this milestone">
              Download
            </Button>
          </>
        }
      />

      {state.error ? (
        <ErrorState title="Could not load financial state" error={state.error} onRetry={state.refetch} />
      ) : !data ? (
        <Card>
          <LoadingState label="Loading cash flow" lines={6} />
        </Card>
      ) : (
        <>
          <Tabs
            label="Cash flow views"
            value={tab}
            onChange={setTab}
            className="mb-5"
            tabs={[
              { key: "overview", label: "Overview" },
              { key: "upcoming", label: `Upcoming (${entries.length})` },
              { key: "breakdown", label: "Inflows & outflows" },
            ]}
          />

          {tab === "overview" ? (
            <div className="space-y-6">
              <Card>
                <CardHeader
                  title="Projected balance"
                  subtitle={`Scheduled entries over the next ${windowDays} days versus the engine's burn-rate trend.`}
                  action={<TimelineLegend />}
                />
                <CashFlowTimelineChart state={data} height={300} />
              </Card>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                <MetricCard label="Current cash" value={formatCents(data.current_cash_cents)} hint={`Actual balance as of ${formatDateShort(data.as_of)}`} />
                <MetricCard label="Expected inflows" value={formatSignedCents(data.expected_inflows_cents)} tone="success" hint={`${inflows.length} scheduled receipts in the window`} />
                <MetricCard label="Expected outflows" value={formatSignedCents(-data.expected_outflows_cents)} tone="danger" hint={`${outflows.length} scheduled payments in the window`} />
                <MetricCard
                  label="Projected balance"
                  value={formatCents(data.projected_ending_cash_cents)}
                  tone={data.projected_ending_cash_cents < data.minimum_cash_reserve_cents ? "warning" : "success"}
                  hint={`Minimum reserve ${formatCents(data.minimum_cash_reserve_cents)}`}
                />
                <MetricCard
                  label="Projected shortfall"
                  value={data.projected_shortfall_cents > 0 ? formatSignedCents(-data.projected_shortfall_cents) : "None"}
                  tone={data.projected_shortfall_cents > 0 ? "danger" : "success"}
                  hint="Gap below the minimum reserve"
                />
                <MetricCard
                  label="Cash runway"
                  value={data.cash_runway_days != null ? `${data.cash_runway_days} days` : "—"}
                  tone={data.cash_runway_days != null && data.cash_runway_days <= 30 ? "danger" : "neutral"}
                  hint={`${formatCents(data.average_daily_net_burn_cents)} average daily net burn`}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
                <Card>
                  <CardHeader title="Cash position" subtitle="Where the projected balance comes from." />
                  <CashPositionChart
                    currentCashCents={data.current_cash_cents}
                    inflowsCents={data.expected_inflows_cents}
                    outflowsCents={data.expected_outflows_cents}
                    projectedCents={data.projected_ending_cash_cents}
                    reserveCents={data.minimum_cash_reserve_cents}
                    height={220}
                  />
                </Card>
                <Card>
                  <CardHeader title="How the engine gets here" subtitle="Deterministic, whole-cent arithmetic." />
                  <dl className="space-y-2.5 text-[13px]">
                    {[
                      ["Current cash", formatCents(data.current_cash_cents)],
                      ["+ Expected inflows", formatSignedCents(data.expected_inflows_cents)],
                      ["− Expected outflows", formatSignedCents(-data.expected_outflows_cents)],
                      ["= Projected ending cash", formatCents(data.projected_ending_cash_cents)],
                      ["Minimum cash reserve", formatCents(data.minimum_cash_reserve_cents)],
                      ["Projected shortfall", data.projected_shortfall_cents > 0 ? formatCents(data.projected_shortfall_cents) : "None"],
                      ["Average daily net burn", formatCents(data.average_daily_net_burn_cents)],
                      ["Cash runway", data.cash_runway_days != null ? `${data.cash_runway_days} days` : "—"],
                    ].map(([label, value], index) => (
                      <div
                        key={label}
                        className={cn(
                          "flex items-center justify-between gap-4",
                          index === 3 && "border-t border-line pt-2.5 font-semibold",
                          index === 5 && "text-danger-600",
                        )}
                      >
                        <dt className="text-ink-soft">{label}</dt>
                        <dd className="tabular font-medium text-ink">{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-4 text-[11.5px] text-muted">
                    Values come directly from the Runway API. Try changes in{" "}
                    <Link href="/scenarios" className="text-info-600 hover:underline">
                      Scenarios
                    </Link>
                    .
                  </p>
                </Card>
              </div>
            </div>
          ) : null}

          {tab === "upcoming" ? (
            <Card padded={false} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">Entry</th>
                      <th scope="col" className="px-4 py-2.5">Expected</th>
                      <th scope="col" className="px-4 py-2.5">Status</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <EntryRow key={entry.id} entry={entry} asOf={data.as_of} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {tab === "breakdown" ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {[
                { title: "Inflows", items: inflows, total: data.expected_inflows_cents, tone: "success" as const },
                { title: "Outflows", items: outflows, total: data.expected_outflows_cents, tone: "danger" as const },
              ].map((group) => (
                <Card key={group.title} padded={false}>
                  <div className="flex items-center justify-between px-5 pt-5">
                    <h2 className="text-[15px] font-semibold text-ink">{group.title}</h2>
                    <span className={cn("tabular text-[15px] font-bold", group.tone === "success" ? "text-success-600" : "text-danger-600")}>
                      {formatSignedCents(group.tone === "success" ? group.total : -group.total)}
                    </span>
                  </div>
                  <table className="mt-3 w-full text-left">
                    <tbody>
                      {group.items.map((entry) => (
                        <EntryRow key={entry.id} entry={entry} asOf={data.as_of} />
                      ))}
                    </tbody>
                  </table>
                </Card>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

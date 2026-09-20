"use client";

import type { ScenarioSnapshot } from "@runway/contracts";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildRunwaySeries } from "@/lib/chart-data";
import { formatCents, formatCompactCents, formatDateShort } from "@/lib/format";

import { ChartCallout } from "./ChartCallout";
import { chart, tooltipStyle } from "./chart-theme";

/** Legend rendered outside the plot so it can sit in a card header. */
export function ScenarioLegend({ hasScenario }: { hasScenario: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] font-medium text-ink-soft">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="inline-block h-1 w-5 rounded-full bg-danger-500/70" />
        Current projection
      </span>
      {hasScenario ? (
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-1 w-5 rounded-full bg-info-600" />
          With this scenario
        </span>
      ) : null}
    </div>
  );
}

export function ScenarioComparisonChart({
  baseline,
  scenario,
  startDate,
  height = 240,
}: {
  baseline: ScenarioSnapshot;
  scenario: ScenarioSnapshot | null;
  startDate: string;
  height?: number;
}) {
  const horizon = Math.max(
    30,
    (baseline.cash_runway_days ?? 0) + 4,
    (scenario?.cash_runway_days ?? 0) + 4,
  );
  const base = buildRunwaySeries(baseline, startDate, horizon);
  const alt = scenario ? buildRunwaySeries(scenario, startDate, horizon) : null;
  const data = base.map((point, index) => ({
    date: point.date,
    baseline: point.balance,
    scenario: alt ? alt[index]?.balance ?? null : null,
  }));
  const ticks = data.filter((_, i) => i % 7 === 0).map((p) => p.date);
  const baseZero = baseline.cash_runway_days != null ? data[Math.min(baseline.cash_runway_days, horizon)] : null;
  const altZero =
    scenario?.cash_runway_days != null ? data[Math.min(scenario.cash_runway_days, horizon)] : null;
  // Keep the two callouts from colliding: the earlier zero-day sits left, the later one right.
  const baseFirst =
    scenario?.cash_runway_days == null || baseline.cash_runway_days == null
      ? true
      : baseline.cash_runway_days <= scenario.cash_runway_days;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="baselineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.red} stopOpacity={0.2} />
              <stop offset="100%" stopColor={chart.red} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="scenarioFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.blue} stopOpacity={0.16} />
              <stop offset="100%" stopColor={chart.blue} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis dataKey="date" ticks={ticks} tickFormatter={formatDateShort} axisLine={false} tickLine={false} tickMargin={10} interval={0} />
          <YAxis tickFormatter={(v: number) => formatCompactCents(v)} axisLine={false} tickLine={false} width={52} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(label: string) => formatDateShort(label)}
            formatter={(value: number, name: string) => [
              formatCents(value),
              name === "baseline" ? "Current projection" : "With this scenario",
            ]}
          />
          <ReferenceLine y={baseline.minimum_cash_reserve_cents} stroke={chart.slate} strokeDasharray="4 4" />
          <Area
            type="monotone"
            dataKey="baseline"
            stroke={chart.red}
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="url(#baselineFill)"
            dot={false}
            isAnimationActive={false}
          />
          {scenario ? (
            <Area
              type="monotone"
              dataKey="scenario"
              stroke={chart.blue}
              strokeWidth={2.5}
              fill="url(#scenarioFill)"
              dot={false}
              isAnimationActive={false}
            />
          ) : null}
          {baseZero ? (
            <ReferenceDot
              x={baseZero.date}
              y={0}
              r={6}
              fill={chart.red}
              stroke="#fff"
              strokeWidth={2.5}
              label={
                <ChartCallout
                  title="Current projection"
                  value={`${baseline.cash_runway_days} days`}
                  valueColor={chart.red}
                  side={baseFirst ? "left" : "right"}
                />
              }
            />
          ) : null}
          {altZero && scenario ? (
            <ReferenceDot
              x={altZero.date}
              y={0}
              r={6}
              fill={chart.blue}
              stroke="#fff"
              strokeWidth={2.5}
              label={
                <ChartCallout
                  title="With this scenario"
                  value={`${scenario.cash_runway_days} days`}
                  valueColor={chart.blue}
                  side={baseFirst ? "right" : "left"}
                />
              }
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

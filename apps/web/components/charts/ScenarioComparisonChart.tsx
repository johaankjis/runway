"use client";

import type { ScenarioSnapshot } from "@runway/contracts";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildRunwaySeries } from "@/lib/chart-data";
import { formatCents, formatCompactCents, formatDateShort } from "@/lib/format";

import { chart, tooltipStyle } from "./chart-theme";

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

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="baselineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.red} stopOpacity={0.22} />
              <stop offset="100%" stopColor={chart.red} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="scenarioFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.blue} stopOpacity={0.18} />
              <stop offset="100%" stopColor={chart.blue} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis dataKey="date" ticks={ticks} tickFormatter={formatDateShort} axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis tickFormatter={(v: number) => formatCompactCents(v)} axisLine={false} tickLine={false} width={52} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(label: string) => formatDateShort(label)}
            formatter={(value: number, name: string) => [
              formatCents(value),
              name === "baseline" ? "Current projection" : "With this scenario",
            ]}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            formatter={(value: string) => (value === "baseline" ? "Current projection" : "With this scenario")}
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
              r={5}
              fill={chart.red}
              stroke="#fff"
              strokeWidth={2}
              label={{ value: `${baseline.cash_runway_days} days`, position: "left", fill: chart.red, fontSize: 11, fontWeight: 700 }}
            />
          ) : null}
          {altZero && scenario ? (
            <ReferenceDot
              x={altZero.date}
              y={0}
              r={5}
              fill={chart.blue}
              stroke="#fff"
              strokeWidth={2}
              label={{ value: `${scenario.cash_runway_days} days`, position: "right", fill: chart.blue, fontSize: 11, fontWeight: 700 }}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

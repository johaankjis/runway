"use client";

import type { FinancialState } from "@runway/contracts";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildCashFlowTimeline, buildRunwaySeries } from "@/lib/chart-data";
import { daysBetween, formatCents, formatCompactCents, formatDateShort } from "@/lib/format";

import { ChartCallout } from "./ChartCallout";
import { chart, tooltipStyle } from "./chart-theme";

/** Legend rendered outside the plot so it can sit in a card header. */
export function TimelineLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] font-medium text-ink-soft">
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="inline-block h-[3px] w-5 rounded-full bg-success-600" />
        Scheduled balance
      </span>
      <span className="inline-flex items-center gap-2">
        <span aria-hidden className="inline-block w-5 border-t-2 border-dashed border-danger-500" />
        Burn-rate trend
      </span>
    </div>
  );
}

/**
 * Forecast-window balance: scheduled entries walked in date order (solid,
 * green) versus the engine's straight-line burn trend (dashed, red).
 */
export function CashFlowTimelineChart({ state, height = 280 }: { state: FinancialState; height?: number }) {
  const timeline = buildCashFlowTimeline(state);
  const horizon = Math.max(1, daysBetween(state.as_of, state.forecast_end_date));
  const trend = buildRunwaySeries(state, state.as_of, horizon);
  const data = timeline.map((point, index) => ({ ...point, trend: trend[index]?.balance ?? null }));
  const last = data[data.length - 1];
  const lastIndex = data.length - 1;
  // Weekly ticks plus the final day, skipping a weekly tick that would collide with it.
  const ticks = data
    .filter((_, i) => i === lastIndex || (i % 7 === 0 && lastIndex - i >= 3))
    .map((p) => p.date);
  const shortfall = state.projected_shortfall_cents > 0;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
          <defs>
            <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.green} stopOpacity={0.24} />
              <stop offset="100%" stopColor={chart.green} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis dataKey="date" ticks={ticks} tickFormatter={formatDateShort} axisLine={false} tickLine={false} tickMargin={10} interval={0} />
          <YAxis tickFormatter={(v: number) => formatCompactCents(v)} axisLine={false} tickLine={false} width={52} />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(label: string, payload) => {
              const events = (payload?.[0]?.payload as { events?: string[] } | undefined)?.events ?? [];
              return `${formatDateShort(label)}${events.length ? ` · ${events.join(", ")}` : ""}`;
            }}
            formatter={(value: number, name: string) => [
              formatCents(value),
              name === "balance" ? "Scheduled balance" : "Burn-rate trend",
            ]}
          />
          <ReferenceLine
            y={state.minimum_cash_reserve_cents}
            stroke={chart.slate}
            strokeDasharray="4 4"
            label={{ value: `Reserve ${formatCompactCents(state.minimum_cash_reserve_cents)}`, position: "insideTopLeft", fill: chart.slate, fontSize: 10 }}
          />
          <Area
            type="stepAfter"
            dataKey="balance"
            stroke={chart.green}
            strokeWidth={2}
            fill="url(#timelineFill)"
            isAnimationActive={false}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="trend"
            stroke={chart.red}
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
          />
          {last ? (
            <ReferenceDot
              x={last.date}
              y={last.balance}
              r={6}
              fill={shortfall ? chart.red : chart.green}
              stroke="#fff"
              strokeWidth={2.5}
              label={
                <ChartCallout
                  title={shortfall ? "Projected shortfall" : "Projected ending cash"}
                  value={shortfall ? formatCents(state.projected_shortfall_cents) : formatCents(last.balance)}
                  valueColor={shortfall ? chart.red : chart.green}
                  side="left"
                />
              }
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

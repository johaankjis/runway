"use client";

import type { FinancialState } from "@runway/contracts";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
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

import { chart, tooltipStyle } from "./chart-theme";

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
  const ticks = data.filter((_, i) => i % 7 === 0 || i === data.length - 1).map((p) => p.date);

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="timelineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.green} stopOpacity={0.25} />
              <stop offset="100%" stopColor={chart.green} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis dataKey="date" ticks={ticks} tickFormatter={formatDateShort} axisLine={false} tickLine={false} tickMargin={8} />
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
          <Legend
            verticalAlign="top"
            align="right"
            iconType="plainline"
            wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            formatter={(value: string) => (value === "balance" ? "Scheduled balance" : "Burn-rate trend")}
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
              r={5}
              fill={state.projected_shortfall_cents > 0 ? chart.red : chart.green}
              stroke="#fff"
              strokeWidth={2}
              label={{
                value:
                  state.projected_shortfall_cents > 0
                    ? `Shortfall ${formatCents(state.projected_shortfall_cents)}`
                    : `Ends ${formatCompactCents(last.balance)}`,
                position: "left",
                fill: state.projected_shortfall_cents > 0 ? chart.red : chart.green,
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

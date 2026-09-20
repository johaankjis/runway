"use client";

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

import { chart, tooltipStyle } from "./chart-theme";

interface RunwayChartProps {
  currentCashCents: number;
  dailyBurnCents: number;
  runwayDays: number | null;
  reserveCents: number;
  shortfallCents: number;
  startDate: string;
  horizonDays: number;
  height?: number;
  showAxes?: boolean;
}

/**
 * Cash-runway trend: the engine's straight-line burn from current cash to the
 * day the engine says cash hits zero, with the minimum reserve marked.
 */
export function RunwayChart({
  currentCashCents,
  dailyBurnCents,
  runwayDays,
  reserveCents,
  shortfallCents,
  startDate,
  horizonDays,
  height = 180,
  showAxes = true,
}: RunwayChartProps) {
  const data = buildRunwaySeries(
    { current_cash_cents: currentCashCents, average_daily_net_burn_cents: dailyBurnCents, cash_runway_days: runwayDays },
    startDate,
    horizonDays,
  );
  const zeroDay = runwayDays != null && runwayDays <= horizonDays ? data[runwayDays] : null;
  const ticks = [0, Math.round(horizonDays / 3), Math.round((2 * horizonDays) / 3), horizonDays]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((day) => data[day]?.date)
    .filter(Boolean) as string[];

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: showAxes ? 0 : 0, bottom: 0 }}>
          <defs>
            <linearGradient id="runwayFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={chart.red} stopOpacity={0.28} />
              <stop offset="100%" stopColor={chart.red} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={chart.grid} vertical={false} />
          <XAxis
            dataKey="date"
            ticks={ticks}
            tickFormatter={formatDateShort}
            axisLine={false}
            tickLine={false}
            hide={!showAxes}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={(v: number) => formatCompactCents(v)}
            axisLine={false}
            tickLine={false}
            width={48}
            hide={!showAxes}
            domain={[0, "dataMax"]}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(label: string) => formatDateShort(label)}
            formatter={(value: number) => [formatCents(value), "Cash on burn trend"]}
          />
          <ReferenceLine
            y={reserveCents}
            stroke={chart.slate}
            strokeDasharray="4 4"
            label={{ value: "Minimum reserve", position: "insideTopRight", fill: chart.slate, fontSize: 10 }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke={chart.red}
            strokeWidth={2}
            strokeDasharray="6 4"
            fill="url(#runwayFill)"
            isAnimationActive={false}
            dot={false}
            activeDot={{ r: 4, fill: chart.red, stroke: "#fff", strokeWidth: 2 }}
          />
          {zeroDay ? (
            <ReferenceDot
              x={zeroDay.date}
              y={0}
              r={5}
              fill={chart.red}
              stroke="#fff"
              strokeWidth={2}
              label={{
                value: shortfallCents > 0 ? `Shortfall ${formatCents(shortfallCents)}` : `Day ${runwayDays}`,
                position: "top",
                fill: chart.red,
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

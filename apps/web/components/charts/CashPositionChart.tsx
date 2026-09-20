"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { buildCashPositionBars, type CashPositionBar } from "@/lib/chart-data";
import { formatCents, formatCompactCents, formatSignedCents } from "@/lib/format";

import { chart, tooltipStyle } from "./chart-theme";

const colors: Record<CashPositionBar["key"], string> = {
  current: chart.navy,
  inflows: chart.green,
  outflows: chart.red,
  projected: "#64748B",
};

export function CashPositionChart({
  currentCashCents,
  inflowsCents,
  outflowsCents,
  projectedCents,
  reserveCents,
  height = 180,
}: {
  currentCashCents: number;
  inflowsCents: number;
  outflowsCents: number;
  projectedCents: number;
  reserveCents?: number;
  height?: number;
}) {
  const data = buildCashPositionBars({
    current_cash_cents: currentCashCents,
    expected_inflows_cents: inflowsCents,
    expected_outflows_cents: outflowsCents,
    projected_ending_cash_cents: projectedCents,
  });

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
          <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={8} />
          <YAxis
            tickFormatter={(v: number) => formatCompactCents(v)}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <ReferenceLine y={0} stroke="#CBD5E1" />
          {reserveCents != null ? (
            <ReferenceLine
              y={reserveCents}
              stroke={chart.slate}
              strokeDasharray="4 4"
              label={{ value: "Reserve", position: "insideTopRight", fill: chart.slate, fontSize: 10 }}
            />
          ) : null}
          <Tooltip
            cursor={{ fill: "rgba(15,27,49,0.04)" }}
            contentStyle={tooltipStyle}
            formatter={(value: number, _name, item) => {
              const key = (item.payload as CashPositionBar).key;
              return [key === "inflows" || key === "outflows" ? formatSignedCents(value) : formatCents(value), (item.payload as CashPositionBar).label];
            }}
          />
          <Bar dataKey="value" radius={[6, 6, 6, 6]} isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={colors[entry.key]} />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              formatter={(value: number) => formatCompactCents(value)}
              style={{ fontSize: 11, fontWeight: 600, fill: chart.navy }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Builds chart series from values the API already calculated. These helpers
 * only lay API numbers out along a time axis for display; they never produce
 * authoritative balances, runway, or shortfalls. Every headline number shown
 * next to a chart comes straight from the FinancialState / ScenarioSnapshot.
 */
import type { FinancialState, ScenarioSnapshot } from "@runway/contracts";

import { addDays, daysBetween } from "./format";

export interface RunwayPoint {
  day: number;
  date: string;
  /** Cents remaining along the engine's average daily net burn line. */
  balance: number;
}

/**
 * Straight-line cash trend using the engine's `average_daily_net_burn_cents`
 * until `cash_runway_days` (where the engine says cash reaches zero).
 */
export function buildRunwaySeries(
  snapshot: Pick<ScenarioSnapshot, "current_cash_cents" | "average_daily_net_burn_cents" | "cash_runway_days">,
  startDate: string,
  horizonDays: number,
): RunwayPoint[] {
  const points: RunwayPoint[] = [];
  const runway = snapshot.cash_runway_days;
  for (let day = 0; day <= horizonDays; day += 1) {
    const linear = snapshot.current_cash_cents - snapshot.average_daily_net_burn_cents * day;
    const balance = runway != null && day >= runway ? 0 : Math.max(0, linear);
    points.push({ day, date: addDays(startDate, day), balance });
  }
  return points;
}

export interface TimelinePoint {
  date: string;
  day: number;
  balance: number;
  events: string[];
}

/**
 * Running balance across the forecast window by walking the API's own
 * cash-flow entries in date order. The final point equals the API's
 * `projected_ending_cash_cents` by construction (cash + inflows - outflows).
 */
export function buildCashFlowTimeline(state: FinancialState): TimelinePoint[] {
  const entries = [...state.cash_flow].sort((a, b) => a.expected_date.localeCompare(b.expected_date));
  const totalDays = Math.max(1, daysBetween(state.as_of, state.forecast_end_date));
  const byDate = new Map<string, { delta: number; events: string[] }>();
  for (const entry of entries) {
    const signed = entry.direction === "inflow" ? entry.amount_cents : -entry.amount_cents;
    const bucket = byDate.get(entry.expected_date) ?? { delta: 0, events: [] };
    bucket.delta += signed;
    bucket.events.push(entry.description);
    byDate.set(entry.expected_date, bucket);
  }

  const points: TimelinePoint[] = [];
  let balance = state.current_cash_cents;
  for (let day = 0; day <= totalDays; day += 1) {
    const date = addDays(state.as_of, day);
    const bucket = byDate.get(date);
    if (bucket) balance += bucket.delta;
    points.push({ date, day, balance, events: bucket?.events ?? [] });
  }
  return points;
}

export interface CashPositionBar {
  key: "current" | "inflows" | "outflows" | "projected";
  label: string;
  value: number;
}

export function buildCashPositionBars(
  snapshot: Pick<
    ScenarioSnapshot,
    "current_cash_cents" | "expected_inflows_cents" | "expected_outflows_cents" | "projected_ending_cash_cents"
  >,
): CashPositionBar[] {
  return [
    { key: "current", label: "Current", value: snapshot.current_cash_cents },
    { key: "inflows", label: "Inflows", value: snapshot.expected_inflows_cents },
    { key: "outflows", label: "Outflows", value: -snapshot.expected_outflows_cents },
    { key: "projected", label: "Projected", value: snapshot.projected_ending_cash_cents },
  ];
}

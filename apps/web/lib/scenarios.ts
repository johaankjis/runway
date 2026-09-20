/**
 * Quick scenarios expressed purely as ScenarioRequest inputs for the
 * deterministic engine (POST /api/scenarios). The frontend never calculates
 * outcomes; it only describes how each preset maps onto the engine's three
 * inputs. Percentages below are derived from fixture facts (e.g. the $2,140
 * supplier increase against $51,700 of expected outflows) and are documented
 * so the mapping is transparent during a demo.
 */
import type { ScenarioRequest } from "@runway/contracts";

export interface QuickScenario {
  id: string;
  title: string;
  subtitle: string;
  /** How the preset is modeled for the engine, shown to the user. */
  modeling: string;
  request: ScenarioRequest;
}

export const QUICK_SCENARIOS: QuickScenario[] = [
  {
    id: "customer-pays",
    title: "Customer pays next week",
    subtitle: "Northstar settles the overdue $12,400 INV-1042",
    modeling: "Modeled as a +$12,400 cash adjustment; forecast inflows unchanged.",
    request: {
      name: "Northstar pays INV-1042 next week",
      revenue_change_percent: 0,
      expense_change_percent: 0,
      cash_adjustment_cents: 1_240_000,
    },
  },
  {
    id: "delay-supplier",
    title: "Delay supplier price increase",
    subtitle: "Push Metro Foods' 18% increase past the window",
    modeling: "Modeled as -4.14% expected outflows ($2,140 of $51,700).",
    request: {
      name: "Delay the supplier price increase",
      revenue_change_percent: 0,
      expense_change_percent: -4.14,
      cash_adjustment_cents: 0,
    },
  },
  {
    id: "reduce-spend",
    title: "Reduce discretionary spending",
    subtitle: "Trim 10% from expected outflows this window",
    modeling: "Modeled as -10% expected outflows.",
    request: {
      name: "Reduce discretionary spending 10%",
      revenue_change_percent: 0,
      expense_change_percent: -10,
      cash_adjustment_cents: 0,
    },
  },
];

export const CUSTOM_SCENARIO_DEFAULTS: ScenarioRequest = {
  name: "Custom scenario",
  revenue_change_percent: 0,
  expense_change_percent: 0,
  cash_adjustment_cents: 0,
};

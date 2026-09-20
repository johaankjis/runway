/**
 * Fixture adapter: serves a captured snapshot of real Runway API responses so
 * the UI stays demoable when the backend is unreachable.
 *
 * The snapshot conforms to the shared contracts in packages/contracts. It does
 * NOT perform financial arithmetic. Scenario results are only available for the
 * pre-captured quick scenarios; any other request rejects with a clear error so
 * that authoritative calculations always come from the deterministic engine.
 */
import type {
  Business,
  Document,
  FinancialState,
  Recommendation,
  ScenarioRequest,
  ScenarioResult,
  Signal,
} from "@runway/contracts";

import snapshot from "./api-snapshot.json";
import type { HealthResponse, ResetResponse, RunwayApi } from "../api";

interface Snapshot {
  business: Business;
  financial_state: FinancialState;
  signals: Signal[];
  documents: Document[];
  recommendations: Recommendation[];
  scenarios: ScenarioResult[];
}

const data = snapshot as unknown as Snapshot;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

function canonical(request: ScenarioRequest): string {
  return JSON.stringify({
    cash_adjustment_cents: request.cash_adjustment_cents,
    expense_change_percent: request.expense_change_percent,
    revenue_change_percent: request.revenue_change_percent,
  });
}

export class FixtureProviderUnavailableError extends Error {
  constructor(feature: string) {
    super(
      `${feature} runs on the Runway API, not in the browser snapshot. Start the API (fixture provider mode needs no credentials) and try again.`,
    );
    this.name = "FixtureProviderUnavailableError";
  }
}

export class FixtureScenarioUnavailableError extends Error {
  constructor() {
    super(
      "This scenario has not been pre-calculated. Start the Runway API to run custom scenarios through the deterministic engine.",
    );
    this.name = "FixtureScenarioUnavailableError";
  }
}

export const fixtureApi: RunwayApi = {
  async health(): Promise<HealthResponse> {
    await delay(30);
    return { status: "ok" };
  },
  async getBusiness() {
    await delay();
    return clone(data.business);
  },
  async getFinancialState() {
    await delay();
    return clone(data.financial_state);
  },
  async getSignals() {
    await delay();
    return clone(data.signals);
  },
  async getSignal(id: string) {
    await delay();
    const signal = data.signals.find((item) => item.id === id);
    if (!signal) {
      throw new Error(`Signal '${id}' was not found`);
    }
    return clone(signal);
  },
  async getDocuments() {
    await delay();
    return clone(data.documents);
  },
  async getRecommendations() {
    await delay();
    return clone(data.recommendations);
  },
  async runScenario(request: ScenarioRequest) {
    await delay(200);
    const key = canonical(request);
    const match = data.scenarios.find((item) => canonical(item.request) === key);
    if (!match) {
      throw new FixtureScenarioUnavailableError();
    }
    return { ...clone(match), name: request.name };
  },
  async resetDemo(): Promise<ResetResponse> {
    await delay();
    return { status: "reset", business_id: data.business.id };
  },
  async extractDocument() {
    await delay(60);
    // Never fake an extraction: provenance must come from the backend pipeline.
    throw new FixtureProviderUnavailableError("Document extraction");
  },
  async createVoiceBriefing() {
    await delay(60);
    // Never fabricate a briefing: the text is grounded by the backend engine state.
    throw new FixtureProviderUnavailableError("Voice briefing");
  },
};

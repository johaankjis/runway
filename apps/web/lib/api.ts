/**
 * Centralized Runway API layer.
 *
 * All frontend data access goes through `api`. Two adapters implement the same
 * `RunwayApi` interface:
 *
 *  - `liveApi`     -> the FastAPI backend (NEXT_PUBLIC_API_BASE_URL)
 *  - `fixtureApi`  -> a captured snapshot of real API responses (lib/fixtures)
 *
 * NEXT_PUBLIC_RUNWAY_DATA_MODE controls selection:
 *  - "live"     always use the backend; network failures surface as errors
 *  - "fixture"  always use the captured snapshot
 *  - "auto"     (default) use the backend, fall back to the snapshot ONLY when
 *               the backend is unreachable. HTTP errors (404/422/500) are never
 *               masked, so genuine integration bugs stay visible.
 */
import type {
  Business,
  Document,
  ExtractionResponse,
  FinancialState,
  Recommendation,
  ScenarioRequest,
  ScenarioResult,
  Signal,
  VoiceRequest,
  VoiceResponse,
} from "@runway/contracts";

import { fixtureApi } from "./fixtures/fixture-adapter";

export type DataMode = "live" | "fixture" | "auto";
export type DataSourceStatus = "unknown" | "live" | "fixture";

export interface HealthResponse {
  status: "ok";
}

export interface ResetResponse {
  status: "reset";
  business_id: string;
}

export interface RunwayApi {
  health(): Promise<HealthResponse>;
  getBusiness(): Promise<Business>;
  getFinancialState(): Promise<FinancialState>;
  getSignals(): Promise<Signal[]>;
  getSignal(id: string): Promise<Signal>;
  getDocuments(): Promise<Document[]>;
  uploadDocument(file: File): Promise<Document>;
  getRecommendations(): Promise<Recommendation[]>;
  runScenario(request: ScenarioRequest): Promise<ScenarioResult>;
  resetDemo(): Promise<ResetResponse>;
  /** POST /api/documents/{id}/extract — Nemotron/fixture extraction with provenance. */
  extractDocument(documentId: string): Promise<ExtractionResponse>;
  /** POST /api/voice/briefing — grounded briefing text plus optional ElevenLabs audio. */
  createVoiceBriefing(request: VoiceRequest): Promise<VoiceResponse>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://localhost:8000";

export const DATA_MODE: DataMode = (() => {
  const raw = process.env.NEXT_PUBLIC_RUNWAY_DATA_MODE;
  return raw === "live" || raw === "fixture" || raw === "auto" ? raw : "auto";
})();

// ---------------------------------------------------------------------------
// Data-source status (so the shell can show "Live API" vs "Demo data")
// ---------------------------------------------------------------------------

type StatusListener = (status: DataSourceStatus) => void;
let currentStatus: DataSourceStatus = DATA_MODE === "fixture" ? "fixture" : "unknown";
const listeners = new Set<StatusListener>();

function setStatus(next: DataSourceStatus) {
  if (next === currentStatus) return;
  currentStatus = next;
  listeners.forEach((listener) => listener(next));
}

export function getDataSourceStatus(): DataSourceStatus {
  return currentStatus;
}

export function subscribeDataSourceStatus(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Live adapter
// ---------------------------------------------------------------------------

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch (error) {
    throw new NetworkError(
      `Could not reach the Runway API at ${API_BASE_URL} (${(error as Error).message})`,
    );
  }

  if (!response.ok) {
    let detail: unknown = undefined;
    try {
      detail = await response.json();
    } catch {
      /* non-JSON error body */
    }
    const message =
      typeof detail === "object" && detail && "detail" in detail
        ? String((detail as { detail: unknown }).detail)
        : `${response.status} ${response.statusText}`;
    throw new ApiError(message, response.status, detail);
  }

  return (await response.json()) as T;
}

export const liveApi: RunwayApi = {
  health: () => request<HealthResponse>("/health"),
  getBusiness: () => request<Business>("/api/business"),
  getFinancialState: () => request<FinancialState>("/api/financial-state"),
  getSignals: () => request<Signal[]>("/api/signals"),
  getSignal: (id) => request<Signal>(`/api/signals/${encodeURIComponent(id)}`),
  getDocuments: () => request<Document[]>("/api/documents"),
  uploadDocument: (file) => {
    const body = new FormData();
    body.append("file", file);
    return request<Document>("/api/documents/upload", { method: "POST", body });
  },
  getRecommendations: () => request<Recommendation[]>("/api/recommendations"),
  runScenario: (payload) =>
    request<ScenarioResult>("/api/scenarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
  resetDemo: () => request<ResetResponse>("/api/demo/reset", { method: "POST" }),
  extractDocument: (documentId) =>
    request<ExtractionResponse>(`/api/documents/${encodeURIComponent(documentId)}/extract`, {
      method: "POST",
    }),
  createVoiceBriefing: (payload) =>
    request<VoiceResponse>("/api/voice/briefing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};

// ---------------------------------------------------------------------------
// Auto adapter: live first, fixture only on network failure
// ---------------------------------------------------------------------------

let warnedAboutFallback = false;

function withFallback<Args extends unknown[], T>(
  live: (...args: Args) => Promise<T>,
  fixture: (...args: Args) => Promise<T>,
): (...args: Args) => Promise<T> {
  return async (...args: Args) => {
    if (DATA_MODE === "fixture") {
      setStatus("fixture");
      return fixture(...args);
    }
    try {
      const result = await live(...args);
      setStatus("live");
      return result;
    } catch (error) {
      if (DATA_MODE === "auto" && error instanceof NetworkError) {
        if (!warnedAboutFallback) {
          warnedAboutFallback = true;
          console.warn(`[runway] ${error.message}. Falling back to fixture data.`);
        }
        setStatus("fixture");
        return fixture(...args);
      }
      throw error;
    }
  };
}

export const api: RunwayApi = {
  health: withFallback(liveApi.health, fixtureApi.health),
  getBusiness: withFallback(liveApi.getBusiness, fixtureApi.getBusiness),
  getFinancialState: withFallback(liveApi.getFinancialState, fixtureApi.getFinancialState),
  getSignals: withFallback(liveApi.getSignals, fixtureApi.getSignals),
  getSignal: withFallback(liveApi.getSignal, fixtureApi.getSignal),
  uploadDocument: withFallback(liveApi.uploadDocument, fixtureApi.uploadDocument),
  getDocuments: withFallback(liveApi.getDocuments, fixtureApi.getDocuments),
  getRecommendations: withFallback(liveApi.getRecommendations, fixtureApi.getRecommendations),
  runScenario: withFallback(liveApi.runScenario, fixtureApi.runScenario),
  resetDemo: withFallback(liveApi.resetDemo, fixtureApi.resetDemo),
  extractDocument: withFallback(liveApi.extractDocument, fixtureApi.extractDocument),
  createVoiceBriefing: withFallback(liveApi.createVoiceBriefing, fixtureApi.createVoiceBriefing),
};


/** Questions always reach the backend; never answer from a stale browser fixture. */
export function askVoiceQuestion(payload: import("@runway/contracts").VoiceQuestionRequest) {
  return request<import("@runway/contracts").VoiceQuestionResponse>("/api/voice/question", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

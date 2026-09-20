export type ImpactLevel = "low" | "medium" | "high" | "critical";
export type CashFlowDirection = "inflow" | "outflow";
export type CashFlowStatus = "expected" | "overdue" | "scheduled";

export interface Business {
  id: string;
  name: string;
  industry: string;
  owner_name: string;
  currency: "USD";
  timezone: string;
}

export interface CashFlowEntry {
  id: string;
  direction: CashFlowDirection;
  amount_cents: number;
  description: string;
  expected_date: string;
  status: CashFlowStatus;
  source_document_id: string | null;
}

export interface FinancialState {
  business_id: string;
  as_of: string;
  forecast_end_date: string;
  current_cash_cents: number;
  expected_inflows_cents: number;
  expected_outflows_cents: number;
  projected_ending_cash_cents: number;
  minimum_cash_reserve_cents: number;
  projected_shortfall_cents: number;
  average_daily_net_burn_cents: number;
  cash_runway_days: number | null;
  cash_flow: CashFlowEntry[];
}

export interface SignalEvidence {
  id: string;
  source_document_id: string;
  source_type: "document";
  excerpt: string;
  locator: string;
}

export interface FinancialEffect {
  kind:
    | "expense_increase"
    | "delayed_inflow"
    | "revenue_decrease"
    | "scheduled_outflow"
    | "risk_indicator";
  amount_cents: number | null;
  percentage: number | null;
  cadence: "one_time" | "weekly" | "monthly" | null;
  calculation_status: "applied" | "observed" | "not_quantified";
  description: string;
}

export interface Signal {
  id: string;
  type: string;
  title: string;
  description: string;
  category: string;
  impact_level: ImpactLevel;
  confidence: number;
  detected_at: string;
  financial_effect: FinancialEffect;
  evidence: SignalEvidence[];
  source_document_id: string;
  extraction?: ExtractionProvenance | null;
}

export interface Document {
  id: string;
  title: string;
  document_type: string;
  filename: string;
  mime_type: string;
  document_date: string;
  ingested_at: string;
  source: "fixture";
  summary: string;
  checksum_sha256: string;
  related_signal_ids: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: ImpactLevel;
  status: "proposed" | "accepted" | "dismissed";
  rationale: string;
  related_signal_ids: string[];
}

export interface ScenarioRequest {
  name: string;
  revenue_change_percent: number;
  expense_change_percent: number;
  cash_adjustment_cents: number;
}

export interface ScenarioSnapshot {
  current_cash_cents: number;
  expected_inflows_cents: number;
  expected_outflows_cents: number;
  projected_ending_cash_cents: number;
  minimum_cash_reserve_cents: number;
  projected_shortfall_cents: number;
  average_daily_net_burn_cents: number;
  cash_runway_days: number | null;
}

export interface ScenarioResult {
  id: string;
  name: string;
  request: ScenarioRequest;
  baseline: ScenarioSnapshot;
  projected: ScenarioSnapshot;
  assumptions: string[];
  calculated_at: string;
}

export interface ProviderMetadata {
  requested_provider: "fixture" | "nemotron" | "elevenlabs";
  provider: "fixture" | "nemotron" | "elevenlabs";
  mode: "fixture" | "live" | "fallback";
  model: string | null;
  failure_reason: "missing_credentials" | "provider_unavailable" | "invalid_output" | "grounding_validation_failed" | null;
}

export interface SupplierFacts {
  type: "supplier_pricing_increase";
  source_document_id: string;
  entity: string;
  percentage: number;
  monthly_increase_usd: number;
  effective_date: string | null;
  confidence: number;
  excerpt: string;
}

export interface ExtractionProvenance {
  source_filename: string;
  source_title: string;
  checksum_sha256: string;
  extracted_at: string;
  provider: ProviderMetadata;
  attributes: SupplierFacts;
}

export interface ExtractionResponse {
  signal: Signal;
  financial_state: FinancialState;
  application_status: "already_in_baseline";
}

export type VoiceLanguage = "en" | "es" | "fr" | "hi" | "ar";

export interface VoiceRequest {
  language?: VoiceLanguage;
  focus?: "summary" | "runway" | "changes" | "biggest_risk" | "scenario";
  scenario?: ScenarioRequest | null;
}

export interface VoiceResponse {
  language?: VoiceLanguage;
  text: string;
  financial_state: FinancialState;
  signal_ids: string[];
  scenario: ScenarioResult | null;
  provider: ProviderMetadata;
  audio_base64: string | null;
  audio_mime_type: "audio/mpeg" | null;
}

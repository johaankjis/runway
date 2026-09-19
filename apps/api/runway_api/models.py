from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


Money = Annotated[int, Field(description="Integer USD cents")]
NonNegativeMoney = Annotated[int, Field(ge=0, description="Non-negative integer USD cents")]


class ImpactLevel(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Business(StrictModel):
    id: str
    name: str
    industry: str
    owner_name: str
    currency: Literal["USD"] = "USD"
    timezone: str


class CashFlowDirection(StrEnum):
    INFLOW = "inflow"
    OUTFLOW = "outflow"


class CashFlowStatus(StrEnum):
    EXPECTED = "expected"
    OVERDUE = "overdue"
    SCHEDULED = "scheduled"


class CashFlowEntry(StrictModel):
    id: str
    direction: CashFlowDirection
    amount_cents: Annotated[int, Field(gt=0)]
    description: str
    expected_date: date
    status: CashFlowStatus
    source_document_id: str | None = None


class FinancialState(StrictModel):
    business_id: str
    as_of: date
    forecast_end_date: date
    current_cash_cents: NonNegativeMoney
    expected_inflows_cents: NonNegativeMoney
    expected_outflows_cents: NonNegativeMoney
    projected_ending_cash_cents: Money
    minimum_cash_reserve_cents: NonNegativeMoney
    projected_shortfall_cents: NonNegativeMoney
    average_daily_net_burn_cents: NonNegativeMoney
    cash_runway_days: int | None
    cash_flow: list[CashFlowEntry]

    @model_validator(mode="after")
    def validate_calculated_values(self) -> FinancialState:
        cash_flow_inflows = sum(
            entry.amount_cents
            for entry in self.cash_flow
            if entry.direction == CashFlowDirection.INFLOW
        )
        cash_flow_outflows = sum(
            entry.amount_cents
            for entry in self.cash_flow
            if entry.direction == CashFlowDirection.OUTFLOW
        )
        if self.expected_inflows_cents != cash_flow_inflows:
            raise ValueError("expected inflows must equal the inflow cash-flow entries")
        if self.expected_outflows_cents != cash_flow_outflows:
            raise ValueError("expected outflows must equal the outflow cash-flow entries")

        expected_ending = (
            self.current_cash_cents + self.expected_inflows_cents - self.expected_outflows_cents
        )
        if self.projected_ending_cash_cents != expected_ending:
            raise ValueError("projected ending cash must match cash plus inflows minus outflows")

        expected_shortfall = max(
            0, self.minimum_cash_reserve_cents - self.projected_ending_cash_cents
        )
        if self.projected_shortfall_cents != expected_shortfall:
            raise ValueError("projected shortfall must be the gap to the minimum cash reserve")

        expected_runway = (
            self.current_cash_cents // self.average_daily_net_burn_cents
            if self.average_daily_net_burn_cents
            else None
        )
        if self.cash_runway_days != expected_runway:
            raise ValueError("cash runway must be derived from current cash and daily net burn")
        return self


class FinancialEffectKind(StrEnum):
    EXPENSE_INCREASE = "expense_increase"
    DELAYED_INFLOW = "delayed_inflow"
    REVENUE_DECREASE = "revenue_decrease"
    SCHEDULED_OUTFLOW = "scheduled_outflow"
    RISK_INDICATOR = "risk_indicator"


class CalculationStatus(StrEnum):
    APPLIED = "applied"
    OBSERVED = "observed"
    NOT_QUANTIFIED = "not_quantified"


class FinancialEffect(StrictModel):
    kind: FinancialEffectKind
    amount_cents: NonNegativeMoney | None = None
    percentage: Annotated[float, Field(ge=0)] | None = None
    cadence: Literal["one_time", "weekly", "monthly"] | None = None
    calculation_status: CalculationStatus
    description: str


class SignalEvidence(StrictModel):
    id: str
    source_document_id: str
    source_type: Literal["document"] = "document"
    excerpt: Annotated[str, Field(min_length=1)]
    locator: Annotated[str, Field(min_length=1)]


class Signal(StrictModel):
    id: str
    type: str
    title: str
    description: str
    category: str
    impact_level: ImpactLevel
    confidence: Annotated[float, Field(ge=0, le=1)]
    detected_at: datetime
    financial_effect: FinancialEffect
    evidence: Annotated[list[SignalEvidence], Field(min_length=1)]
    source_document_id: str

    @model_validator(mode="after")
    def validate_provenance(self) -> Signal:
        if not any(item.source_document_id == self.source_document_id for item in self.evidence):
            raise ValueError("signal evidence must reference the signal's source document")
        return self


class Document(StrictModel):
    id: str
    title: str
    document_type: str
    filename: str
    mime_type: str
    document_date: date
    ingested_at: datetime
    source: Literal["fixture"] = "fixture"
    summary: str
    checksum_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    related_signal_ids: list[str]


class RecommendationStatus(StrEnum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    DISMISSED = "dismissed"


class Recommendation(StrictModel):
    id: str
    title: str
    description: str
    priority: ImpactLevel
    status: RecommendationStatus
    rationale: str
    related_signal_ids: Annotated[list[str], Field(min_length=1)]


class ScenarioRequest(StrictModel):
    name: Annotated[str, Field(min_length=1, max_length=80)] = "Custom scenario"
    revenue_change_percent: Annotated[float, Field(ge=-100, le=300)] = 0
    expense_change_percent: Annotated[float, Field(ge=-100, le=300)] = 0
    cash_adjustment_cents: Annotated[int, Field(ge=-100_000_000, le=100_000_000)] = 0


class ScenarioSnapshot(StrictModel):
    current_cash_cents: Money
    expected_inflows_cents: NonNegativeMoney
    expected_outflows_cents: NonNegativeMoney
    projected_ending_cash_cents: Money
    minimum_cash_reserve_cents: NonNegativeMoney
    projected_shortfall_cents: NonNegativeMoney
    average_daily_net_burn_cents: NonNegativeMoney
    cash_runway_days: int | None


class ScenarioResult(StrictModel):
    id: str
    name: str
    request: ScenarioRequest
    baseline: ScenarioSnapshot
    projected: ScenarioSnapshot
    assumptions: list[str]
    calculated_at: datetime


class FinancialStateInput(StrictModel):
    as_of: date
    forecast_end_date: date
    current_cash_cents: NonNegativeMoney
    minimum_cash_reserve_cents: NonNegativeMoney
    average_daily_net_burn_cents: NonNegativeMoney
    cash_flow: list[CashFlowEntry]


class DemoFixture(StrictModel):
    business: Business
    financial_state_input: FinancialStateInput
    signals: list[Signal]
    documents: list[Document]
    recommendations: list[Recommendation]


class HealthResponse(StrictModel):
    status: Literal["ok"] = "ok"


class ResetResponse(StrictModel):
    status: Literal["reset"] = "reset"
    business_id: str

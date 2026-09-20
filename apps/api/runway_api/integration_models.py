"""Untrusted extraction facts and provider metadata; no model-generated financial totals."""

from typing import Literal

from runway_api.models import (
    FinancialState,
    ProviderMetadata,
    ScenarioRequest,
    ScenarioResult,
    Signal,
    StrictModel,
)


class ExtractionResponse(StrictModel):
    signal: Signal
    financial_state: FinancialState
    application_status: Literal["already_in_baseline"] = "already_in_baseline"


class VoiceRequest(StrictModel):
    focus: Literal["summary", "runway", "changes", "biggest_risk", "scenario"] = "summary"
    scenario: ScenarioRequest | None = None


class VoiceResponse(StrictModel):
    text: str
    financial_state: FinancialState
    signal_ids: list[str]
    scenario: ScenarioResult | None = None
    provider: ProviderMetadata
    audio_base64: str | None = None
    audio_mime_type: Literal["audio/mpeg"] | None = None

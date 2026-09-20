"""Untrusted extraction facts and provider metadata; no model-generated financial totals."""

from typing import Literal

from pydantic import Field, field_validator

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
    application_status: Literal[
        "already_in_baseline", "proposed", "potential_duplicate", "incorporated"
    ] = "already_in_baseline"


VoiceLanguage = Literal["en", "es", "fr", "hi", "ar"]


class VoiceRequest(StrictModel):
    language: VoiceLanguage = "en"
    focus: Literal["summary", "runway", "changes", "biggest_risk", "scenario"] = "summary"
    scenario: ScenarioRequest | None = None


class VoiceResponse(StrictModel):
    language: VoiceLanguage = "en"
    text: str
    financial_state: FinancialState
    signal_ids: list[str]
    scenario: ScenarioResult | None = None
    provider: ProviderMetadata
    audio_base64: str | None = None
    audio_mime_type: Literal["audio/mpeg"] | None = None


class VoiceQuestionRequest(StrictModel):
    question: str = Field(min_length=1, max_length=500)
    language: VoiceLanguage = "en"

    @field_validator("question")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Question must not be blank")
        return value.strip()


class VoiceQuestionResponse(VoiceResponse):
    question: str
    answer_provider: ProviderMetadata
    grounding: Literal["verified", "deterministic_fallback"]

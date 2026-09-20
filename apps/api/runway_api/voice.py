"""Deterministic briefing text followed by optional speech synthesis."""

import base64
from decimal import Decimal
from typing import Protocol
from urllib.parse import quote

import httpx

from runway_api.extraction import ProviderFailure
from runway_api.financial_engine import calculate_scenario
from runway_api.integration_models import VoiceRequest, VoiceResponse
from runway_api.models import ProviderMetadata
from runway_api.provider_config import ProviderSettings
from runway_api.repository import InMemoryRepository


class VoiceProvider(Protocol):
    def synthesize(self, text: str) -> bytes | None: ...


class FixtureVoiceProvider:
    def synthesize(self, text: str) -> None:
        """Text-only mock. Never label silence or a canned recording as this briefing."""
        return None


class ElevenLabsVoiceProvider:
    def __init__(self, settings: ProviderSettings) -> None:
        self.settings = settings

    def synthesize(self, text: str) -> bytes:
        settings = self.settings
        if not settings.elevenlabs_api_key.get_secret_value() or not settings.elevenlabs_voice_id:
            raise ProviderFailure("missing_credentials")
        voice_id = quote(settings.elevenlabs_voice_id, safe="")
        with httpx.Client(timeout=settings.elevenlabs_timeout_seconds) as client:
            response = client.post(
                f"{settings.elevenlabs_base_url.rstrip('/')}/text-to-speech/{voice_id}",
                headers={"xi-api-key": settings.elevenlabs_api_key.get_secret_value()},
                params={"output_format": "mp3_44100_128"},
                json={"text": text, "model_id": settings.elevenlabs_model},
            )
            response.raise_for_status()
        if (
            response.headers.get("content-type", "").split(";")[0] != "audio/mpeg"
            or not response.content
            or len(response.content) > 10_000_000
        ):
            raise ProviderFailure("invalid_output")
        return response.content


def _money(cents: int) -> str:
    return f"${Decimal(cents) / 100:,.2f}"


def create_briefing(
    repo: InMemoryRepository,
    request: VoiceRequest,
    settings: ProviderSettings,
) -> VoiceResponse:
    if (request.focus == "scenario") != (request.scenario is not None):
        raise ValueError("Provide scenario parameters exactly when focus is scenario")
    state = repo.get_financial_state()
    signals = repo.list_signals()
    runway = f"{state.cash_runway_days} days" if state.cash_runway_days is not None else "unbounded"
    text = (
        f"As of {state.as_of}, cash is {_money(state.current_cash_cents)}. "
        f"Expected inflows are {_money(state.expected_inflows_cents)} and expected outflows "
        f"are {_money(state.expected_outflows_cents)}. Projected ending cash is "
        f"{_money(state.projected_ending_cash_cents)}, with a reserve shortfall of "
        f"{_money(state.projected_shortfall_cents)}. Cash runway is {runway}."
    )
    referenced = []
    if request.focus == "runway":
        text += (
            f" Runway uses the recorded daily net burn of "
            f"{_money(state.average_daily_net_burn_cents)}. "
            "No previous snapshot is available to measure a decline."
        )
    elif request.focus == "changes":
        referenced = [signal.id for signal in signals]
        text += " Recorded warnings: " + "; ".join(signal.title for signal in signals) + "."
        text += " These belong to the demo snapshot; no live daily change feed is available."
    elif request.focus == "biggest_risk":
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        ranked = sorted(signals, key=lambda signal: (order[signal.impact_level], signal.id))
        if ranked:
            risk = ranked[0]
            referenced = [risk.id]
            text += f" Highest recorded severity: {risk.title}. {risk.description}"
    scenario = None
    if request.scenario is not None:
        scenario = calculate_scenario(state, request.scenario)
        projected = scenario.projected
        text += (
            f" Under the supplied scenario, projected ending cash is "
            f"{_money(projected.projected_ending_cash_cents)} and the reserve shortfall is "
            f"{_money(projected.projected_shortfall_cents)}. " + " ".join(scenario.assumptions)
        )
    provider = ProviderMetadata(
        requested_provider=settings.voice_provider,
        provider=settings.voice_provider,
        mode="fixture" if settings.voice_provider == "fixture" else "live",
        model=settings.elevenlabs_model if settings.voice_provider == "elevenlabs" else None,
    )
    synthesizer: VoiceProvider = (
        ElevenLabsVoiceProvider(settings)
        if settings.voice_provider == "elevenlabs"
        else FixtureVoiceProvider()
    )
    try:
        audio = synthesizer.synthesize(text)
    except (ProviderFailure, httpx.HTTPError) as error:
        provider = ProviderMetadata(
            requested_provider="elevenlabs",
            provider="fixture",
            mode="fallback",
            failure_reason=str(error)
            if isinstance(error, ProviderFailure)
            else "provider_unavailable",
        )
        audio = FixtureVoiceProvider().synthesize(text)
    return VoiceResponse(
        text=text,
        financial_state=state,
        signal_ids=referenced,
        scenario=scenario,
        provider=provider,
        audio_base64=base64.b64encode(audio).decode("ascii") if audio else None,
        audio_mime_type="audio/mpeg" if audio else None,
    )

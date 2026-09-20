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
from runway_api.voice_localization import TEMPLATES, numeric_facts, render_segment


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
    # One set of runtime fact slots feeds both English and localized presentation.
    segments = []
    runway = (
        TEMPLATES["en"]["days"].format(days=state.cash_runway_days)
        if state.cash_runway_days is not None
        else TEMPLATES["en"]["unbounded"]
    )
    segments.append(
        (
            "summary",
            dict(
                date=str(state.as_of),
                cash=_money(state.current_cash_cents),
                inflows=_money(state.expected_inflows_cents),
                outflows=_money(state.expected_outflows_cents),
                balance=_money(state.projected_ending_cash_cents),
                shortfall=_money(state.projected_shortfall_cents),
                runway=runway,
            ),
        )
    )
    referenced = []
    if request.focus == "runway":
        segments.append(("runway", dict(burn=_money(state.average_daily_net_burn_cents))))
    elif request.focus == "changes":
        referenced = [signal.id for signal in signals]
        segments.append(("changes", dict(warnings="; ".join(signal.title for signal in signals))))
    elif request.focus == "biggest_risk":
        order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        ranked = sorted(signals, key=lambda signal: (order[signal.impact_level], signal.id))
        if ranked:
            risk = ranked[0]
            referenced = [risk.id]
            segments.append(("risk", dict(title=risk.title, description=risk.description)))
    scenario = None
    if request.scenario is not None:
        scenario = calculate_scenario(state, request.scenario)
        projected = scenario.projected
        segments.append(
            (
                "scenario",
                dict(
                    balance=_money(projected.projected_ending_cash_cents),
                    shortfall=_money(projected.projected_shortfall_cents),
                    assumptions=" ".join(scenario.assumptions),
                ),
            )
        )
    english = "".join(TEMPLATES["en"][key].format(**facts) for key, facts in segments)
    text = english
    language = request.language
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
        localized = []
        for key, facts in segments:
            facts = facts.copy()
            if key == "summary":
                facts["runway"] = (
                    render_segment(language, "days", days=str(state.cash_runway_days))
                    if state.cash_runway_days is not None
                    else render_segment(language, "unbounded")
                )
            localized.append(render_segment(language, key, **facts))
        candidate = "".join(localized)
        if numeric_facts(candidate) != numeric_facts(english):
            raise ProviderFailure("grounding_validation_failed")
        text = candidate
        audio = synthesizer.synthesize(text)
    except (ProviderFailure, httpx.HTTPError) as error:
        provider = ProviderMetadata(
            requested_provider=settings.voice_provider,
            provider="fixture",
            mode="fallback",
            failure_reason=str(error)
            if isinstance(error, ProviderFailure)
            else "provider_unavailable",
        )
        if isinstance(error, ProviderFailure) and str(error) == "grounding_validation_failed":
            text = english
            language = "en"
        audio = FixtureVoiceProvider().synthesize(text)
    return VoiceResponse(
        language=language,
        text=text,
        financial_state=state,
        signal_ids=referenced,
        scenario=scenario,
        provider=provider,
        audio_base64=base64.b64encode(audio).decode("ascii") if audio else None,
        audio_mime_type="audio/mpeg" if audio else None,
    )

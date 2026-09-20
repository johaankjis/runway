"""Multilingual presentation must preserve the existing English financial facts."""

import re
from pathlib import Path

import httpx
import pytest
from pydantic import ValidationError
from runway_api.integration_models import VoiceRequest
from runway_api.models import ScenarioRequest
from runway_api.provider_config import ProviderSettings
from runway_api.voice import create_briefing
from runway_api.voice_localization import TEMPLATES

LANGUAGES = {"en": "18 days", "es": "18 días", "fr": "18 jours", "hi": "18 दिन", "ar": "18 يومًا"}


def numbers(text):
    # Independent assertion includes currency precision, signs, percentages and dates.
    return re.findall(r"[$]?[+-]?\d+(?:[.,:/-]\d+)*%?", text)


def test_omitted_language_is_original_english(client):
    default = client.post("/api/voice/briefing", json={}).json()
    explicit = client.post("/api/voice/briefing", json={"language": "en"}).json()
    assert default == explicit
    assert client.post("/api/voice/briefing").json() == explicit
    assert default["text"] == (
        "As of 2026-09-19, cash is $43,200.00. Expected inflows are $19,400.00 and "
        "expected outflows are $51,700.00. Projected ending cash is $10,900.00, "
        "with a reserve shortfall of $4,800.00. Cash runway is 18 days."
    )


@pytest.mark.parametrize("language", LANGUAGES)
@pytest.mark.parametrize("focus", ["summary", "runway", "changes", "biggest_risk", "scenario"])
def test_languages_preserve_facts_and_have_no_side_effects(repository, language, focus):
    before = (
        repository.dump_for_debugging(),
        repository.list_signals(),
        repository.list_documents(),
        repository.list_recommendations(),
    )
    args = {"focus": focus}
    if focus == "scenario":
        args["scenario"] = ScenarioRequest(
            expense_change_percent=5.25, cash_adjustment_cents=-12345
        )
    english = create_briefing(repository, VoiceRequest(**args), ProviderSettings())
    for _ in range(2):
        result = create_briefing(
            repository, VoiceRequest(language=language, **args), ProviderSettings()
        )
        assert result.language == language
        assert LANGUAGES[language] in result.text
        assert numbers(result.text) == numbers(english.text)
        assert result.financial_state == english.financial_state
        assert result.signal_ids == english.signal_ids
        if result.scenario:
            assert result.scenario.projected == english.scenario.projected
        assert result.provider.mode == "fixture"
        assert result.audio_base64 is None
    assert before == (
        repository.dump_for_debugging(),
        repository.list_signals(),
        repository.list_documents(),
        repository.list_recommendations(),
    )


@pytest.mark.parametrize("language", ["de", "EN", "", None, 42])
def test_unsupported_language_rejected(client, language):
    with pytest.raises(ValidationError):
        VoiceRequest(language=language)
    assert client.post("/api/voice/briefing", json={"language": language}).status_code == 422


@pytest.mark.parametrize("language", LANGUAGES)
@pytest.mark.parametrize("failure", [None, "missing", "timeout", "invalid"])
def test_localized_tts_and_fallback(repository, monkeypatch, language, failure):
    calls = []

    def post(self, url, **kwargs):
        calls.append(kwargs["json"])
        if failure == "timeout":
            raise httpx.ReadTimeout("unavailable")
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            headers={"content-type": "application/json" if failure == "invalid" else "audio/mpeg"},
            content=b"ID3test",
        )

    monkeypatch.setattr(httpx.Client, "post", post)
    result = create_briefing(
        repository,
        VoiceRequest(language=language),
        ProviderSettings(
            voice_provider="elevenlabs",
            elevenlabs_api_key="" if failure == "missing" else "test",
            elevenlabs_voice_id="demo",
        ),
    )
    assert LANGUAGES[language] in result.text
    assert result.language == language
    if failure == "missing":
        assert not calls
    else:
        assert calls == [{"text": result.text, "model_id": "eleven_multilingual_v2"}]
    assert result.provider.mode == ("live" if failure is None else "fallback")
    assert result.audio_base64 == ("SUQzdGVzdA==" if failure is None else None)


@pytest.mark.parametrize(
    "tamper", ["number", "swap", "duplicate", "omit", "date", "percent", "malformed"]
)
def test_grounding_failure_never_calls_tts(repository, monkeypatch, tamper):
    original = TEMPLATES["es"]["summary"]
    changed = {
        "malformed": original + " {",
        "number": original + " 999",
        "swap": original.replace("{cash}", "{inflows}", 1),
        "duplicate": original + " {cash}",
        "omit": original.replace("{shortfall}", ""),
        "date": original.replace("{date}", "2020-01-01"),
        "percent": original + " 12%",
    }[tamper]
    monkeypatch.setitem(TEMPLATES["es"], "summary", changed)

    def forbidden(*args, **kwargs):
        pytest.fail("Invalid localized text reached ElevenLabs")

    monkeypatch.setattr(httpx.Client, "post", forbidden)
    result = create_briefing(
        repository,
        VoiceRequest(language="es"),
        ProviderSettings(
            voice_provider="elevenlabs",
            elevenlabs_api_key="test",
            elevenlabs_voice_id="demo",
        ),
    )
    assert result.provider.mode == "fallback"
    assert result.provider.failure_reason == "grounding_validation_failed"
    assert result.language == "en"
    assert result.audio_base64 is None
    assert result.text == create_briefing(repository, VoiceRequest(), ProviderSettings()).text


@pytest.mark.parametrize("language", LANGUAGES)
@pytest.mark.parametrize("burn", [0, 234567])
def test_changed_runtime_values_and_unbounded_runway(repository, language, burn):
    from runway_api.financial_engine import calculate_financial_state
    from runway_api.models import FinancialStateInput

    state = repository.get_financial_state()
    inputs = FinancialStateInput(
        **{key: getattr(state, key) for key in FinancialStateInput.model_fields}
    )
    inputs.current_cash_cents = 1234567
    inputs.average_daily_net_burn_cents = burn
    repository._financial_state = calculate_financial_state(state.business_id, inputs)
    english = create_briefing(repository, VoiceRequest(focus="runway"), ProviderSettings())
    result = create_briefing(
        repository, VoiceRequest(language=language, focus="runway"), ProviderSettings()
    )
    assert "$12,345.67" in result.text
    assert numbers(result.text) == numbers(english.text)
    assert result.provider.mode == "fixture"


def test_arabic_ui_rtl_is_scoped_to_response_text():
    # Static regression check: this project has no frontend component test runner.
    view = (Path(__file__).parents[1] / "apps/web/components/views/VoiceView.tsx").read_text()
    paragraph = re.search(r"<p\s+lang=.*?</p>", view, re.S).group()
    assert 'dir={briefing.response.language === "ar" ? "rtl" : "ltr"}' in paragraph
    assert "{briefing.response.text}" in paragraph
    assert view.count("dir=") == 1
    assert "...prompt.request, language" in view
    assert 'useState<VoiceLanguage>("en")' in view
    assert re.findall(r'<option value="(.*?)">', view) == list(LANGUAGES)

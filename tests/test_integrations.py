import json
from datetime import date

import httpx
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from runway_api.extraction import (
    FixtureSignalExtractor,
    extract_document,
    validate_evidence,
)
from runway_api.integration_models import VoiceRequest
from runway_api.main import create_app
from runway_api.models import SupplierFacts
from runway_api.provider_config import ProviderSettings
from runway_api.repository import REPOSITORY_ROOT
from runway_api.voice import create_briefing


@pytest.fixture
def source(repository):
    document = repository.list_documents()[0]
    content = (REPOSITORY_ROOT / "data/documents" / document.filename).read_text()
    return document, content


@pytest.fixture
def facts(source):
    return FixtureSignalExtractor().extract(*source)


def test_fixture_facts_and_validation(facts, source):
    assert facts.entity == "Metro Foods"
    assert facts.percentage == 18
    assert facts.monthly_increase_usd == 2140
    assert facts.effective_date == date(2026, 9, 15)
    assert SupplierFacts.model_validate_json(facts.model_dump_json()) == facts
    validate_evidence(facts, *source)


@pytest.mark.parametrize(
    "field,value",
    [
        ("type", "runway_calculation"),
        ("confidence", -0.1),
        ("confidence", 1.1),
        ("confidence", True),
        ("percentage", -18),
        ("percentage", "18"),
        ("percentage", float("nan")),
        ("percentage", float("inf")),
        ("percentage", True),
        ("monthly_increase_usd", -1),
        ("monthly_increase_usd", "2140"),
        ("monthly_increase_usd", float("inf")),
        ("effective_date", "2026-02-30"),
        ("source_document_id", ""),
        ("excerpt", ""),
    ],
)
def test_reject_invalid_fields(facts, field, value):
    payload = facts.model_dump()
    payload[field] = value
    with pytest.raises(ValidationError):
        SupplierFacts.model_validate(payload)


@pytest.mark.parametrize("field", ["excerpt", "source_document_id", "confidence", "entity"])
def test_required_fields(facts, field):
    payload = facts.model_dump()
    del payload[field]
    with pytest.raises(ValidationError):
        SupplierFacts.model_validate(payload)


@pytest.mark.parametrize(
    "field,value",
    [
        ("source_document_id", "wrong"),
        ("entity", "Invented Foods"),
        ("percentage", 19.0),
        ("monthly_increase_usd", 9000.0),
        ("effective_date", None),
        ("excerpt", "Invented supporting evidence that is not in the source"),
    ],
)
def test_reject_ungrounded_facts(facts, source, field, value):
    payload = facts.model_dump()
    payload[field] = value
    with pytest.raises(ValueError):
        validate_evidence(SupplierFacts.model_validate(payload), *source)


def test_reject_model_financial_totals(facts):
    with pytest.raises(ValidationError):
        SupplierFacts.model_validate({**facts.model_dump(), "cash_runway_days": 3})


def test_extraction_endpoint_persists_provenance_and_preserves_engine(client):
    baseline = client.get("/api/financial-state").json()
    for _ in range(2):
        response = client.post("/api/documents/doc-supplier-price-notice/extract")
        assert response.status_code == 200
        body = response.json()
        assert body["application_status"] == "already_in_baseline"
        assert body["financial_state"] == baseline
        signal = body["signal"]
        assert signal["financial_effect"]["amount_cents"] == 214000
        assert signal["extraction"]["provider"]["mode"] == "fixture"
        assert signal["evidence"][0]["locator"].startswith("lines 1-")
        assert client.get("/api/signals/signal-supplier-increase").json() == signal
    assert baseline["cash_runway_days"] == 18
    assert baseline["projected_shortfall_cents"] == 480000
    assert len(client.get("/api/signals").json()) == 5
    client.post("/api/demo/reset")
    assert client.get("/api/signals/signal-supplier-increase").json()["extraction"] is None


def test_unsupported_and_unknown_documents(client):
    assert client.post("/api/documents/missing/extract").status_code == 404
    assert client.post("/api/documents/doc-inv-1042/extract").status_code == 422


def mock_post(monkeypatch, handler):
    def post(self, url, **kwargs):
        return handler(httpx.Request("POST", url), kwargs)

    monkeypatch.setattr(httpx.Client, "post", post)


def test_nemotron_live_http_contract(repository, source, facts, monkeypatch):
    def handler(request, kwargs):
        assert str(request.url) == "https://integrate.api.nvidia.com/v1/chat/completions"
        assert kwargs["headers"]["Authorization"] == "Bearer test-key"
        assert kwargs["json"]["model"] == "nvidia/llama-3.3-nemotron-super-49b-v1"
        assert "Do not calculate" in kwargs["json"]["messages"][0]["content"]
        return httpx.Response(
            200,
            request=request,
            json={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {"content": facts.model_dump_json()},
                    }
                ]
            },
        )

    mock_post(monkeypatch, handler)
    result = extract_document(
        repository,
        source[0],
        ProviderSettings(
            signal_provider="nemotron",
            nvidia_api_key="test-key",
        ),
    )
    assert result.signal.extraction.provider.mode == "live"
    assert result.signal.extraction.provider.provider == "nemotron"


@pytest.mark.parametrize(
    "failure", ["timeout", "network", "429", "500", "json", "schema", "evidence"]
)
def test_nemotron_failure_fallback(repository, source, facts, monkeypatch, failure):
    def handler(request, kwargs):
        if failure == "timeout":
            raise httpx.ReadTimeout("secret provider details", request=request)
        if failure == "network":
            raise httpx.ConnectError("secret provider details", request=request)
        if failure.isdigit():
            return httpx.Response(int(failure), request=request)
        content = "bad json" if failure == "json" else "{}"
        if failure == "evidence":
            content = json.dumps({**facts.model_dump(mode="json"), "entity": "Invented"})
        return httpx.Response(
            200,
            request=request,
            json={
                "choices": [
                    {
                        "finish_reason": "stop",
                        "message": {"content": content},
                    }
                ]
            },
        )

    mock_post(monkeypatch, handler)
    result = extract_document(
        repository,
        source[0],
        ProviderSettings(
            signal_provider="nemotron",
            nvidia_api_key="test-key",
        ),
    )
    metadata = result.signal.extraction.provider
    assert metadata.mode == "fallback"
    assert metadata.provider == "fixture"
    assert metadata.requested_provider == "nemotron"
    assert metadata.failure_reason
    assert "secret" not in result.model_dump_json()


def test_absent_credentials_fallback(repository, source):
    result = extract_document(repository, source[0], ProviderSettings(signal_provider="nemotron"))
    assert result.signal.extraction.provider.failure_reason == "missing_credentials"


def test_source_tamper_fails_without_mutation(repository, source):
    document = source[0].model_copy(update={"checksum_sha256": "0" * 64})
    with pytest.raises(ValueError, match="checksum"):
        extract_document(repository, document, ProviderSettings())
    assert repository.get_signal("signal-supplier-increase").extraction is None


@pytest.mark.parametrize("focus", ["summary", "runway", "changes", "biggest_risk"])
def test_voice_fixture_grounded(client, focus):
    response = client.post("/api/voice/briefing", json={"focus": focus})
    assert response.status_code == 200
    body = response.json()
    assert body["financial_state"] == client.get("/api/financial-state").json()
    assert "$43,200.00" in body["text"] and "18 days" in body["text"]
    assert body["provider"]["mode"] == "fixture"
    assert body["audio_base64"] is None


def test_voice_uses_changed_state(repository):
    # The briefing must read the engine result, not fixed demo numbers.
    from runway_api.financial_engine import calculate_financial_state
    from runway_api.models import FinancialStateInput

    original = repository.get_financial_state()
    inputs = FinancialStateInput(
        **{key: getattr(original, key) for key in FinancialStateInput.model_fields}
    )
    inputs.current_cash_cents = 100000
    repository._financial_state = calculate_financial_state(original.business_id, inputs)
    result = create_briefing(repository, VoiceRequest(), ProviderSettings())
    assert "$1,000.00" in result.text
    assert "$43,200.00" not in result.text


def test_voice_scenario_uses_existing_engine(client):
    payload = {"name": "Costs", "expense_change_percent": 5}
    body = client.post(
        "/api/voice/briefing", json={"focus": "scenario", "scenario": payload}
    ).json()
    engine = client.post("/api/scenarios", json=payload).json()
    assert body["scenario"]["projected"] == engine["projected"]
    assert client.post("/api/voice/briefing", json={"focus": "scenario"}).status_code == 422
    assert client.post("/api/voice/briefing", json={"focus": "invented"}).status_code == 422


def test_elevenlabs_http_contract(repository, monkeypatch):
    def handler(request, kwargs):
        assert str(request.url).endswith("/text-to-speech/demo-voice")
        assert kwargs["json"]["model_id"] == "eleven_multilingual_v2"
        assert "$43,200.00" in kwargs["json"]["text"]
        assert kwargs["headers"]["xi-api-key"] == "test-key"
        return httpx.Response(
            200, request=request, headers={"content-type": "audio/mpeg"}, content=b"ID3test"
        )

    mock_post(monkeypatch, handler)
    result = create_briefing(
        repository,
        VoiceRequest(),
        ProviderSettings(
            voice_provider="elevenlabs",
            elevenlabs_api_key="test-key",
            elevenlabs_voice_id="demo-voice",
        ),
    )
    assert result.provider.mode == "live"
    assert result.audio_base64 == "SUQzdGVzdA=="
    assert result.audio_mime_type == "audio/mpeg"


@pytest.mark.parametrize("failure", ["missing", "timeout", "429", "invalid"])
def test_voice_failure_keeps_briefing(repository, monkeypatch, failure):
    def handler(request, kwargs):
        if failure == "timeout":
            raise httpx.ReadTimeout("private details", request=request)
        return httpx.Response(429 if failure == "429" else 200, request=request, json={})

    mock_post(monkeypatch, handler)
    result = create_briefing(
        repository,
        VoiceRequest(),
        ProviderSettings(
            voice_provider="elevenlabs",
            elevenlabs_api_key="" if failure == "missing" else "test",
            elevenlabs_voice_id="demo",
        ),
    )
    assert result.provider.mode == "fallback"
    assert result.audio_base64 is None
    assert "$43,200.00" in result.text


def test_env_selection(monkeypatch):
    monkeypatch.setenv("RUNWAY_SIGNAL_PROVIDER", "nemotron")
    monkeypatch.setenv("NVIDIA_TIMEOUT_SECONDS", "7")
    settings = ProviderSettings.from_environment()
    assert settings.signal_provider == "nemotron"
    assert settings.nvidia_timeout_seconds == 7
    monkeypatch.setenv("RUNWAY_SIGNAL_PROVIDER", "typo")
    with pytest.raises(ValueError):
        ProviderSettings.from_environment()


def test_fallback_api_metadata(repository):
    with TestClient(create_app(repository, ProviderSettings(signal_provider="nemotron"))) as client:
        response = client.post("/api/documents/doc-supplier-price-notice/extract")
        assert response.status_code == 200
        assert response.json()["signal"]["extraction"]["provider"]["mode"] == "fallback"

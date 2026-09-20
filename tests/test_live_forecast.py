"""Live forecast arithmetic, application policy, provenance and consumer regressions."""

from concurrent.futures import ThreadPoolExecutor
from datetime import date

import pytest
from pydantic import ValidationError
from runway_api.financial_engine import prorated_supplier_cost
from runway_api.models import FinancialState, Signal, SupplierFacts

from test_uploads import FRESHFIELDS, analyze, upload


def test_live_numbers_provenance_reset_and_consumers(client, repository):
    baseline = client.get("/api/financial-state").json()
    original_signals = client.get("/api/signals").json()
    original_recommendations = client.get("/api/recommendations").json()
    assert baseline["forecast_adjustments"] == []
    doc = upload(client).json()
    response = analyze(client, doc).json()
    state = response["financial_state"]
    expected = {
        "current_cash_cents": 4320000,
        "expected_inflows_cents": 1940000,
        "expected_outflows_cents": 5202584,
        "projected_ending_cash_cents": 1057416,
        "projected_shortfall_cents": 512584,
        "average_daily_net_burn_cents": 242421,
        "cash_runway_days": 17,
    }
    assert {key: state[key] for key in expected} == expected
    assert FinancialState.model_validate(state)
    (adjustment,) = state["forecast_adjustments"]
    assert adjustment["monthly_amount_cents"] == 56117
    assert adjustment["amount_cents"] == 32584
    assert adjustment["source_signal_id"] == response["signal"]["id"]
    assert adjustment["source_document_id"] == doc["id"]
    assert adjustment["source_filename"] == doc["filename"]
    assert adjustment["effective_date"] == "2026-10-01"
    assert adjustment["application_status"] == "incorporated"
    assert "18/31" in adjustment["calculation_explanation"]
    assert adjustment["applied_at"]
    for language in ("en", "es", "fr", "hi", "ar"):
        voice = client.post("/api/voice/briefing", json={"language": language}).json()
        assert voice["financial_state"] == state
        assert "52,025.84" in voice["text"]
        assert "5,125.84" in voice["text"]
    scenario = client.post("/api/scenarios", json={}).json()
    assert scenario["baseline"] == scenario["projected"]
    assert scenario["baseline"]["expected_outflows_cents"] == 5202584
    voice_scenario = client.post(
        "/api/voice/briefing", json={"focus": "scenario", "scenario": {}}
    ).json()
    assert voice_scenario["scenario"]["baseline"] == scenario["baseline"]
    recommendation = client.get("/api/recommendations").json()[0]
    assert "5,125.84" in recommendation["rationale"]
    assert recommendation["related_signal_ids"] == [response["signal"]["id"]]
    assert analyze(client, doc).json() == response
    duplicate = analyze(client, upload(client).json()).json()
    assert duplicate["application_status"] == "potential_duplicate"
    assert duplicate["financial_state"] == state
    # Returned objects cannot mutate the ledger.
    copy = repository.get_financial_state()
    copy.forecast_adjustments.clear()
    assert client.get("/api/financial-state").json() == state
    assert client.post("/api/demo/reset").status_code == 200
    assert client.get("/api/financial-state").json() == baseline
    assert client.get("/api/signals").json() == original_signals
    assert client.get("/api/recommendations").json() == original_recommendations
    assert analyze(client, doc).status_code == 404


@pytest.mark.parametrize(
    "start,end,expected",
    [
        ("2026-10-01", "2026-10-18", 32584),
        ("2026-10-18", "2026-10-18", 1810),
        ("2026-10-19", "2026-10-18", 0),
        ("2026-10-01", "2026-10-31", 56117),
        ("2026-09-19", "2026-10-18", 55031),
        ("2028-02-01", "2028-02-29", 56117),
    ],
)
def test_calendar_proration(start, end, expected):
    amount, _ = prorated_supplier_cost(56117, date.fromisoformat(start), date.fromisoformat(end))
    assert amount == expected


def test_outside_window_stays_proposed(client):
    baseline = client.get("/api/financial-state").json()
    raw = FRESHFIELDS.replace(b"October 1, 2026", b"October 19, 2026")
    response = analyze(client, upload(client, raw).json()).json()
    assert response["application_status"] == "proposed"
    assert response["financial_state"] == baseline


def test_explicit_monthly_amount(client):
    raw = (
        "# Other Supplier — Pricing Update\n"
        "**Effective date:** October 1, 2026\n"
        "We apply an average 5% price increase, estimated to add $310 per month.\n"
    ).encode()
    result = analyze(client, upload(client, raw).json()).json()
    (adjustment,) = result["financial_state"]["forecast_adjustments"]
    assert adjustment["monthly_amount_cents"] == 31000
    assert adjustment["amount_cents"] == 18000


@pytest.mark.parametrize(
    "text",
    [
        b"Customer announces layoffs affecting our local market.",
        b"Supplier warns costs may increase soon.",
        FRESHFIELDS.replace(b"Current weekly spend: $1,850\n", b""),
    ],
)
def test_qualitative_or_missing_inputs_never_change_state(client, text):
    baseline = client.get("/api/financial-state").json()
    assert analyze(client, upload(client, text).json()).status_code == 422
    assert client.get("/api/financial-state").json() == baseline


def test_repository_rejects_forged_provenance(client, repository):
    result = analyze(client, upload(client).json()).json()
    signal = Signal.model_validate(result["signal"])
    new_doc = upload(client).json()
    signal.id = f"signal-{new_doc['id']}"
    signal.source_document_id = new_doc["id"]
    signal.evidence[0].source_document_id = new_doc["id"]
    signal.extraction.attributes.source_document_id = new_doc["id"]
    signal.extraction.attributes.weekly_spend_usd = 2000
    signal.disposition = "proposed"
    before = repository.get_financial_state()
    with pytest.raises(ValueError, match="Facts not supported"):
        repository.save_uploaded_signal(signal)
    assert repository.get_financial_state() == before


def test_unsupported_type_not_allowlisted(client, repository):
    response = analyze(client, upload(client).json()).json()
    signal = Signal.model_validate(response["signal"])
    repository.reset()
    doc = upload(client).json()
    signal.id = f"signal-{doc['id']}"
    signal.source_document_id = doc["id"]
    signal.evidence[0].source_document_id = doc["id"]
    signal.extraction.attributes.source_document_id = doc["id"]
    signal.disposition = "proposed"
    signal.type = "customer_layoffs_announced"
    baseline = repository.get_financial_state()
    saved = repository.save_uploaded_signal(signal)
    assert saved.disposition == "proposed"
    assert repository.get_financial_state() == baseline


def test_invalid_amount_basis_cannot_enter_ledger():
    with pytest.raises(ValidationError):
        SupplierFacts(
            type="supplier_pricing_increase",
            source_document_id="doc",
            entity="Supplier",
            percentage=7.0,
            effective_date=None,
            confidence=1.0,
            excerpt="No quantified inputs are present here.",
        )


def test_concurrent_identical_uploads_apply_once(client, repository):
    from runway_api.extraction import extract_document
    from runway_api.models import Document
    from runway_api.provider_config import ProviderSettings

    docs = [Document.model_validate(upload(client).json()) for _ in range(4)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(
            pool.map(lambda doc: extract_document(repository, doc, ProviderSettings()), docs)
        )
    assert sum(r.signal.disposition == "incorporated" for r in results) == 1
    assert len(repository.get_financial_state().forecast_adjustments) == 1


def test_ledger_contract(client):
    schemas = client.get("/openapi.json").json()["components"]["schemas"]
    assert "ForecastAdjustment" in schemas
    assert "forecast_adjustments" in schemas["FinancialState"]["properties"]
    assert "incorporated" in schemas["Signal"]["properties"]["disposition"]["enum"]


def test_multiple_adjustments_recompute_from_original_base(client):
    analyze(client, upload(client).json())
    raw = FRESHFIELDS.replace(b"FreshFields Produce", b"Another Supplier")
    result = analyze(client, upload(client, raw).json()).json()
    state = result["financial_state"]
    assert len(state["forecast_adjustments"]) == 2
    assert state["expected_outflows_cents"] == 5170000 + 2 * 32584
    assert state["average_daily_net_burn_cents"] == 244842
    assert state["current_cash_cents"] == 4320000
    metro = client.post("/api/documents/doc-supplier-price-notice/extract").json()
    assert metro["application_status"] == "already_in_baseline"
    assert metro["financial_state"] == state


def test_effective_before_window_does_not_backfill(client):
    raw = FRESHFIELDS.replace(b"October 1, 2026", b"September 1, 2026")
    response = analyze(client, upload(client, raw).json()).json()
    (adjustment,) = response["financial_state"]["forecast_adjustments"]
    assert adjustment["amount_cents"] == 55031
    assert "12/30" in adjustment["calculation_explanation"]
    assert "18/31" in adjustment["calculation_explanation"]


def test_missing_effective_date_changes_nothing(client):
    baseline = client.get("/api/financial-state").json()
    raw = FRESHFIELDS.replace(b"Effective date: October 1, 2026", b"Effective date: unknown")
    assert analyze(client, upload(client, raw).json()).status_code == 422
    assert client.get("/api/financial-state").json() == baseline

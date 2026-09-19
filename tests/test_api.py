from pathlib import Path

from fastapi.testclient import TestClient
from runway_api.repository import REPOSITORY_ROOT


def test_health(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_business(client: TestClient) -> None:
    response = client.get("/api/business")

    assert response.status_code == 200
    assert response.json() == {
        "id": "business-maya-catering",
        "name": "Maya's Catering Co.",
        "industry": "Catering and events",
        "owner_name": "Maya Patel",
        "currency": "USD",
        "timezone": "America/New_York",
    }


def test_financial_state_is_calculated_from_cash_flows(client: TestClient) -> None:
    response = client.get("/api/financial-state")

    assert response.status_code == 200
    state = response.json()
    assert state["current_cash_cents"] == 4_320_000
    assert state["expected_inflows_cents"] == 1_940_000
    assert state["expected_outflows_cents"] == 5_170_000
    assert state["projected_ending_cash_cents"] == 1_090_000
    assert state["minimum_cash_reserve_cents"] == 1_570_000
    assert state["projected_shortfall_cents"] == 480_000
    assert state["average_daily_net_burn_cents"] == 240_000
    assert state["cash_runway_days"] == 18
    assert (
        sum(entry["amount_cents"] for entry in state["cash_flow"] if entry["direction"] == "inflow")
        == state["expected_inflows_cents"]
    )
    assert (
        sum(
            entry["amount_cents"] for entry in state["cash_flow"] if entry["direction"] == "outflow"
        )
        == state["expected_outflows_cents"]
    )


def test_signals_have_traceable_document_evidence(client: TestClient) -> None:
    signals_response = client.get("/api/signals")
    documents_response = client.get("/api/documents")

    assert signals_response.status_code == 200
    assert documents_response.status_code == 200
    signals = signals_response.json()
    document_ids = {document["id"] for document in documents_response.json()}
    assert len(signals) == 5
    assert {signal["type"] for signal in signals} == {
        "supplier_pricing_increase",
        "invoice_overdue",
        "weekly_revenue_decline",
        "payroll_upcoming",
        "customer_layoffs_announced",
    }
    for signal in signals:
        assert signal["source_document_id"] in document_ids
        assert signal["evidence"]
        assert signal["source_document_id"] in {
            evidence["source_document_id"] for evidence in signal["evidence"]
        }


def test_signal_detail_and_not_found(client: TestClient) -> None:
    response = client.get("/api/signals/signal-invoice-overdue")

    assert response.status_code == 200
    assert response.json()["financial_effect"]["amount_cents"] == 1_240_000

    missing = client.get("/api/signals/not-a-signal")
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Signal 'not-a-signal' was not found"


def test_document_checksums_match_fixture_files(client: TestClient) -> None:
    import hashlib

    response = client.get("/api/documents")

    assert response.status_code == 200
    for document in response.json():
        document_path = Path(REPOSITORY_ROOT, "data", "documents", document["filename"])
        digest = hashlib.sha256(document_path.read_bytes()).hexdigest()
        assert digest == document["checksum_sha256"]


def test_recommendations_reference_known_signals(client: TestClient) -> None:
    recommendations = client.get("/api/recommendations")
    signals = client.get("/api/signals")

    assert recommendations.status_code == 200
    signal_ids = {item["id"] for item in signals.json()}
    assert len(recommendations.json()) == 3
    for recommendation in recommendations.json():
        assert set(recommendation["related_signal_ids"]) <= signal_ids


def test_scenario_is_deterministic_and_does_not_mutate_baseline(client: TestClient) -> None:
    payload = {
        "name": "Revenue pressure plus cost increase",
        "revenue_change_percent": -10,
        "expense_change_percent": 5,
        "cash_adjustment_cents": 500_000,
    }

    first = client.post("/api/scenarios", json=payload)
    second = client.post("/api/scenarios", json=payload)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["baseline"] == second.json()["baseline"]
    projected = first.json()["projected"]
    assert projected["current_cash_cents"] == 4_820_000
    assert projected["expected_inflows_cents"] == 1_746_000
    assert projected["expected_outflows_cents"] == 5_428_500
    assert projected["projected_ending_cash_cents"] == 1_137_500
    assert projected["projected_shortfall_cents"] == 432_500
    assert client.get("/api/financial-state").json()["current_cash_cents"] == 4_320_000


def test_scenario_request_validation(client: TestClient) -> None:
    response = client.post(
        "/api/scenarios",
        json={"name": "Impossible revenue", "revenue_change_percent": -101},
    )

    assert response.status_code == 422


def test_demo_reset(client: TestClient) -> None:
    response = client.post("/api/demo/reset")

    assert response.status_code == 200
    assert response.json() == {
        "status": "reset",
        "business_id": "business-maya-catering",
    }

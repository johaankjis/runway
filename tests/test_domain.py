import json
from datetime import UTC, date, datetime

import pytest
from pydantic import ValidationError
from runway_api.financial_engine import calculate_financial_state, calculate_scenario
from runway_api.models import (
    CashFlowDirection,
    CashFlowEntry,
    CashFlowStatus,
    FinancialState,
    FinancialStateInput,
    ScenarioRequest,
    Signal,
)
from runway_api.repository import DEFAULT_FIXTURE_PATH, InMemoryRepository


def test_financial_engine_sums_entries_and_derives_state() -> None:
    inputs = FinancialStateInput(
        as_of=date(2026, 9, 19),
        forecast_end_date=date(2026, 9, 30),
        current_cash_cents=100_000,
        minimum_cash_reserve_cents=70_000,
        average_daily_net_burn_cents=10_000,
        cash_flow=[
            CashFlowEntry(
                id="in",
                direction=CashFlowDirection.INFLOW,
                amount_cents=20_000,
                description="Expected payment",
                expected_date=date(2026, 9, 20),
                status=CashFlowStatus.EXPECTED,
            ),
            CashFlowEntry(
                id="out",
                direction=CashFlowDirection.OUTFLOW,
                amount_cents=80_000,
                description="Expected bill",
                expected_date=date(2026, 9, 21),
                status=CashFlowStatus.SCHEDULED,
            ),
        ],
    )

    state = calculate_financial_state("business-test", inputs)

    assert state.projected_ending_cash_cents == 40_000
    assert state.projected_shortfall_cents == 30_000
    assert state.cash_runway_days == 10


def test_financial_state_rejects_inconsistent_calculated_values() -> None:
    with pytest.raises(ValidationError, match="projected ending cash"):
        FinancialState(
            business_id="business-test",
            as_of=date(2026, 9, 19),
            forecast_end_date=date(2026, 9, 30),
            current_cash_cents=100_000,
            expected_inflows_cents=0,
            expected_outflows_cents=0,
            projected_ending_cash_cents=99_999,
            minimum_cash_reserve_cents=70_000,
            projected_shortfall_cents=0,
            average_daily_net_burn_cents=10_000,
            cash_runway_days=10,
            cash_flow=[],
        )


def test_signal_rejects_missing_primary_document_provenance() -> None:
    with pytest.raises(ValidationError, match="source document"):
        Signal.model_validate(
            {
                "id": "signal-test",
                "type": "test",
                "title": "Test signal",
                "description": "Test description",
                "category": "test",
                "impact_level": "low",
                "confidence": 0.5,
                "detected_at": "2026-09-19T09:00:00Z",
                "financial_effect": {
                    "kind": "risk_indicator",
                    "calculation_status": "not_quantified",
                    "description": "Not quantified",
                },
                "evidence": [
                    {
                        "id": "evidence-test",
                        "source_document_id": "doc-other",
                        "source_type": "document",
                        "excerpt": "Evidence text",
                        "locator": "paragraph 1",
                    }
                ],
                "source_document_id": "doc-primary",
            }
        )


def test_scenario_rounding_and_identifier_are_deterministic() -> None:
    inputs = FinancialStateInput(
        as_of=date(2026, 9, 19),
        forecast_end_date=date(2026, 9, 30),
        current_cash_cents=100_000,
        minimum_cash_reserve_cents=10_000,
        average_daily_net_burn_cents=10_000,
        cash_flow=[
            CashFlowEntry(
                id="in",
                direction="inflow",
                amount_cents=10_001,
                description="Expected payment",
                expected_date=date(2026, 9, 20),
                status="expected",
            ),
            CashFlowEntry(
                id="out",
                direction="outflow",
                amount_cents=20_000,
                description="Expected bill",
                expected_date=date(2026, 9, 21),
                status="scheduled",
            ),
        ],
    )
    baseline = calculate_financial_state("business-test", inputs)
    request = ScenarioRequest(name="Ten percent", revenue_change_percent=10)
    fixed_time = datetime(2026, 9, 19, 13, 0, tzinfo=UTC)

    first = calculate_scenario(baseline, request, calculated_at=fixed_time)
    second = calculate_scenario(baseline, request, calculated_at=fixed_time)

    assert first.id == second.id
    assert first.projected.expected_inflows_cents == 11_001
    assert first.calculated_at == fixed_time


def test_repository_rejects_evidence_for_unknown_document(tmp_path) -> None:
    fixture = json.loads(DEFAULT_FIXTURE_PATH.read_text(encoding="utf-8"))
    signal = fixture["signals"][0]
    signal["source_document_id"] = "doc-missing"
    signal["evidence"][0]["source_document_id"] = "doc-missing"
    invalid_fixture = tmp_path / "invalid-demo.json"
    invalid_fixture.write_text(json.dumps(fixture), encoding="utf-8")

    with pytest.raises(ValueError, match="unknown document"):
        InMemoryRepository(invalid_fixture)

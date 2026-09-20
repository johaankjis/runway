from __future__ import annotations

import json
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from uuid import NAMESPACE_URL, uuid5

from runway_api.models import (
    CashFlowDirection,
    FinancialState,
    FinancialStateInput,
    ScenarioRequest,
    ScenarioResult,
    ScenarioSnapshot,
    SupplierFacts,
)


def calculate_financial_state(business_id: str, inputs: FinancialStateInput) -> FinancialState:
    """Calculate the authoritative financial state from explicit fixture inputs."""
    expected_inflows = sum(
        entry.amount_cents
        for entry in inputs.cash_flow
        if entry.direction == CashFlowDirection.INFLOW
    )
    expected_outflows = sum(
        entry.amount_cents
        for entry in inputs.cash_flow
        if entry.direction == CashFlowDirection.OUTFLOW
    )
    projected_ending = inputs.current_cash_cents + expected_inflows - expected_outflows
    projected_shortfall = max(0, inputs.minimum_cash_reserve_cents - projected_ending)
    runway = (
        inputs.current_cash_cents // inputs.average_daily_net_burn_cents
        if inputs.average_daily_net_burn_cents
        else None
    )

    return FinancialState(
        business_id=business_id,
        as_of=inputs.as_of,
        forecast_end_date=inputs.forecast_end_date,
        current_cash_cents=inputs.current_cash_cents,
        expected_inflows_cents=expected_inflows,
        expected_outflows_cents=expected_outflows,
        projected_ending_cash_cents=projected_ending,
        minimum_cash_reserve_cents=inputs.minimum_cash_reserve_cents,
        projected_shortfall_cents=projected_shortfall,
        average_daily_net_burn_cents=inputs.average_daily_net_burn_cents,
        cash_runway_days=runway,
        cash_flow=inputs.cash_flow,
    )


def calculate_scenario(
    baseline: FinancialState,
    request: ScenarioRequest,
    *,
    calculated_at: datetime | None = None,
) -> ScenarioResult:
    """Apply scenario inputs with Decimal math; no generative model participates."""
    adjusted_current_cash = baseline.current_cash_cents + request.cash_adjustment_cents
    adjusted_inflows = _apply_percent(
        baseline.expected_inflows_cents, request.revenue_change_percent
    )
    adjusted_outflows = _apply_percent(
        baseline.expected_outflows_cents, request.expense_change_percent
    )
    adjusted_ending = adjusted_current_cash + adjusted_inflows - adjusted_outflows
    adjusted_shortfall = max(0, baseline.minimum_cash_reserve_cents - adjusted_ending)
    adjusted_burn = _scaled_daily_burn(
        baseline.average_daily_net_burn_cents,
        baseline.expected_outflows_cents - baseline.expected_inflows_cents,
        adjusted_outflows - adjusted_inflows,
    )
    adjusted_runway = max(0, adjusted_current_cash) // adjusted_burn if adjusted_burn else None

    baseline_snapshot = _snapshot(baseline)
    projected_snapshot = ScenarioSnapshot(
        current_cash_cents=adjusted_current_cash,
        expected_inflows_cents=adjusted_inflows,
        expected_outflows_cents=adjusted_outflows,
        projected_ending_cash_cents=adjusted_ending,
        minimum_cash_reserve_cents=baseline.minimum_cash_reserve_cents,
        projected_shortfall_cents=adjusted_shortfall,
        average_daily_net_burn_cents=adjusted_burn,
        cash_runway_days=adjusted_runway,
    )

    canonical_request = json.dumps(request.model_dump(), sort_keys=True, separators=(",", ":"))
    scenario_id = f"scenario-{uuid5(NAMESPACE_URL, canonical_request)}"
    return ScenarioResult(
        id=scenario_id,
        name=request.name,
        request=request,
        baseline=baseline_snapshot,
        projected=projected_snapshot,
        assumptions=[
            "Revenue change applies uniformly to expected inflows in the forecast window.",
            "Expense change applies uniformly to expected outflows in the forecast window.",
            "Daily net burn scales with the forecast net-outflow ratio.",
            "Minimum operating cash reserve remains fixed.",
        ],
        calculated_at=calculated_at or datetime.now(UTC),
    )


def _apply_percent(amount_cents: int, change_percent: float) -> int:
    multiplier = Decimal("1") + Decimal(str(change_percent)) / Decimal("100")
    return int((Decimal(amount_cents) * multiplier).quantize(Decimal("1"), ROUND_HALF_UP))


def _scaled_daily_burn(base_burn: int, base_net_outflow: int, new_net_outflow: int) -> int:
    if new_net_outflow <= 0:
        return 0
    if base_net_outflow <= 0:
        return base_burn
    scaled = Decimal(base_burn) * Decimal(new_net_outflow) / Decimal(base_net_outflow)
    return int(scaled.quantize(Decimal("1"), ROUND_HALF_UP))


def _snapshot(state: FinancialState) -> ScenarioSnapshot:
    return ScenarioSnapshot(
        current_cash_cents=state.current_cash_cents,
        expected_inflows_cents=state.expected_inflows_cents,
        expected_outflows_cents=state.expected_outflows_cents,
        projected_ending_cash_cents=state.projected_ending_cash_cents,
        minimum_cash_reserve_cents=state.minimum_cash_reserve_cents,
        projected_shortfall_cents=state.projected_shortfall_cents,
        average_daily_net_burn_cents=state.average_daily_net_burn_cents,
        cash_runway_days=state.cash_runway_days,
    )


def supplier_monthly_impact_cents(facts: SupplierFacts) -> int:
    """Estimate the proposed effect only; never mutate the financial state."""
    if facts.weekly_spend_usd is not None:
        dollars = (
            Decimal(str(facts.weekly_spend_usd))
            * Decimal(str(facts.percentage))
            / Decimal(100)
            * Decimal(52)
            / Decimal(12)
        )
    else:
        dollars = Decimal(str(facts.monthly_increase_usd))
    return int((dollars * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))

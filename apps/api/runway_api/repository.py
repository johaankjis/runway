from __future__ import annotations

import json
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from threading import RLock
from uuid import uuid4

from runway_api.financial_engine import (
    calculate_financial_state,
    prorated_supplier_cost,
    recompute_forecast,
    supplier_monthly_impact_cents,
)
from runway_api.models import (
    Business,
    CalculationStatus,
    DemoFixture,
    Document,
    FinancialState,
    ForecastAdjustment,
    Recommendation,
    Signal,
)

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_FIXTURE_PATH = REPOSITORY_ROOT / "data" / "synthetic" / "demo.json"


class InMemoryRepository:
    """Thread-safe demo repository that can be restored from a deterministic fixture."""

    def __init__(self, fixture_path: Path = DEFAULT_FIXTURE_PATH) -> None:
        self._fixture_path = fixture_path
        self._lock = RLock()
        self.reset()

    def reset(self) -> None:
        fixture = DemoFixture.model_validate_json(self._fixture_path.read_text(encoding="utf-8"))
        _validate_fixture_references(fixture)
        state = calculate_financial_state(fixture.business.id, fixture.financial_state_input)
        with self._lock:
            self._uploaded_text: dict[str, str] = {}
            self._business = fixture.business.model_copy(deep=True)
            self._financial_state = state.model_copy(deep=True)
            self._baseline = state.model_copy(deep=True)
            self._adjustments: list[ForecastAdjustment] = []
            self._signals = {item.id: item.model_copy(deep=True) for item in fixture.signals}
            self._documents = [item.model_copy(deep=True) for item in fixture.documents]
            self._recommendations = [item.model_copy(deep=True) for item in fixture.recommendations]

    def get_business(self) -> Business:
        with self._lock:
            return self._business.model_copy(deep=True)

    def get_financial_state(self) -> FinancialState:
        with self._lock:
            return self._financial_state.model_copy(deep=True)

    def list_signals(self) -> list[Signal]:
        with self._lock:
            return [item.model_copy(deep=True) for item in self._signals.values()]

    def get_signal(self, signal_id: str) -> Signal | None:
        with self._lock:
            signal = self._signals.get(signal_id)
            return signal.model_copy(deep=True) if signal else None

    def list_documents(self) -> list[Document]:
        with self._lock:
            return [item.model_copy(deep=True) for item in self._documents]

    def add_upload(self, filename: str, mime_type: str, content: str, checksum: str) -> Document:
        now = datetime.now(UTC)
        document = Document(
            id=f"upload-{uuid4()}",
            title=filename,
            document_type="uploaded_document",
            filename=filename,
            mime_type=mime_type,
            document_date=now.date(),
            ingested_at=now,
            source="upload",
            summary="Uploaded and parsed. Analyze to validate a supplier signal for the forecast.",
            checksum_sha256=checksum,
            related_signal_ids=[],
        )
        with self._lock:
            if len(self._uploaded_text) >= 100:
                raise ValueError("Demo session holds 100 uploads. Reset the demo to clear them.")
            self._documents.append(document)
            self._uploaded_text[document.id] = content
        return document.model_copy(deep=True)

    def get_uploaded_text(self, document_id: str) -> str:
        with self._lock:
            if document_id not in self._uploaded_text:
                raise ValueError("Upload no longer exists; upload again after reset")
            return self._uploaded_text[document_id]

    def save_uploaded_signal(self, signal: Signal) -> Signal:
        """Validate, deduplicate and incorporate a discovery atomically."""
        validated = Signal.model_validate(signal.model_dump())
        with self._lock:
            if validated.source_document_id not in self._uploaded_text:
                raise ValueError("Upload no longer exists; upload it again after demo reset")
            if validated.id in self._signals:
                return self._signals[validated.id].model_copy(deep=True)
            if validated.extraction is None:
                raise ValueError("Uploaded discoveries require extraction provenance")
            document = next(d for d in self._documents if d.id == validated.source_document_id)
            # Recheck at the write boundary, including callers outside the extraction route.
            from runway_api.extraction import validate_evidence

            facts = validated.extraction.attributes
            if validated.extraction.checksum_sha256 != document.checksum_sha256:
                raise ValueError("Provenance checksum mismatch")
            validate_evidence(facts, document, self._uploaded_text[document.id])
            for existing in self._signals.values():
                if existing.disposition == "duplicate":
                    continue
                other = existing.extraction.attributes if existing.extraction else None
                # Canonical Metro notice already contributes to the seeded forecast.
                baseline_match = (
                    existing.id == "signal-supplier-increase"
                    and facts.entity.casefold().strip() == "metro foods"
                    and facts.percentage == 18
                    and facts.monthly_increase_usd == 2140
                    and str(facts.effective_date) == "2026-09-15"
                )
                fact_match = other and (
                    facts.entity.casefold().strip(),
                    facts.percentage,
                    facts.effective_date,
                    facts.monthly_increase_usd,
                    facts.weekly_spend_usd,
                ) == (
                    other.entity.casefold().strip(),
                    other.percentage,
                    other.effective_date,
                    other.monthly_increase_usd,
                    other.weekly_spend_usd,
                )
                same_source = other and (
                    existing.extraction.checksum_sha256 == validated.extraction.checksum_sha256
                )
                same_effect = other and (
                    other.entity.casefold().strip() == facts.entity.casefold().strip()
                    and other.effective_date == facts.effective_date
                    and supplier_monthly_impact_cents(other) == supplier_monthly_impact_cents(facts)
                )
                if baseline_match or fact_match or same_source or same_effect:
                    validated.disposition = "duplicate"
                    validated.duplicate_of_signal_id = existing.id
                    validated.financial_effect.description += (
                        " Potential duplicate — a matching signal already exists."
                        " Not applied again."
                    )
                    break
            self._incorporate(validated)
            self._signals[validated.id] = validated.model_copy(deep=True)
            for document in self._documents:
                if document.id == validated.source_document_id:
                    document.related_signal_ids = [validated.id]
            return validated.model_copy(deep=True)

    def _incorporate(self, signal: Signal) -> None:
        if signal.disposition != "proposed" or signal.type != "supplier_pricing_increase":
            return
        facts = signal.extraction.attributes
        # Failed model validation may produce a verified fallback proposal, but is
        # deliberately review-only. A provider outage with grounded fallback is safe.
        if signal.extraction.provider.failure_reason in {
            "invalid_output",
            "grounding_validation_failed",
        }:
            return
        if facts.effective_date is None or facts.effective_date > self._baseline.forecast_end_date:
            return
        monthly = supplier_monthly_impact_cents(facts)
        amount, fractions = prorated_supplier_cost(
            monthly,
            max(facts.effective_date, self._baseline.as_of),
            self._baseline.forecast_end_date,
        )
        if amount <= 0:
            return
        explanation = (
            (
                "Weekly spend × percentage / 100 × 52 / 12; "
                if facts.weekly_spend_usd is not None
                else "Explicit source monthly increase; "
            )
            + f"monthly estimate rounded half-up to cents: ${monthly / 100:.2f}. "
            + f"Inclusive calendar-month proration: {fractions}; "
            + f"window cost rounded half-up once: ${amount / 100:.2f}. "
            + "Forecast expense only; observed current cash is unchanged."
        )
        adjustment = ForecastAdjustment(
            id=f"adjustment-{signal.id}",
            source_signal_id=signal.id,
            source_document_id=signal.source_document_id,
            source_filename=signal.extraction.source_filename,
            entity=facts.entity,
            type=facts.type,
            monthly_amount_cents=monthly,
            amount_cents=amount,
            effective_date=facts.effective_date,
            calculation_explanation=explanation,
            applied_at=datetime.now(UTC),
        )
        adjustments = [*self._adjustments, adjustment]
        state = recompute_forecast(self._baseline, adjustments)
        signal.disposition = "incorporated"
        signal.description = "Validated supplier cost incorporated into the live forecast."
        signal.financial_effect.amount_cents = monthly
        signal.financial_effect.calculation_status = CalculationStatus.APPLIED
        signal.financial_effect.description = explanation
        self._adjustments = adjustments
        self._financial_state = state

    def save_signal(self, signal: Signal) -> None:
        validated = Signal.model_validate(signal.model_dump())
        with self._lock:
            if validated.id not in self._signals:
                raise ValueError("Only existing demo signals may be enriched")
            self._signals[validated.id] = validated.model_copy(deep=True)

    def list_recommendations(self) -> list[Recommendation]:
        with self._lock:
            items = [item.model_copy(deep=True) for item in self._recommendations]
            if self._adjustments:
                state = self._financial_state
                added_cost = sum(a.amount_cents for a in self._adjustments)
                items.insert(
                    0,
                    Recommendation(
                        id="recommendation-live-forecast",
                        title="Review newly incorporated supplier costs",
                        description=(
                            "Confirm supplier terms and review the forecast before spending."
                        ),
                        priority="high",
                        status="proposed",
                        rationale=(
                            f"The current forecast includes ${added_cost / 100:,.2f} "
                            f"in additional supplier costs, with projected ending cash of "
                            f"${state.projected_ending_cash_cents / 100:,.2f} "
                            "and a reserve shortfall of "
                            f"${state.projected_shortfall_cents / 100:,.2f}."
                        ),
                        related_signal_ids=[a.source_signal_id for a in self._adjustments],
                    ),
                )
            return items

    def dump_for_debugging(self) -> str:
        """Return current state without exposing mutable models."""
        with self._lock:
            return json.dumps(self._financial_state.model_dump(mode="json"), sort_keys=True)


def _validate_fixture_references(fixture: DemoFixture) -> None:
    document_ids = {document.id for document in fixture.documents}
    signal_ids = {signal.id for signal in fixture.signals}
    if len(document_ids) != len(fixture.documents):
        raise ValueError("fixture document IDs must be unique")
    if len(signal_ids) != len(fixture.signals):
        raise ValueError("fixture signal IDs must be unique")

    for signal in fixture.signals:
        referenced_documents = {
            signal.source_document_id,
            *(evidence.source_document_id for evidence in signal.evidence),
        }
        if not referenced_documents <= document_ids:
            raise ValueError(f"signal '{signal.id}' references an unknown document")

    for entry in fixture.financial_state_input.cash_flow:
        if entry.source_document_id and entry.source_document_id not in document_ids:
            raise ValueError(f"cash-flow entry '{entry.id}' references an unknown document")

    documents_root = REPOSITORY_ROOT / "data" / "documents"
    for document in fixture.documents:
        if Path(document.filename).name != document.filename:
            raise ValueError(f"document '{document.id}' has an invalid fixture filename")
        document_path = documents_root / document.filename
        if not document_path.is_file():
            raise ValueError(f"document '{document.id}' fixture file does not exist")
        actual_checksum = sha256(document_path.read_bytes()).hexdigest()
        if actual_checksum != document.checksum_sha256:
            raise ValueError(f"document '{document.id}' checksum does not match its fixture file")
        if not set(document.related_signal_ids) <= signal_ids:
            raise ValueError(f"document '{document.id}' references an unknown signal")

    for recommendation in fixture.recommendations:
        if not set(recommendation.related_signal_ids) <= signal_ids:
            raise ValueError(f"recommendation '{recommendation.id}' references an unknown signal")

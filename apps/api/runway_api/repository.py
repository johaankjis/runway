from __future__ import annotations

import json
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from threading import RLock
from uuid import uuid4

from runway_api.financial_engine import calculate_financial_state
from runway_api.models import (
    Business,
    DemoFixture,
    Document,
    FinancialState,
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
            summary="Uploaded and parsed. Analyze to discover a proposed signal.",
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
        """Persist a discovery once, atomically; never write financial state or baseline signals."""
        validated = Signal.model_validate(signal.model_dump())
        with self._lock:
            if validated.source_document_id not in self._uploaded_text:
                raise ValueError("Upload no longer exists; upload it again after demo reset")
            if validated.id in self._signals:
                return self._signals[validated.id].model_copy(deep=True)
            facts = validated.extraction.attributes
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
                if baseline_match or fact_match:
                    validated.disposition = "duplicate"
                    validated.duplicate_of_signal_id = existing.id
                    validated.financial_effect.description += (
                        " Potential duplicate — a matching signal already exists."
                        " Not applied again."
                    )
                    break
            self._signals[validated.id] = validated.model_copy(deep=True)
            for document in self._documents:
                if document.id == validated.source_document_id:
                    document.related_signal_ids = [validated.id]
            return validated.model_copy(deep=True)

    def save_signal(self, signal: Signal) -> None:
        validated = Signal.model_validate(signal.model_dump())
        with self._lock:
            if validated.id not in self._signals:
                raise ValueError("Only existing demo signals may be enriched")
            self._signals[validated.id] = validated.model_copy(deep=True)

    def list_recommendations(self) -> list[Recommendation]:
        with self._lock:
            return [item.model_copy(deep=True) for item in self._recommendations]

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

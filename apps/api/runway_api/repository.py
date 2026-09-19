from __future__ import annotations

import json
from hashlib import sha256
from pathlib import Path
from threading import RLock

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

"""Bounded supplier extraction, source verification and safe provider fallback."""

import json
import re
from datetime import UTC, date, datetime
from decimal import Decimal
from hashlib import sha256
from typing import Protocol

import httpx
from pydantic import ValidationError

from runway_api.extraction_prompts import extraction_messages
from runway_api.integration_models import ExtractionResponse
from runway_api.models import (
    Document,
    ExtractionProvenance,
    ProviderMetadata,
    SignalEvidence,
    SupplierFacts,
)
from runway_api.provider_config import ProviderSettings
from runway_api.repository import REPOSITORY_ROOT, InMemoryRepository

SUPPLIER_DOCUMENT_ID = "doc-supplier-price-notice"


class ProviderFailure(Exception):
    """Safe public reason only; provider bodies/credentials are never exposed."""


class SignalExtractor(Protocol):
    def extract(self, document: Document, content: str) -> SupplierFacts: ...


class FixtureSignalExtractor:
    def extract(self, document: Document, content: str) -> SupplierFacts:
        if document.id != SUPPLIER_DOCUMENT_ID:
            raise ValueError("Unsupported document")
        return SupplierFacts(
            type="supplier_pricing_increase",
            source_document_id=document.id,
            entity="Metro Foods",
            percentage=18.0,
            monthly_increase_usd=2140.0,
            effective_date=date(2026, 9, 15),
            confidence=0.99,
            excerpt=content.rstrip(),
        )


class NemotronSignalExtractor:
    def __init__(self, settings: ProviderSettings) -> None:
        self.settings = settings

    def extract(self, document: Document, content: str) -> SupplierFacts:
        settings = self.settings
        if not settings.nvidia_api_key.get_secret_value():
            raise ProviderFailure("missing_credentials")
        with httpx.Client(timeout=settings.nvidia_timeout_seconds) as client:
            response = client.post(
                f"{settings.nvidia_base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {settings.nvidia_api_key.get_secret_value()}"},
                json={
                    "model": settings.nvidia_model,
                    "stream": False,
                    "temperature": 0,
                    "max_tokens": 2048,
                    "messages": extraction_messages(document.id, content),
                },
            )
            response.raise_for_status()
        try:
            choice = response.json()["choices"][0]
            if choice["finish_reason"] != "stop":
                raise ValueError("Incomplete response")
            return SupplierFacts.model_validate_json(choice["message"]["content"])
        except (KeyError, IndexError, TypeError, ValueError) as error:
            raise ProviderFailure("invalid_output") from error


def validate_evidence(facts: SupplierFacts, document: Document, content: str) -> None:
    """Check exact evidence and explicit facts against the supported notice grammar."""
    if facts.source_document_id != document.id or facts.excerpt not in content:
        raise ValueError("Source or excerpt mismatch")
    entity = re.search(r"^# (.+) — Pricing Update", content)
    percentage = re.search(r"apply an average (\d+(?:\.\d+)?)% price increase", content)
    effective = re.search(r"\*\*Effective date:\*\* ([A-Za-z]+ \d{1,2}, \d{4})", content)
    amount = re.search(r"estimated to add \$([\d,]+(?:\.\d{1,2})?) per month", content)
    expected_date = datetime.strptime(effective[1], "%B %d, %Y").date() if effective else None
    if (
        not entity
        or facts.entity != entity[1]
        or facts.entity not in facts.excerpt
        or not percentage
        or facts.percentage != float(percentage[1])
        or percentage[0] not in facts.excerpt
        or facts.effective_date != expected_date
        or (effective and effective[1] not in facts.excerpt)
        or not amount
        or amount[0] not in facts.excerpt
        or Decimal(str(facts.monthly_increase_usd)) != Decimal(amount[1].replace(",", ""))
    ):
        raise ValueError("Facts not supported by evidence")


def extract_document(
    repo: InMemoryRepository,
    document: Document,
    settings: ProviderSettings,
) -> ExtractionResponse:
    if document.id != SUPPLIER_DOCUMENT_ID:
        raise ValueError("Only the supplier pricing notice is supported in this milestone")
    raw = (REPOSITORY_ROOT / "data" / "documents" / document.filename).read_bytes()
    if sha256(raw).hexdigest() != document.checksum_sha256:
        raise ValueError("Source document checksum mismatch")
    content = raw.decode("utf-8")
    provider = ProviderMetadata(
        requested_provider=settings.signal_provider,
        provider=settings.signal_provider,
        mode="fixture" if settings.signal_provider == "fixture" else "live",
        model=settings.nvidia_model if settings.signal_provider == "nemotron" else None,
    )
    extractor: SignalExtractor = (
        NemotronSignalExtractor(settings)
        if settings.signal_provider == "nemotron"
        else FixtureSignalExtractor()
    )
    try:
        facts = extractor.extract(document, content)
        validate_evidence(facts, document, content)
    except (ProviderFailure, httpx.HTTPError, ValidationError, ValueError) as error:
        if settings.signal_provider != "nemotron":
            raise ValueError("Fixture extraction could not be verified") from error
        reason = (
            str(error)
            if isinstance(error, ProviderFailure)
            else "provider_unavailable"
            if isinstance(error, httpx.HTTPError)
            else "invalid_output"
        )
        provider = ProviderMetadata(
            requested_provider="nemotron",
            provider="fixture",
            mode="fallback",
            failure_reason=reason,
        )
        facts = FixtureSignalExtractor().extract(document, content)
        validate_evidence(facts, document, content)

    # This fixture already accounts for the supplier effect. Never apply it twice or
    # multiply all expenses by 18%. Only enhance the existing domain signal's evidence.
    signal = repo.get_signal("signal-supplier-increase")
    amount_cents = int(Decimal(str(facts.monthly_increase_usd)) * 100)
    if (
        signal is None
        or signal.financial_effect.percentage != facts.percentage
        or signal.financial_effect.amount_cents != amount_cents
    ):
        raise ValueError("Extracted facts do not match the supported baseline mapping")
    start = content.index(facts.excerpt)
    first_line = content.count("\n", 0, start) + 1
    last_line = first_line + facts.excerpt.count("\n")
    signal.confidence = facts.confidence
    signal.financial_effect.amount_cents = amount_cents
    signal.financial_effect.description = (
        "Explicit monthly supplier estimate converted to integer cents by application code; "
        "already included in the demo baseline, not applied again."
    )
    signal.evidence = [
        SignalEvidence(
            id="evidence-supplier-extracted",
            source_document_id=document.id,
            excerpt=facts.excerpt,
            locator=f"lines {first_line}-{last_line}",
        )
    ]
    signal.extraction = ExtractionProvenance(
        source_filename=document.filename,
        source_title=document.title,
        checksum_sha256=document.checksum_sha256,
        extracted_at=datetime.now(UTC),
        provider=provider,
        attributes=facts,
    )
    # Revalidate the complete domain object before storing it.
    signal = type(signal).model_validate(json.loads(signal.model_dump_json()))
    repo.save_signal(signal)
    return ExtractionResponse(signal=signal, financial_state=repo.get_financial_state())

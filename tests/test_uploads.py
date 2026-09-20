"""Upload ingestion exercises the existing provider pipeline and financial boundary."""

import json
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO

import httpx
import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter
from runway_api.extraction import explicit_upload_facts, extract_document, validate_evidence
from runway_api.main import create_app
from runway_api.models import Document, SupplierFacts
from runway_api.provider_config import ProviderSettings
from runway_api.repository import REPOSITORY_ROOT
from runway_api.uploads import MAX_FILE_BYTES

DEMO = REPOSITORY_ROOT / "data/demo-uploads"
FRESHFIELDS = (DEMO / "freshfields-surcharge.txt").read_bytes()


def upload(client, data=FRESHFIELDS, name="freshfields.txt", mime="text/plain"):
    return client.request("POST", "/api/documents/upload", files={"file": (name, data, mime)})


def analyze(client, document):
    return client.request("POST", f"/api/documents/{document['id']}/extract")


def test_txt_upload_is_ephemeral_and_does_not_mutate_finances(client, repository):
    baseline = repository.get_financial_state()
    signals = repository.list_signals()
    response = upload(client)
    assert response.status_code == 201
    doc = response.json()
    assert doc["source"] == "upload" and doc["related_signal_ids"] == []
    assert doc["filename"] == "freshfields.txt"
    assert repository.get_uploaded_text(doc["id"]) == FRESHFIELDS.decode()
    assert doc in client.get("/api/documents").json()
    assert repository.get_financial_state() == baseline
    assert repository.list_signals() == signals
    assert upload(client).json()["id"] != doc["id"]
    client.post("/api/demo/reset")
    assert doc not in client.get("/api/documents").json()
    assert analyze(client, doc).status_code == 404


def test_text_pdf_upload_and_existing_extraction_pipeline(client, repository):
    raw = (DEMO / "freshfields-surcharge.pdf").read_bytes()
    response = upload(client, raw, "freshfields.pdf", "application/pdf")
    assert response.status_code == 201
    doc = response.json()
    text = repository.get_uploaded_text(doc["id"])
    assert "Current weekly spend: $1,850" in text
    result = analyze(client, doc)
    assert result.status_code == 200
    assert result.json()["signal"]["financial_effect"]["amount_cents"] == 56117
    assert result.json()["signal"]["evidence"][0]["excerpt"] in text


@pytest.mark.parametrize(
    "name,mime,data,status,detail",
    [
        ("notice.docx", "application/octet-stream", b"hello", 415, "PDF and TXT"),
        ("notice.png", "image/png", b"png", 415, "PDF and TXT"),
        ("notice.txt", "image/png", b"hello", 415, "PDF and TXT"),
        ("notice.pdf", "application/pdf", b"plain text", 422, "valid PDF"),
        ("notice.txt", "text/plain", b"%PDF-1.4 fake", 422, "binary"),
        ("notice.txt", "text/plain", b"PK\x03\x04zip", 422, "binary"),
        ("notice.txt", "text/plain", b"a\x00b", 422, "binary"),
        ("notice.txt", "text/plain", b"\xff\xfe", 422, "UTF-8"),
        ("notice.txt", "text/plain", b"", 422, "empty"),
        ("notice.txt", "text/plain", b" \n\t", 422, "no usable text"),
        ("notice.txt", "text/plain", b"a" * (MAX_FILE_BYTES + 1), 413, "10 MB"),
        ("notice.txt", "text/plain", b"a" * (MAX_FILE_BYTES + 100000), 413, "10 MB"),
        ("notice.txt", "text/plain", b"a" * 10001, 422, "10,000"),
        ("notice.pdf", "application/pdf", b"%PDF-1.7 broken", 422, "could not be read"),
    ],
)
def test_upload_validation(client, name, mime, data, status, detail):
    before = client.get("/api/documents").json()
    response = upload(client, data, name, mime)
    assert response.status_code == status
    assert detail in response.json()["detail"]
    assert client.get("/api/documents").json() == before


@pytest.mark.parametrize("kind", ["blank", "encrypted", "many_pages"])
def test_unsupported_pdf(client, kind):
    writer = PdfWriter()
    for _ in range(26 if kind == "many_pages" else 1):
        writer.add_blank_page(width=612, height=792)
    if kind == "encrypted":
        writer.encrypt("private")
    out = BytesIO()
    writer.write(out)
    response = upload(client, out.getvalue(), "scan.pdf", "application/pdf")
    assert response.status_code == 422
    expected = {
        "blank": "Scanned/image-only",
        "encrypted": "Password-protected",
        "many_pages": "25 pages",
    }
    assert expected[kind] in response.json()["detail"]


def test_filename_sanitization_and_untrusted_mime(client):
    response = upload(
        client, name="../../secret\\<notice>\u202e.TXT", mime="application/octet-stream"
    )
    assert response.status_code == 201
    assert response.json()["filename"] == "_notice__.txt"
    assert response.json()["mime_type"] == "text/plain"
    assert "/" not in response.json()["filename"]
    assert "\\" not in response.json()["filename"]
    assert upload(client, data=b"\xef\xbb\xbf" + FRESHFIELDS).status_code == 201


def test_single_file_only(client):
    response = client.post(
        "/api/documents/upload",
        files=[
            ("file", ("one.txt", FRESHFIELDS, "text/plain")),
            ("file", ("two.txt", FRESHFIELDS, "text/plain")),
        ],
    )
    assert response.status_code == 400
    assert client.post("/api/documents/upload").status_code == 422


def test_freshfields_proposed_deterministic_and_idempotent(client):
    baseline = client.get("/api/financial-state").json()
    doc = upload(client).json()
    first = analyze(client, doc)
    assert first.status_code == 200
    body = first.json()
    signal = body["signal"]
    assert body["application_status"] == "proposed"
    assert signal["disposition"] == "proposed"
    assert signal["financial_effect"]["calculation_status"] == "observed"
    assert signal["financial_effect"]["amount_cents"] == 56117
    assert signal["extraction"]["attributes"]["weekly_spend_usd"] == 1850
    assert signal["extraction"]["attributes"]["monthly_increase_usd"] is None
    assert signal["extraction"]["provider"]["mode"] == "fixture"
    assert analyze(client, doc).json() == body
    assert body["financial_state"] == baseline == client.get("/api/financial-state").json()
    saved_doc = next(
        item for item in client.get("/api/documents").json() if item["id"] == doc["id"]
    )
    assert saved_doc["related_signal_ids"] == [signal["id"]]
    assert client.get(f"/api/signals/{signal['id']}").json() == signal


def test_calculation_uses_source_inputs_not_demo_constants(client):
    raw = FRESHFIELDS.replace(b"$1,850", b"$2,000").replace(b"7%", b"9%")
    signal = analyze(client, upload(client, raw).json()).json()["signal"]
    assert signal["financial_effect"]["amount_cents"] == 78000


def test_metro_duplicate_preserves_baseline_and_canonical_provenance(client, repository):
    canonical = repository.get_signal("signal-supplier-increase")
    baseline = repository.get_financial_state()
    original = repository.list_documents()[0]
    raw = (REPOSITORY_ROOT / "data/documents" / original.filename).read_bytes()
    doc = upload(client, raw, "metro.txt").json()
    result = analyze(client, doc).json()
    assert result["application_status"] == "potential_duplicate"
    assert result["signal"]["duplicate_of_signal_id"] == canonical.id
    assert result["signal"]["source_document_id"] == doc["id"]
    assert result["signal"]["financial_effect"]["amount_cents"] == 214000
    assert repository.get_signal(canonical.id) == canonical
    assert repository.get_financial_state() == baseline


def test_reuploaded_freshfields_is_duplicate(client):
    first = analyze(client, upload(client).json()).json()["signal"]
    second = analyze(client, upload(client).json()).json()["signal"]
    assert second["disposition"] == "duplicate"
    assert second["duplicate_of_signal_id"] == first["id"]


@pytest.mark.parametrize("failure", [None, "evidence", "amount", "arithmetic", "network"])
def test_uploaded_live_provider_and_verified_fallback(repository, monkeypatch, failure):
    calls = []

    def post(self, url, **kwargs):
        calls.append(kwargs)
        if failure == "network":
            raise httpx.ConnectError("private provider details")
        payload = json.loads(kwargs["json"]["messages"][1]["content"])
        doc = next(d for d in repository.list_documents() if d.id == payload["source_document_id"])
        assert payload["document"] == FRESHFIELDS.decode()
        facts = explicit_upload_facts(doc, payload["document"]).model_dump(mode="json")
        if failure == "evidence":
            facts["excerpt"] = "Invented evidence does not occur in source text"
        elif failure == "amount":
            facts["weekly_spend_usd"] = 2000
        elif failure == "arithmetic":
            facts["monthly_increase_usd"] = 561.17
        return httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "choices": [{"finish_reason": "stop", "message": {"content": json.dumps(facts)}}]
            },
        )

    monkeypatch.setattr(httpx.Client, "post", post)
    settings = ProviderSettings(signal_provider="nemotron", nvidia_api_key="test-key")
    with TestClient(create_app(repository, settings)) as client:
        doc = upload(client).json()
        body = analyze(client, doc).json()
        assert body["signal"]["extraction"]["provider"]["mode"] == (
            "fallback" if failure else "live"
        )
        assert body["signal"]["financial_effect"]["amount_cents"] == 56117
        assert body["signal"]["evidence"][0]["excerpt"] in FRESHFIELDS.decode()
        assert "private provider details" not in json.dumps(body)
        assert analyze(client, doc).json() == body
        assert len(calls) == 1


def test_uploaded_evidence_rejected_directly(client):
    doc = Document.model_validate(upload(client).json())
    facts = explicit_upload_facts(doc, FRESHFIELDS.decode())
    for update in [
        {"excerpt": "Invented source content is not evidence"},
        {"weekly_spend_usd": 2000.0},
        {"source_document_id": "wrong"},
    ]:
        with pytest.raises(ValueError):
            validate_evidence(
                SupplierFacts.model_validate({**facts.model_dump(), **update}),
                doc,
                FRESHFIELDS.decode(),
            )


def test_unsupported_analysis_does_not_invent_a_signal(client):
    doc = upload(client, b"An ordinary letter with no explicit supplier pricing facts.").json()
    before = client.get("/api/signals").json()
    assert analyze(client, doc).status_code == 422
    assert client.get("/api/signals").json() == before


def test_concurrent_extraction_stores_one_proposal(repository, client):
    doc = Document.model_validate(upload(client).json())
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(
            pool.map(lambda _: extract_document(repository, doc, ProviderSettings()), range(4))
        )
    assert all(result == results[0] for result in results)
    assert len([s for s in repository.list_signals() if s.source_document_id == doc.id]) == 1


def test_pdf_fixture_reproducible_source():
    reader = PdfReader(DEMO / "freshfields-surcharge.pdf")
    text = reader.pages[0].extract_text()
    assert all(line in text for line in FRESHFIELDS.decode().splitlines() if line)


def test_upload_contract_schema(client):
    schema = client.get("/openapi.json").json()
    assert "/api/documents/upload" in schema["paths"]
    assert "upload" in schema["components"]["schemas"]["Document"]["properties"]["source"]["enum"]
    statuses = schema["components"]["schemas"]["ExtractionResponse"]["properties"][
        "application_status"
    ]["enum"]
    assert set(statuses) == {"already_in_baseline", "proposed", "potential_duplicate"}

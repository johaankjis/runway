# Live document upload demo

The Documents picker and drop zone send an actual multipart file to
`POST /api/documents/upload` (`file`, exactly one PDF/TXT; 201 Document response).
The backend bounds the request before multipart parsing, checks extension/MIME
and content, parses text, and registers a UUID document in the existing repository.
`GET /api/documents` includes the upload immediately. The browser selects it and
provides the existing Analyze document action without a refresh.

## Storage and safety

Only sanitized filename, type, ingestion date, original-byte SHA-256 and extracted
text remain in process memory. PDF metadata is not imported. Raw bytes are discarded;
any multipart temporary spool is closed at the end of the request. Uploaded files
are never written into this repository. No arbitrary paths are returned to clients.
Reset/restart clears uploads and discoveries. Run a single API process/worker for
the demo; independent replicas do not share this ephemeral repository.

Limits: 10 MiB (10 × 1024 × 1024 bytes), 25 PDF pages, 10,000 extracted characters,
and 100 uploads per server session. The multipart envelope gets 64 KiB overhead.
TXT accepts UTF-8 (including BOM); binary controls, mismatched MIME, disguised PDF/ZIP,
empty files, corrupt/encrypted PDFs and image-only/scanned PDFs are rejected clearly.
No OCR, image ingestion, batch upload, DOCX, durable storage or background queue.
PDF extraction uses pypdf; multipart uses python-multipart. Parsing runs off the
async event loop. This is a bounded local demo, not a hardened public upload service.

## Extraction and accounting

Uploads call the existing `POST /api/documents/{id}/extract`, Nemotron extractor,
prompt builder, schema validation and provider fallback path. Provider configuration
is unchanged. In fixture mode, or on live-provider failure, the deterministic parser
extracts only supported explicit source facts; it never substitutes the Metro fixture
for an unrelated upload. Fallback metadata remains visible. Unsupported/ambiguous
notices fail with 422 and do not create a signal.

Supported source grammars are deliberately narrow:

- Existing Metro-style Markdown pricing notice, including explicit monthly estimate.
- Supplier notice with these explicit lines (see the FreshFields fixture):
  `Supplier: ...`, `Current weekly spend: $...`, `New delivery surcharge: ...%`,
  `Effective date: October 1, 2026`.

The exact excerpt must occur in the parsed source text and contain all validated
facts. Numeric/date/entity values must agree with independently read source fields.
The model may provide either an explicit monthly amount or weekly spend, never both.
It cannot provide financial totals. PDF evidence refers to extracted-text lines,
not visual page coordinates. SHA-256 identifies the original uploaded bytes.

FreshFields extracts $1,850/week and 7%. The financial engine computes
`1850 × 7 / 100 × 52 / 12`, rounded half-up to cents: **$561.17/month**.
This assumes constant weekly spend and 52 weeks/year; it is not a prorated October
forecast. The effect is `observed`, the signal is `proposed`, and no cash, forecast,
runway, shortfall, scenario, or recommendation is changed by upload or analysis.

A matching Metro Foods notice returns `potential_duplicate`, pointing to the
canonical signal; the $2,140/month baseline is untouched. Equal normalized vendor,
percentage, date and amount basis also mark repeated uploaded discoveries as
potential duplicates. This is exact fact matching, not fuzzy vendor resolution.
Each upload retains its own evidence. Repeated/concurrent extraction saves one
result per document and returns that same result, including provider metadata.
To retry a fallback through the provider, upload again (it will be marked duplicate).

## Local commands

From the repository root:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e 'apps/api[dev]'
pnpm install --frozen-lockfile
pnpm --filter @runway/contracts build
```

Terminal 1, credential-free complete flow:

```bash
RUNWAY_SIGNAL_PROVIDER=fixture .venv/bin/uvicorn runway_api.main:app --port 8000
```

For live Nemotron, use the existing configured provider environment instead:

```bash
RUNWAY_SIGNAL_PROVIDER=nemotron .venv/bin/uvicorn runway_api.main:app --port 8000
```

Keep existing provider credentials/environment settings; no secrets need changing.
The application does not automatically load a `.env` unless your launcher does so.

Terminal 2:

```bash
NEXT_PUBLIC_RUNWAY_DATA_MODE=live NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 pnpm dev:web
```

Open http://localhost:3000/documents. Choose
`data/demo-uploads/freshfields-surcharge.pdf` or `.txt`, click Upload selected file,
then Analyze document. Observe uploaded/parsed state, provider mode, structured facts,
exact evidence, and the proposed $561.17 monthly estimate. Canonical cash/runway remain
unchanged. Revisit the signal detail, or click View saved analysis to verify idempotency.
The frontend snapshot-only mode rejects uploads honestly; a running API is required.

API smoke test:

```bash
curl --fail-with-body -F 'file=@data/demo-uploads/freshfields-surcharge.txt;type=text/plain' \
  http://localhost:8000/api/documents/upload > /tmp/runway-upload.json
UPLOAD_ID=$(.venv/bin/python -c 'import json; print(json.load(open("/tmp/runway-upload.json"))["id"])')
curl --fail-with-body -X POST "http://localhost:8000/api/documents/$UPLOAD_ID/extract"
curl --fail-with-body http://localhost:8000/api/financial-state
```

For the Metro duplicate check, copy the seeded notice to a temporary `.txt` file:

```bash
cp data/documents/supplier-price-notice.md /tmp/metro-notice.txt
curl --fail-with-body -F 'file=@/tmp/metro-notice.txt;type=text/plain' \
  http://localhost:8000/api/documents/upload
```

Analyze the returned ID; expect `potential_duplicate`, $2140/month observed, and
unchanged canonical financial state.

The PDF is reproducibly generated from the TXT source, outside runtime seed loading:

```bash
.venv/bin/python -m pip install reportlab
.venv/bin/python data/demo-uploads/generate_pdf.py
```

## Validation

```bash
.venv/bin/pytest
.venv/bin/ruff check apps/api tests
.venv/bin/ruff format --check apps/api tests
pnpm lint
pnpm typecheck
pnpm build
git diff --check
```

Tests cover TXT/PDF ingestion, filename sanitization, type/content/size validation,
empty/corrupt/encrypted/no-text PDFs, repository listing/reset, source grounding,
mocked live provider and fallback, schema contract, deterministic nonconstant inputs,
proposed signals, Metro and re-upload duplicates, concurrent/idempotent extraction,
and financial-state preservation. Existing seeded and multilingual voice tests remain.

## Changed-file inventory

- API: `apps/api/pyproject.toml`; `apps/api/runway_api/{uploads,main,models,repository,extraction,extraction_prompts,financial_engine,integration_models}.py`.
- Contracts: `packages/contracts/src/index.ts`.
- Frontend: `apps/web/lib/api.ts`, `apps/web/lib/fixtures/fixture-adapter.ts`,
  `apps/web/components/views/{DocumentsView,SignalDetailView}.tsx`,
  `apps/web/components/domain/{DocumentAnalysisPanel,SourceEvidence}.tsx`.
- Tests: `tests/test_uploads.py`, `tests/test_integrations.py`.
- Demo: `data/demo-uploads/freshfields-surcharge.txt`, `freshfields-surcharge.pdf`,
  and `generate_pdf.py` in the same directory.
- Documentation: `README.md`, `docs/live_document_upload.md`.

Validation completed with 184 passing tests (35 new upload cases), Ruff lint/format,
frontend lint/typecheck, production build and `git diff --check` passing. Two upstream
Starlette/httpx/AnyIO deprecation warnings remain. The demo PDF was rendered and visually
checked. The browser opened the live Documents page; automated file selection was blocked
by Chrome extension file-URL access, so a full browser upload was not claimed as verified.
Live provider behavior was mock-tested; no real provider credentials were used in validation.

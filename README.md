# Runway

Runway is an AI-assisted small-business cash-flow demo with a strict boundary:
models may interpret source material and select grounded explanations, but
deterministic application code remains the only authority for balances, runway,
shortfalls, forecast adjustments, and scenario outcomes.

The final implementation includes:

- a FastAPI backend with an in-memory repository and deterministic financial engine
- a Next.js frontend for overview, cash flow, signals, documents, scenarios, recommendations, settings, and voice
- shared TypeScript contracts for frontend/backend API compatibility
- bounded PDF/TXT document upload and supplier-notice extraction
- live forecast recomputation when validated supplier cost increases overlap the forecast window
- grounded voice briefings and one-turn Q&A with optional provider integrations
- fixture/demo modes so the app still works without external credentials

## Architecture

```text
apps/api/            FastAPI app, repository, extraction flow, voice flow, financial engine
apps/web/            Next.js App Router frontend
packages/contracts/  Shared TypeScript request/response contracts
data/synthetic/      Deterministic business fixture and baseline financial state
data/documents/      Seeded source documents referenced by signals
data/demo-uploads/   Demo upload files for live document analysis
docs/                Architecture, upload, forecast, and voice notes
tests/               Backend, contract bridge, and frontend helper tests
```

## Core product behavior

### Deterministic finance

- All authoritative money values use integer USD cents.
- The backend derives projected ending cash, projected shortfall, daily burn, and runway.
- Scenario results are calculated by deterministic code and never persisted into baseline state.

### Documents and extraction

- Users can upload one PDF or TXT file at a time.
- Uploads are bounded to 10 MiB, 25 PDF pages, and 10,000 extracted characters.
- Raw upload bytes are not written into the repository; parsed text and checksums live only in memory.
- Extraction supports the seeded Metro Foods notice plus the explicit upload grammars used by the demo files.
- Unsupported or ambiguous documents fail closed instead of being guessed.

### Live forecast updates

- Validated supplier pricing increases can be incorporated into the forecast automatically.
- Current cash remains unchanged; only forecasted outflows and derived metrics move.
- Duplicate notices are detected and do not apply twice.
- Reset restores the original seeded demo state.

### Voice

- `POST /api/voice/briefing` returns grounded briefing text and optional ElevenLabs audio.
- `POST /api/voice/question` handles one-turn Q&A by selecting from a verified answer catalog.
- NVIDIA/Nemotron is used only for bounded interpretation or extraction when enabled.
- Fixture and fallback modes always preserve deterministic results and grounded text.

## Key API routes

```text
GET  /health
GET  /api/business
GET  /api/financial-state
GET  /api/signals
GET  /api/signals/{signal_id}
GET  /api/documents
POST /api/documents/upload
POST /api/documents/{document_id}/extract
GET  /api/recommendations
POST /api/scenarios
POST /api/voice/briefing
POST /api/voice/question
POST /api/demo/reset
```

## Local setup

Requirements:

- Python 3.11+
- Node.js 20+
- pnpm 10+

```bash
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e 'apps/api[dev]'
pnpm install --frozen-lockfile
pnpm --filter @runway/contracts build
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

## Configuration

The API does not load `.env` automatically. Start it with `--env-file .env` or export variables yourself.

Important variables:

- `RUNWAY_SIGNAL_PROVIDER=fixture|nemotron`
- `RUNWAY_VOICE_PROVIDER=fixture|elevenlabs`
- `NVIDIA_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_RUNWAY_DATA_MODE=live|fixture|auto`

Default provider mode is fixture for both extraction and voice, so credentials are optional for local demo use.

## Run locally

Start the API:

```bash
.venv/bin/uvicorn runway_api.main:app --app-dir apps/api --env-file .env --reload
```

Start the frontend:

```bash
pnpm dev:web
```

Useful URLs:

- frontend: `http://localhost:3000`
- API: `http://localhost:8000`
- OpenAPI docs: `http://localhost:8000/docs`

If you want the frontend to require the live backend instead of falling back to the captured fixture snapshot, set:

```bash
NEXT_PUBLIC_RUNWAY_DATA_MODE=live pnpm dev:web
```

## Demo flow

1. Open the home page and reset the demo.
2. Review the baseline cash position, runway, signals, and recommendations.
3. Open Documents and upload a sample from `data/demo-uploads/`.
4. Let Runway analyze the file and verify the extracted facts against source evidence.
5. Review whether the result was incorporated, proposed, or marked as a duplicate.
6. Revisit Overview, Recommendations, Scenarios, and Voice to see the updated deterministic state.

## Validation

```bash
.venv/bin/pytest
.venv/bin/ruff check apps/api tests
pnpm lint
pnpm typecheck
pnpm build
```

## Additional documentation

- [Architecture](docs/architecture.md)
- [AI/provider integration](docs/ai_integration_plan.md)
- [Live document upload](docs/live_document_upload.md)
- [Live forecast recomputation](docs/live_forecast.md)
- [One-turn voice Q&A](docs/voice-question.md)
- [Demo flow](docs/demo_flow.md)

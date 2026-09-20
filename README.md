# Runway

Runway is an AI early-warning system for small-business finances. Milestone 1 provides a
deterministic FastAPI backend, traceable synthetic signals and documents, shared TypeScript
contracts, and a minimal Next.js shell.

The core architectural rule is strict: models interpret information; deterministic code performs
all authoritative financial calculations. An LLM may eventually explain the API's results, but it
must never calculate balances, runway, shortfalls, or scenario outcomes.

## Repository layout

```text
apps/api/            FastAPI application and financial engine
apps/web/            Minimal Next.js App Router application
packages/contracts/  Shared TypeScript API contracts
data/synthetic/      Deterministic demo fixture
data/documents/      Synthetic source documents
docs/                Architecture and demo notes
tests/               API and domain tests
```

## Setup

Requirements: Python 3.11+, Node.js 20+, and pnpm 10+.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e 'apps/api[dev]'
pnpm install
cp .env.example .env
```

## Run locally

In one terminal:

```bash
source .venv/bin/activate
uvicorn runway_api.main:app --reload --app-dir apps/api
```

In another terminal:

```bash
pnpm dev:web
```

The API is at `http://localhost:8000`, OpenAPI docs at `http://localhost:8000/docs`, and the web
app at `http://localhost:3000`.

## Validation

```bash
source .venv/bin/activate
pytest
ruff check apps/api tests
pnpm lint
pnpm typecheck
pnpm build
```

See [the architecture](docs/architecture.md) for calculation invariants and
[the demo flow](docs/demo_flow.md) for the presentation sequence.

## Scope

The AI/provider milestone adds validated NVIDIA Nemotron supplier extraction and grounded
ElevenLabs briefings, both with credential-free fixture modes. See the
[integration guide](docs/ai_integration_plan.md) for setup, fallback behavior, API contracts,
and the exact demo path. Authentication, databases, queues, and deployment remain out of scope.

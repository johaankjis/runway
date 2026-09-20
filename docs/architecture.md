# Runway Milestone 1 architecture

This document records the deterministic foundation. The subsequent
[AI/provider integration guide](ai_integration_plan.md) describes the extraction and voice
extensions and supersedes the historical integration omissions below.

Runway's first milestone is a small, local, deterministic system. FastAPI exposes a fixture-backed
financial snapshot and traceable risk signals; Next.js supplies only the application shell.

## Components

```text
data/documents + data/synthetic
              |
              v
   InMemoryRepository -----> signals/documents/recommendations
              |
              v
   deterministic financial engine
              |
              v
          FastAPI routes <---- TypeScript contracts
              |
              v
        Next.js application
```

- `data/synthetic/demo.json` contains business facts, cash-flow entries, signal interpretations,
  provenance, and recommendation copy.
- `data/documents/` contains the synthetic source documents referenced by signal evidence.
- `apps/api/runway_api/repository.py` loads and validates the fixture into memory. Reset reloads
  the same fixture, so demos are repeatable.
- `apps/api/runway_api/financial_engine.py` is the only authority for financial state and scenario
  calculations.
- `apps/api/runway_api/main.py` maps the domain to HTTP without performing financial arithmetic.
- `packages/contracts/` mirrors the JSON request and response types for frontend consumers.

## Financial invariants

All money uses integer USD cents. The baseline is derived as follows:

```text
projected ending cash = current cash + expected inflows - expected outflows
                      = $43,200 + $19,400 - $51,700
                      = $10,900

projected shortfall = max(0, minimum reserve - projected ending cash)
                    = $15,700 - $10,900
                    = $4,800

cash runway = floor(current cash / average daily net burn)
             = floor($43,200 / $2,400)
             = 18 days
```

Pydantic model validators reject inconsistent calculated state. Scenario percentages are applied
with decimal arithmetic and round-half-up to a whole cent. Scenarios do not mutate the baseline.

## Interpretation boundary

Fixture signals model the output an interpretation layer could eventually produce. Each signal
has evidence containing a source document ID, excerpt, and locator. Quantified effects state
whether they are applied, merely observed, or deliberately not quantified.

No LLM exists in Milestone 1. When one is added later, it may propose structured signals and
explain engine output, but it must not produce authoritative financial totals.

## Deliberate omissions

Milestone 1 has no database, authentication, background queue, cloud deployment, external
integration, Nemotron, or ElevenLabs dependency. Those additions require a later milestone and
must preserve the calculation boundary above.

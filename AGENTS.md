# Runway ownership boundaries

Runway is a hackathon project with deliberately explicit ownership. Work within the assigned
area and coordinate changes to shared contracts before editing another owner's files.

## Codex

Owns:

- `apps/api/` — backend API and in-memory repository
- `packages/contracts/` — shared request/response contracts
- deterministic financial engine and scenario calculations
- `tests/` — backend and contract tests
- backend-oriented fixture data and architecture documentation

## Claude

Owns:

- `apps/web/` — frontend implementation, components, styling, and user experience

Codex may maintain only the minimal frontend scaffold needed for repository health unless a
shared-contract change makes a small frontend adjustment necessary.

## Antigravity

Owns future integration work for:

- NVIDIA Nemotron
- ElevenLabs
- external integration wiring

These integrations are outside Milestone 1 and must not be added yet.

## Shared rule

LLMs may interpret source material and explain already-calculated results. Only deterministic
code may calculate authoritative balances, runway, shortfalls, and scenario outcomes. Never
move authoritative financial arithmetic into prompts or model output.


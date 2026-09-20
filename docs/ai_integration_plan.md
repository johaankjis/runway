# AI/provider integration milestone

## Responsibility and flow

LLM = understand; deterministic code = calculate; voice = speak grounded results.
The only extraction target is `doc-supplier-price-notice` (Metro Foods, +18%).
The original Harbor Foods fixture was renamed consistently; financial inputs are unchanged.

`Document → SignalExtractor → SupplierFacts validation → source verification → existing Signal`

`SignalExtractor` has fixture and NVIDIA implementations. Prompts live in
`apps/api/runway_api/extraction_prompts.py`. NVIDIA receives only the source document and a
fact schema, never the financial engine state. It returns one JSON object. Unknown fields,
including financial totals or recommendations, are rejected. There is no agent or chatbot.

## Facts, evidence, and financial boundary

`SupplierFacts` requires type `supplier_pricing_increase`, source ID, entity, percentage,
explicit monthly USD increase, nullable ISO effective date, confidence, and a verbatim excerpt.
Numeric strings, booleans, nonfinite values, negative amounts, unsupported event types and
confidence outside [0,1] fail validation. Percentage is bounded to (0,300]; monthly USD to
(0,1000000]. The date must match the notice; `null` is accepted only when absent in the source.

Before any repository mutation, code verifies the document checksum, exact excerpt, source ID,
entity, percentage, date and monthly amount against the supported supplier-notice grammar.
The fixture provider follows the same validation. Unsupported documents are rejected, not guessed.
Line locations are computed from the source rather than trusted from the model.

The resulting existing `signal-supplier-increase` retains source ID and evidence, and gains
`extraction`: source filename/title/checksum, UTC extraction timestamp, provider metadata and
validated attributes. `detected_at` remains the original business-event detection time.
GET signal endpoints retain the provenance until demo reset or process restart.

Application code converts the explicitly stated $2,140 estimate into 214000 integer cents
using Decimal. It does not derive that amount by multiplying all expenses by 18%.
The existing fixture already marks this cost as applied. Therefore extraction returns
`application_status: "already_in_baseline"`, enriches the same signal, and does not apply a
second cash-flow adjustment. This is evidence enrichment of the existing financial event,
not a new before/after forecast. Existing financial state and scenarios continue to come
exclusively from `financial_engine.py`, which is unchanged.

Baseline remains cash 4320000, inflows 1940000, outflows 5170000, ending cash 1090000,
shortfall 480000 cents, and runway 18 days. Repeat extraction cannot duplicate expenses.
Supporting genuinely new supplier events will require an explicit deterministic rule for
expense scope, forecast timing, and whether their costs are already accounted for.

## Providers and failure behavior

Provider settings are read at app creation. Unknown provider names and invalid timeouts fail
configuration validation. The default for both providers is fixture; no credentials are needed.

Metadata distinguishes `mode: fixture | live | fallback`, `requested_provider`, actual `provider`,
actual live `model`, and a safe `failure_reason` (missing_credentials, provider_unavailable,
invalid_output). Fallback never claims a successful live request. Model output, HTTP error
bodies and credentials are not included in public errors. Secret configuration fields are redacted.

Missing keys, timeout/network failures, HTTP errors including 429, malformed JSON, schema
failures, and unsupported evidence in NVIDIA output fall back to validated fixture extraction.
There are no retries. If the local source cannot be verified, the request fails without mutation.
Only the supplier notice has a fixture fallback. Unknown document IDs return 404; unsupported
or unverifiable documents return 422.

NVIDIA uses its documented non-streaming chat completions API, temperature 0, max_tokens 2048,
and a schema in the extraction prompt. No unsupported structured-output extension is assumed.
Truncated responses and non-JSON output fail closed into labeled fallback.

References: [NVIDIA API](https://docs.api.nvidia.com/nim/reference/nvidia-llama-3_3-nemotron-super-49b-v1-infer),
[ElevenLabs speech API](https://elevenlabs.io/docs/api-reference/text-to-speech/convert).

## Voice architecture

`existing engine state/scenario → deterministic briefing → VoiceProvider → speech`

The fixture voice provider returns grounded text and null audio. It does not fabricate speech.
The live provider sends that exact text to ElevenLabs TTS using `eleven_multilingual_v2` and
`mp3_44100_128`. The response includes base64 MP3 and `audio/mpeg`. Failure preserves the
briefing and returns explicit fixture fallback metadata with null audio.

Supported focus values are summary, runway, changes, biggest_risk, and scenario. Runway focus
explains the current burn basis and acknowledges the absence of historical comparisons.
Changes summarizes recorded snapshot warnings, not changes on the wall-clock date.
Biggest risk uses existing severity (with stable ID tie breaking). Scenario focus requires
the existing `ScenarioRequest`; results are produced by `calculate_scenario`.

There is no microphone, speech recognition, free-form question interpretation, or conversational
agent. A frontend can map question buttons to the focus enum. Payment-next-week simulation is
not supported: the existing engine has no timing-aware scenario, and the overdue receivable is
already in expected inflows. Do not represent an added cash adjustment as that invoice being paid.

## Configuration

Copy `.env.example` to `.env`, then launch with:

```sh
.venv/bin/uvicorn runway_api.main:app --app-dir apps/api --env-file .env --reload
```

The app does not load `.env` by itself; use `--env-file` or exported environment variables.

| Variable | Default / live requirement |
| --- | --- |
| RUNWAY_SIGNAL_PROVIDER | fixture; set nemotron for live attempts |
| NVIDIA_API_KEY | Required for live NVIDIA |
| NVIDIA_BASE_URL | https://integrate.api.nvidia.com/v1 |
| NVIDIA_MODEL | nvidia/llama-3.3-nemotron-super-49b-v1 |
| NVIDIA_TIMEOUT_SECONDS | 20; positive, at most 120 |
| RUNWAY_VOICE_PROVIDER | fixture; set elevenlabs for live attempts |
| ELEVENLABS_API_KEY | Required for live voice |
| ELEVENLABS_VOICE_ID | Required; choose a voice available to your account |
| ELEVENLABS_BASE_URL | https://api.elevenlabs.io/v1 |
| ELEVENLABS_MODEL | eleven_multilingual_v2 |
| ELEVENLABS_TIMEOUT_SECONDS | 20; positive, at most 120 |

Live paths are HTTP-mocked in tests, not account-tested. Actual model access, quotas and voice
permissions must be verified with demo credentials. Each live POST can incur provider charges.

## Exact frontend contract and demo path

Shared types are exported from `@runway/contracts`; existing fields remain compatible.
The only addition to existing Signal is optional nullable `extraction`.
New types: SupplierFacts, ProviderMetadata, ExtractionProvenance, ExtractionResponse,
VoiceRequest, VoiceResponse. No frontend implementation changes are included.

1. `POST /api/demo/reset`, then `GET /api/financial-state` and `GET /api/documents`.
2. `POST /api/documents/doc-supplier-price-notice/extract` with no body.
3. Read `ExtractionResponse.signal.extraction.attributes` for Metro Foods, 18%, the date and
   explicit monthly amount. Render `signal.evidence[].excerpt` as text and show the computed
   locator, filename/title and extraction timestamp. Display the provider mode prominently.
4. Display `signal.financial_effect` and returned `financial_state`. Explain that the effect is
   already in the baseline. Refresh `GET /api/signals` or `/api/signals/signal-supplier-increase`
   to retrieve the persisted provenance. `GET /api/documents` still identifies the synthetic source.
5. `POST /api/voice/briefing` with `{ "focus": "summary" }` (empty body is also supported).
   Render `text`; use `financial_state`, `signal_ids`, and optional `scenario` as references.
6. If audio is non-null, decode `audio_base64` into a Blob with `audio_mime_type` and play using
   an object URL after a user gesture; revoke the URL afterward. Fixture/fallback mode is text-only.
7. For an explicit scenario, send:

```json
{"focus":"scenario","scenario":{"name":"Cost pressure","expense_change_percent":5}}
```

Example requests:

```sh
curl -X POST http://localhost:8000/api/documents/doc-supplier-price-notice/extract
curl -X POST http://localhost:8000/api/voice/briefing \
  -H 'Content-Type: application/json' -d '{"focus":"summary"}'
```

## Verification and remaining work

Run `pytest`, `ruff check apps/api tests`, `ruff format --check apps/api tests`, then repository
`pnpm lint`, `pnpm typecheck`, and `pnpm build`. Tests inject fixture settings, mock HTTP requests,
and cover source tampering, strict validation, failure/fallback labeling, domain persistence,
baseline preservation, repeat extraction, voice grounding, and engine-generated scenarios.

Remaining integration work: Claude connects the two endpoints and provider badges/audio controls;
configure and smoke-test live accounts; add other document grammars only with evidence validation
and an explicit deterministic mapping. Storage remains in memory. No auth, database, deployment,
background work, or new financial engine is introduced.

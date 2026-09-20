# FreshFields live-provider diagnosis

A real request using the existing integration environment reproduced the failure
before any application edits. OpenRouter returned HTTP 200, model
`nvidia/nemotron-3.5-lightning:free`, provider `Nvidia`, finish reason `stop`.
The JSON passed `SupplierFacts` validation and contained:

```json
{
  "type": "supplier_pricing_increase",
  "entity": "FreshFields Produce",
  "percentage": 7,
  "monthly_increase_usd": null,
  "weekly_spend_usd": 1850,
  "effective_date": "2026-10-01",
  "confidence": 0.95,
  "excerpt": "FreshFields Produce\\nDelivery surcharge notice\\n..."
}
```

The excerpt above is abbreviated. The full captured response is in
`tests/fixtures/freshfields_nemotron_response.json`; only the ephemeral upload ID
was replaced with a stable test ID. No credentials, headers or environment values
are included.

After JSON decoding, the excerpt contained literal backslash-n pairs instead of
actual newlines. `validate_evidence` rejected `facts.excerpt not in content` with
`Source or excerpt mismatch`, mapped publicly to `invalid_output`. The existing
trailing-horizontal-whitespace repair cannot repair this encoding difference.
This was not missing weekly spend, invented monthly arithmetic, a Metro-only
schema, malformed JSON or incomplete output. The original browser response was
not retained; this diagnosis is based on a fresh live reproduction.

The extractor now restores the original source only if the entire decoded excerpt
exactly equals `content.replace("\n", r"\n")`. It does not generically unescape
strings, match partial escaped excerpts, repair words or accept paraphrases. The
prompt additionally clarifies that JSON decoding must produce actual line breaks.
All existing schema and source-fact checks run afterward. Both legitimate amount
bases remain supported; neither becomes universally mandatory. Provider-invented
monthly amounts, weekly spend, percentages and dates still fail validation.

The engine, fixture extractor, upload implementation, contracts, voice and frontend
are unchanged. Regression tests replay the captured PDF response and reject altered
facts, source IDs, text, internal spacing, line breaks, partial escaped excerpts,
other escapes, malformed JSON and missing required fields or amount basis. They
also check exact restored evidence, $561.17 deterministic impact, proposed status,
unchanged financial state and idempotent extraction. Existing Metro live-shaped
response tests continue to cover the monthly amount basis.

## Confirmed live browser result

The real browser retest **passed**, as confirmed by the user after the compatibility
fix. FreshFields showed **Analyzed · Nemotron**, **Extracted with NVIDIA Nemotron**,
and model `nvidia/nemotron-3.5-lightning:free`. The validated facts were FreshFields
Produce, 7%, $1,850/week, October 1, 2026, and 95% confidence. Source evidence passed
strict validation. This confirms the live-provider path, not just fixture fallback.

Temporary development tracing has been removed: no diagnostic class, raw provider
message/source logging, diagnostic settings flag, or diagnostic-only tests remain.
The captured synthetic response and all 17 permanent replay/regression cases remain.
No financial engine, forecast behavior, or live-forecast branch changes are part of
this fix.

## Reproducing the browser verification

Stop the existing API with Ctrl-C in its terminal, then run:

```bash
cd /Users/jkathila/Desktop/work/runway-nemotron-upload
RUNWAY_SIGNAL_PROVIDER=nemotron .venv/bin/uvicorn runway_api.main:app \
  --app-dir apps/api \
  --env-file /Users/jkathila/Desktop/work/runway-integration/.env \
  --host 127.0.0.1 --port 8000
```

The environment file is read, not modified. Use one worker. Restart clears the
in-memory uploads. Upload `data/demo-uploads/freshfields-surcharge.pdf` anew and
analyze it; an existing saved fallback is cached and will not retry the provider.
Expect **Extracted with NVIDIA Nemotron**, FreshFields Produce, 7%, $1,850/week,
Oct 1, 2026, and $561.17/month deterministic proposed impact. In the extraction
response expect provider `nemotron`, mode `live`, a non-null model,
`monthly_increase_usd: null` and `weekly_spend_usd: 1850`. Compare canonical
financial state before and after; it must be unchanged. Repeat analysis to confirm
the saved result is unchanged. Also retest the seeded Metro notice.

## Verification results

A second real OpenRouter request after the fix returned HTTP 200 from the same
model/provider with the same double-escaped newline shape. Extraction and strict
provenance validation both passed, preserving weekly spend 1850 and null monthly
increase. This direct extractor/provenance check and the subsequent user-confirmed browser
retest both passed.

Complete validation passed: 201 pytest cases (including 17 new captured-response
cases and existing integration/upload/voice coverage), Ruff check, Ruff format
check, frontend lint, frontend typecheck, production build and `git diff --check`.
Pytest emitted two upstream Starlette/httpx/AnyIO deprecation warnings.


## Exact normalization boundary

After strict JSON/schema decoding, the new repair compares the entire excerpt to
`content.replace("\n", r"\n")`. Only equality permits replacing it with the
original source string. An already exact excerpt is unchanged. This is not a general
escape decoder and does not normalize partial excerpts, Unicode escapes, internal
spacing, words, facts, or changed line breaks.

The pre-existing full-document trailing-horizontal-whitespace compatibility check
also remains: both full strings must be identical after removing spaces/tabs at
line ends, and only then is the original source restored. The new escaped-newline
comparison does not combine with whitespace repair to accept a partly matching
encoded source. Strict source ID, exact excerpt containment, supported source grammar,
and every field's grounding are still validated after either permitted repair.

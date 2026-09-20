# Automatic post-upload analysis

## Approach and exact flow

Pattern B: the frontend calls the existing extraction endpoint immediately after the
existing upload endpoint returns the new document ID. Upload and analysis are one user
action. No production backend service, API contract, financial rule, provider behavior,
voice/scenario architecture, or credentials changed. Direct API clients still use the
existing two endpoints; automation is in the normal Documents UI upload handler.

1. Choose one PDF/TXT and click **Upload selected file**.
2. `workflow.upload` awaits `POST /api/documents/upload`: existing parsing and storage.
3. It immediately starts `POST /api/documents/{id}/extract`, with an in-flight guard.
4. Existing extraction/provider fallback, schema/provenance validation, deterministic
   calculations, application policy, deduplication and forecast recomputation run unchanged.
5. The extraction response primes signal-detail and financial-state caches and invalidates
   document/signal/recommendation lists. The Documents view refetches its lists.
6. The saved result appears automatically. Navigating to Overview after completion displays
   the recomputed forecast without a browser reload. Overview also revalidates on mount.

The small `document-workflow.ts` coordinator stores tab-local request/result/error state.
Subscriptions and snapshot reads never initiate requests. Navigating away does not cancel
an analysis already requested, and navigating back does not request another analysis.
The completion callback updates caches even if Documents is unmounted. It is not a worker,
queue, polling mechanism or background job. A full page close/reload may interrupt the client
chain; a saved unprocessed document can still be analyzed manually.

## Actual processing and failure states

* Upload request pending: **Uploading … processing document text…**.
* Extraction request pending: **Analyzing and validating…**, with a message explaining the
  configured provider (Nemotron in live mode), source verification and eligible forecast updates.
* Completed: the existing provider badge and analyzed result, plus a notice distinguishing
  incorporated, duplicate, and no-new-adjustment outcomes.
* Analysis error: **Saved · analysis needs attention**, an explanation that upload succeeded,
  and **Retry analysis**. Error state survives client-side route navigation in the same tab.
* Successful analysis: **Re-analyze document** remains available. Upload analysis is cached
  by the existing backend; this action is idempotent rather than forcing another model call.

There are no fabricated stage timers. Validation/calculation/application have no separate
server progress events, so the UI accurately represents them as one pending request.

A valid Nemotron/fixture response follows the unchanged application policy. A grounded
fallback retains its existing provider badge and policy treatment. Invalid-model or failed
provenance fallback remains proposed and financially inert. Unsupported qualitative uploads
retain the saved document and extracted source text, with an understandable unsupported
analysis result; the existing supplier-only extractor does not create a new qualitative
signal. Existing Northstar qualitative signals remain intact. No invented financial impact.

## Financial results and idempotency

FreshFields still produces $561.17/month and $325.84 for October 1–18 inclusive.
The Overview update card now explicitly includes the October 1 effective date and filename.

| Metric | Baseline | After automatic FreshFields analysis |
|---|---:|---:|
| Actual current cash | $43,200.00 | $43,200.00 |
| Expected inflows | $19,400.00 | $19,400.00 |
| Expected outflows | $51,700.00 | $52,025.84 |
| Projected ending cash | $10,900.00 | $10,574.16 |
| Projected shortfall | $4,800.00 | $5,125.84 |
| Cash runway | 18 days | 17 days |

An upload-button ref guard prevents double submission while processing. The coordinator
shares overlapping extraction requests per document ID. Neither rendering nor subscribing
triggers analysis. Backend cached extraction, source/fact/effect deduplication, Metro baseline
exclusion and the atomic adjustment ledger remain authoritative. Reset removes uploads and
adjustments and restores the exact baseline. Old tab-local run records cannot apply any
financial effects or attach to newly generated upload IDs.

Voice and scenarios continue reading the recomputed repository financial state unchanged.

## Changes in this follow-up

* `apps/web/lib/document-workflow.ts`: automatic upload-to-analysis orchestration and request guard.
* `apps/web/components/views/DocumentsView.tsx`: invoke chain, subscribe to results, refresh and notices.
* `apps/web/components/domain/DocumentRow.tsx`: processing and attention-needed status pills.
* `apps/web/components/domain/DocumentAnalysisPanel.tsx`: shared run type, retry/re-analysis, accurate copy.
* `apps/web/components/views/HomeView.tsx`: effective date and exact current-cash display.
* `tests/document-workflow.test.mjs`: five Node tests exercising the actual TypeScript coordinator.
* `tests/document_workflow_bridge.py`: test-only JSON-lines bridge to the real FastAPI TestClient.
* `tests/test_document_workflow.py`: include the five workflow checks in complete pytest validation.
* `docs/live_forecast.md`: update the manual flow to automatic analysis.
* `docs/automatic_upload_analysis.md`: this report and browser procedure.

No commits, merges or deployments were performed. Earlier uncommitted live-forecast changes
remain in the workspace.

## Regression coverage and validation

The Node tests use real PDF parsing, extraction, policy, ledger and financial-state APIs via
FastAPI TestClient, without sockets or additional dependencies. The invalid-provider case
mocks only Nemotron output to verify existing strict provenance/fallback handling.
Tests cover:

1. One upload action invokes extraction automatically, emits pending/completed states,
   publishes the response, applies one adjustment and produces all exact financial metrics.
2. Unsubscribe during processing, navigate/resubscribe, and repeated snapshot reads do not
   restart analysis; manual repeat, duplicate PDF upload, Metro and reset remain safe.
3. Qualitative unsupported analysis preserves the document, error state and baseline; retry is safe.
4. Invalid Nemotron evidence falls back and stays proposed with unchanged finances.
5. Concurrent manual/existing upload analysis shares one request; rejected upload starts none.

Run from the repository root with installed Python/frontend dependencies and Node 24
(or another version supporting native TypeScript type stripping):

```sh
.venv/bin/pytest
.venv/bin/ruff check apps/api tests
.venv/bin/ruff format --check apps/api tests
pnpm lint
pnpm build
pnpm typecheck
git diff --check
```

The frontend typecheck should run after the build, not concurrently: Next.js rewrites route
type artifacts during its build. Full validation: **205 pytest tests passed**, including the
five workflow subtests and all existing upload, live-forecast, Nemotron and multilingual voice
tests. Ruff check/format, frontend lint, production build, typecheck and diff whitespace checks
pass. Two third-party Starlette deprecation warnings remain. Standalone Node testing also emits
an informational module-type warning; no module/package configuration was changed to suppress it.

Browser smoke testing confirmed the baseline metrics and updated Documents UI. The Chrome
extension blocked setting the file chooser because file-URL access is disabled; the browser
upload smoke test therefore remains unexecuted. The real TypeScript-to-API upload tests pass.

## Exact browser test procedure

1. Start the API with the existing configured provider environment. For a credential-free
   deterministic run use:
   `RUNWAY_SIGNAL_PROVIDER=fixture .venv/bin/uvicorn runway_api.main:app --port 8000`.
   Use the existing Nemotron environment for the live-provider judge rehearsal. Do not edit secrets.
2. Build contracts: `pnpm --filter @runway/contracts build`. Start the frontend:
   `NEXT_PUBLIC_RUNWAY_DATA_MODE=live pnpm dev:web`. Open http://localhost:3000.
3. Click **Reset demo** and verify the baseline column above.
4. Open **Documents**, click **Upload document**, choose
   `data/demo-uploads/freshfields-surcharge.pdf`, then click **Upload selected file** once.
5. **Do not click Analyze.** Observe uploading, then analyzing/validating, then the analyzed
   result and incorporated notice. The uploaded row must no longer say Ready to analyze.
6. Navigate to **Overview** without reloading. Verify every after value above and the update
   card: FreshFields Produce, $561.17/month, $325.84 in this forecast, effective October 1,
   source freshfields-surcharge.pdf. Current cash must remain $43,200.00.
7. Return to Documents. Inspect the saved result, then click **Re-analyze document**. Confirm
   no second adjustment. Upload the same PDF again and confirm duplicate/no additional impact.
8. Re-analyze Metro's existing notice or upload a TXT copy. Confirm no added baseline impact.
9. Upload a TXT file describing Northstar customer layoffs with no quantified supplier terms.
   Confirm the source remains saved, attention/retry UI appears, and financial totals do not change.
10. Generate a new voice briefing and run a scenario. Their state must still use the live totals.
11. Click **Reset demo** on Overview. Confirm all baseline numbers, no adjustment card, and
    uploaded documents removed. Repeat the judge flow if desired.

For automated Chrome chooser testing, the ChatGPT extension must have its file-URL access
permission enabled; manual file selection in the ordinary app does not require that extension.

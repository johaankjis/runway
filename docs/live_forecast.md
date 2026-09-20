# Live forecast recomputation

## Architecture and boundaries

Originally `InMemoryRepository.reset()` loaded `data/synthetic/demo.json` and called
`calculate_financial_state`. Inflows/outflows are sums of dated cash-flow entries;
ending cash is cash + inflows - outflows; shortfall is the gap to the $15,700 reserve.
Runway uses the explicit fixture burn assumption of $2,400/day, not window net spending
 divided by window length. Scenarios already scale burn by the net-outflow ratio.
Uploads were stored in memory with extracted text and source checksums. Verified
supplier extractions were persisted as proposed signals, leaving financial state unchanged.
Metro's canonical signal is already included in the fixture.

The repository now retains an immutable baseline copy plus an in-memory adjustment
ledger. Under its existing RLock it revalidates source facts, detects duplicates,
creates at most one adjustment, and recomputes the complete state from baseline plus
all active adjustments. It never modifies fixture files or observed cash. Each adjustment
has source signal/document IDs, filename, entity/type, monthly and window amounts,
cadence, effective date, incorporated status, explanation, and UTC application timestamp.
A corresponding expected outflow entry preserves the existing state validation and charts.
Its date is the window end: this is an aggregate forecast accrual, not a known bank debit date.

The existing financial-state and extraction APIs expose `forecast_adjustments`.
Signal disposition and extraction application status now support `incorporated`.
No endpoint, database, provider change, or background infrastructure was added.
TypeScript keeps the new list optional for compatibility with the offline fixture snapshot;
the live backend always returns it.

## Application policy

Only `supplier_pricing_increase` can auto-incorporate. Strict schema and existing
source grammar/evidence validation must pass, including grounded entity, percentage,
amount basis, and effective date. Exactly one source amount basis is permitted:
explicit monthly increase, or weekly spend with percentage. The repository rechecks
facts against stored source text and checksum at the write boundary. The monthly/window
amount is calculated again by application code, never accepted from model financial math.
An effective date is required, and the prorated window amount must be positive.

Qualitative/unsupported uploaded documents and missing quantitative inputs retain the
existing 422 response without creating a signal or changing finances. Existing qualitative
signals remain informational. Out-of-window validated supplier signals stay proposed.
Model schema/grounding failures that recover through the existing verified fallback also
stay proposed. Missing credentials/network outage fallback may incorporate only after
successful deterministic source verification. No confidence threshold substitutes for evidence.

## Exact calculations

All authoritative amounts are integer cents. Calculations use Decimal and ROUND_HALF_UP.

* Monthly supplier cost: weekly USD × percentage / 100 × 52 / 12, rounded to cents;
  or explicit monthly USD converted to cents. Assumes constant spend and 52 weeks/year.
* Window: `[as_of, forecast_end_date]`, inclusive. Start at max(as_of, effective date).
  For each intersecting calendar month, multiply rounded monthly cents by included days /
  calendar days in that month. Sum unrounded fractions, then round once to cents.
  No charge before the effective date; no backfill before as_of.
* Current cash and expected inflows remain baseline facts.
* Expected outflows = baseline outflows + sum of window adjustment cents.
* Ending cash = current cash + expected inflows - expected outflows.
* Shortfall = max(0, minimum reserve - ending cash).
* Daily burn = round_half_up(baseline daily burn × new window net outflows /
  baseline window net outflows). Net outflows = outflows - inflows.
* Runway = floor(current cash / daily burn); zero burn means no finite runway.
  This explicitly preserves the existing scenario stress-scaling convention. It is
  a calibrated burn estimate, not the date of a modeled bank-account depletion.

The generic existing burn helper returns zero for nonpositive new net outflow and retains
base burn when baseline net outflow is nonpositive. The supported demo has positive net
outflows. Forecast inclusion is limited to effects overlapping the current window.

FreshFields: $1,850 × 7% × 52 / 12 = $561.17/month; October 1–18 contributes
18/31 × 56,117 cents = 32,584 cents after rounding.

| Field | Before | After FreshFields |
|---|---:|---:|
| Current cash (actual) | $43,200.00 | $43,200.00 |
| Expected inflows | $19,400.00 | $19,400.00 |
| Expected outflows | $51,700.00 | $52,025.84 |
| Projected ending cash | $10,900.00 | $10,574.16 |
| Projected reserve shortfall | $4,800.00 | $5,125.84 |
| Average daily burn | $2,400.00 | $2,424.21 |
| Runway (whole days) | 18 | 17 |

## Idempotency, consumers and reset

Same-document analysis returns the saved signal. Within the repository lock, uploads
are compared by existing fact tuple, source checksum, or normalized entity + effective
date + deterministic monthly amount. These also deduplicate equivalent TXT/PDF sources.
Metro's known baseline mapping is explicitly excluded even before extraction provenance
has been attached to its seeded signal. Duplicate records reference the original signal,
and never create another adjustment. Concurrent identical uploads incorporate once.

DocumentsView already primes the financial-state/detail caches and refetches signals and
documents after analysis, invalidating recommendations. Overview also revalidates state
on mount. The compact update card shows the latest source, exact monthly/window amounts,
timestamp and expandable calculation. Actual cash and forecast metrics have distinct labels.
There is no polling or cross-tab push refresh.

Voice reads `repo.get_financial_state()` for every briefing; all language slots and voice
scenarios therefore receive the recomputed numbers. ElevenLabs/localization are untouched.
The scenario endpoint also starts from current state, applying the same deterministic
scenario calculations without persisting scenario results into the ledger. A new deterministic
recommendation uses current adjustment totals, ending cash and shortfall; existing advice remains.

POST /api/demo/reset reloads the original fixture, clears uploads and all adjustments,
restores original signals/recommendations, and restores all six exact baseline metrics.
The existing Overview reset handler clears caches and refetches its resources.

## Manual browser procedure

1. From the repository root start the API in one terminal:
   `RUNWAY_SIGNAL_PROVIDER=fixture .venv/bin/uvicorn runway_api.main:app --port 8000`
2. In another terminal run `pnpm --filter @runway/contracts build`, then
   `NEXT_PUBLIC_RUNWAY_DATA_MODE=live pnpm dev:web`. Open http://localhost:3000.
   This uses the actual API with deterministic extraction; no secrets or env files change.
3. Click **Reset demo**. Confirm the before values above and no update card.
4. Open Documents, select `data/demo-uploads/freshfields-surcharge.pdf`, click **Upload selected file**,
   and wait for automatic analysis (no Analyze click). Confirm incorporated status, grounded weekly spend,
   monthly amount, and calculation explanation containing 18/31.
5. Navigate to Overview without reloading. Confirm the after values, actual cash unchanged,
   latest source and timestamp. Expand “How this was calculated”.
6. View saved analysis again, then upload and analyze the same PDF again. Confirm duplicate
   status and unchanged totals/timestamp. Repeat with the TXT version to check equivalent facts.
7. Re-analyze the original Metro Foods notice. Confirm already-in-baseline status and
   unchanged live totals. Upload a copy of Metro's source: it must be a duplicate.
8. Generate a new Voice briefing. Confirm $52,025.84 outflows, $10,574.16 ending cash,
   $5,125.84 shortfall and 17 days. Repeat using another supported language.
9. Run a scenario: its baseline must be the live values. A no-change API scenario has
   identical baseline/projected values. Visit Recommendations for current forecast advice.
10. Upload a plain text customer-layoffs notice or a notice missing weekly spend. Analysis
    must be rejected without changing any financial number.
11. Click Reset demo on Overview. Confirm exact before values, no update card, uploaded
    documents removed, and original signals/recommendations restored.
12. Optional configured Nemotron smoke test: start the API using the existing externally
    configured provider environment and repeat steps 3–6. Do not add credentials to files.

## Limitations

State is ephemeral and process-local: run one API worker for a coherent demo. Restart/reset
loses uploads and adjustments. Source grammar and auto-allowlist remain intentionally narrow.
There is no user removal/edit workflow, future-window scheduler, cross-tab synchronization,
or independently estimated daily transaction forecast. Full notice revisions cannot reliably
be distinguished from new costs; exact/semantic duplicates are conservatively suppressed.
Fallback after invalid model output remains review-only without a manual apply workflow.
Offline frontend fixture mode cannot demonstrate live uploads/recomputation.

## Validation and changed files

Validation completed: **204 pytest tests passed**, including all existing upload,
Nemotron integration, and multilingual voice tests. There are 20 new parameterized
live-forecast cases in `tests/test_live_forecast.py`; upload tests were updated for the
intentional proposed-to-incorporated behavior and assert rejected provider output stays
financially inert. The suite reports two third-party Starlette deprecation warnings.

Passed: `.venv/bin/ruff check apps/api tests`,
`.venv/bin/ruff format --check apps/api tests`, `pnpm lint`, `pnpm typecheck`,
`pnpm build`, and `git diff --check`. The first typecheck lacked built contract
artifacts; a concurrent retry encountered Next.js regenerating route types. The final
standalone typecheck after build passed. Generated Next.js source-file changes were
restored. Browser and live-provider smoke procedures above were not executed this session.

Changed files:

* `apps/api/runway_api/financial_engine.py`: proration and baseline-plus-ledger recomputation.
* `apps/api/runway_api/repository.py`: atomic policy/ledger, duplicate checks, reset, current advice.
* `apps/api/runway_api/models.py`: adjustment contract and incorporated disposition.
* `apps/api/runway_api/integration_models.py`: incorporated extraction response status.
* `apps/api/runway_api/extraction.py`: return persisted application status on initial/cached analysis.
* `packages/contracts/src/index.ts`: corresponding frontend contracts.
* `apps/web/components/views/HomeView.tsx`: live indication, exact amounts, actual/forecast labels.
* `apps/web/components/domain/DocumentAnalysisPanel.tsx`: incorporated status label.
* `tests/test_live_forecast.py`: arithmetic/policy/idempotency/consumer/reset regressions.
* `tests/test_uploads.py`: updated behavior and rejected-model safety assertions.
* `docs/live_forecast.md`: architecture, rules, formulas, validation, manual procedure and limits.

No commits, merges, deployments, secrets, or provider credential changes were made.


The subsequent [automatic upload analysis change](automatic_upload_analysis.md) connects
successful UI uploads directly to extraction and includes its own current validation report.

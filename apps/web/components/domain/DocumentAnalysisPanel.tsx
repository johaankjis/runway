"use client";

import type { Document, FinancialState, Signal } from "@runway/contracts";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  FileText,
  Loader2,
  Percent,
  Quote,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { DocumentStatusPill, type DocumentAnalysisStatus } from "@/components/domain/DocumentRow";
import { ProviderNote } from "@/components/domain/ProviderBadge";
import { ImpactBadge, Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/States";
import { ApiError, NetworkError } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { AnalysisRun } from "@/lib/document-workflow";
import {
  formatCents,
  formatConfidence,
  formatDate,
  formatDateTime,
  formatPercent,
  formatUsd,
} from "@/lib/format";
import { effectHeadline, labelForDocumentType, type Tone } from "@/lib/presentation";
import { providerDisplayName } from "@/lib/providers";

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-line bg-white px-3 py-2.5">
      <span aria-hidden className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-info-50 text-info-600">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
        <p className="mt-0.5 text-[13.5px] font-semibold text-ink">{value}</p>
      </div>
    </div>
  );
}

/** Friendly copy for failures; raw stack traces never reach the UI. */
function describeError(error: Error): { title: string; message: string; tone: "danger" | "info" } {
  if (error instanceof NetworkError) {
    return {
      title: "Runway API unreachable",
      message: "Extraction runs on the backend pipeline. Start the API (fixture provider mode needs no credentials) and try again.",
      tone: "danger",
    };
  }
  if (error instanceof ApiError && error.status === 422) {
    return {
      title: "This document type can't be analyzed yet",
      message:
        "Your document and its source text are saved. No supported, source-verified supplier effect could be extracted, so this attempt did not change the forecast. Qualitative information is retained in the document for review. You can retry analysis without uploading again.",
      tone: "info",
    };
  }
  if (error instanceof ApiError && error.status === 404) {
    return { title: "Document not found", message: "The backend no longer lists this document. Refresh and try again.", tone: "danger" };
  }
  if (error instanceof ApiError) {
    return { title: "Extraction request failed", message: error.message, tone: "danger" };
  }
  return { title: "Extraction could not be completed", message: error.message, tone: "danger" };
}

// --- Pipeline strip ---------------------------------------------------------

type StepState = "done" | "active" | "pending" | "warn";

interface PipelineStep {
  title: string;
  detail: string;
  state: StepState;
}

const dispositionLabel: Record<NonNullable<Signal["disposition"]>, string> = {
  incorporated: "Incorporated into forecast",
  duplicate: "Potential duplicate · not double-counted",
  proposed: "Proposed · not applied",
  baseline: "Already in baseline forecast",
};

const dispositionTone: Record<NonNullable<Signal["disposition"]>, Tone> = {
  incorporated: "success",
  duplicate: "warning",
  proposed: "info",
  baseline: "neutral",
};

/**
 * Derives the "what happened to this document" strip from data the backend
 * already returned. Nothing here is inferred beyond the response fields.
 */
function buildPipeline(document: Document, run: AnalysisRun, signal: Signal | null): PipelineStep[] {
  const analyzing = run.status === "analyzing";
  const failed = run.status === "error";
  const extraction = signal?.extraction ?? null;
  const effect = signal?.financial_effect ?? null;
  const headline = effect ? effectHeadline(effect) : null;
  const evidenceCount = signal?.evidence.length ?? 0;
  const provider = extraction?.provider ?? null;

  const extracted: PipelineStep = analyzing
    ? { title: "Facts extracted", detail: "Requesting the configured provider…", state: "active" }
    : failed
      ? { title: "Facts extracted", detail: "Needs attention", state: "warn" }
      : provider
        ? {
            title: "Facts extracted",
            detail:
              provider.mode === "live"
                ? `${providerDisplayName(provider.provider)}${provider.model ? ` · ${provider.model}` : ""}`
                : provider.mode === "fallback"
                  ? `${providerDisplayName(provider.requested_provider)} unavailable · fallback`
                  : "Deterministic demo fixture",
            state: provider.mode === "fallback" ? "warn" : "done",
          }
        : { title: "Facts extracted", detail: "Not yet run", state: "pending" };

  const verified: PipelineStep = analyzing
    ? { title: "Evidence verified", detail: "Checking every fact against the source…", state: "pending" }
    : extraction && evidenceCount > 0
      ? {
          title: "Evidence verified",
          detail: `${evidenceCount} excerpt${evidenceCount === 1 ? "" : "s"} grounded to the source text`,
          state: "done",
        }
      : { title: "Evidence verified", detail: "Waiting for extraction", state: "pending" };

  const calculated: PipelineStep =
    extraction && headline
      ? { title: "Impact calculated", detail: `${headline} · deterministic engine`, state: "done" }
      : extraction && effect
        ? { title: "Impact calculated", detail: "No dollar effect assigned", state: "pending" }
        : { title: "Impact calculated", detail: "Waiting for verified facts", state: "pending" };

  const disposition = signal?.disposition ?? null;
  const forecast: PipelineStep =
    extraction && disposition
      ? {
          title: "Forecast updated",
          detail: dispositionLabel[disposition],
          state: disposition === "incorporated" || disposition === "baseline" ? "done" : disposition === "duplicate" ? "warn" : "pending",
        }
      : { title: "Forecast updated", detail: "No adjustment applied", state: "pending" };

  return [
    {
      title: document.source === "upload" ? "Document saved" : "Document ingested",
      detail: `${document.filename} · checksum recorded`,
      state: "done",
    },
    extracted,
    verified,
    calculated,
    forecast,
  ];
}

function PipelineStrip({ steps }: { steps: PipelineStep[] }) {
  return (
    <ol className="grid grid-cols-1 gap-2 rounded-xl border border-line bg-slate-50/70 p-2 sm:grid-cols-5 sm:gap-0" aria-label="Analysis pipeline">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={step.title} className="relative flex items-start gap-2.5 rounded-lg px-2.5 py-2">
            <span
              aria-hidden
              className={cn(
                "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ring-1",
                step.state === "done" && "bg-success-500 text-white ring-success-500",
                step.state === "active" && "bg-info-100 text-info-600 ring-info-100",
                step.state === "warn" && "bg-warning-100 text-warning-600 ring-warning-100",
                step.state === "pending" && "bg-white text-muted-light ring-line-strong",
              )}
            >
              {step.state === "done" ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : step.state === "active" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : step.state === "warn" ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <span className="text-[10px] font-bold">{index + 1}</span>
              )}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-[12.5px] font-semibold", step.state === "pending" ? "text-muted" : "text-ink")}>
                {step.title}
              </span>
              <span className="block truncate text-[11px] text-muted" title={step.detail}>
                {step.detail}
              </span>
            </span>
            {!last ? (
              <span aria-hidden className="absolute right-0 top-1/2 hidden h-px w-3 -translate-y-1/2 bg-line-strong sm:block" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

// --- Extracted signal summary -----------------------------------------------

function ExtractedSignalSummary({ signal, financialState }: { signal: Signal; financialState: FinancialState | null }) {
  const extraction = signal.extraction;
  const effect = signal.financial_effect;
  const headline = effectHeadline(effect);
  if (!extraction) return null;
  const facts = extraction.attributes;
  const pctDigits = Number.isInteger(facts.percentage) ? 0 : 1;
  const disposition = signal.disposition ?? "baseline";

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
      <div className="space-y-4">
        <div className="rounded-xl border border-info-100 bg-info-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-info-100 text-info-600">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Extracted fact</p>
                <p className="text-[14.5px] font-semibold text-ink">{signal.title}</p>
              </div>
            </div>
            <ImpactBadge level={signal.impact_level} />
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Fact icon={<Building2 className="h-3.5 w-3.5" />} label="Entity" value={facts.entity} />
            <Fact
              icon={<Percent className="h-3.5 w-3.5" />}
              label="Event"
              value={`Supplier price increase · +${formatPercent(facts.percentage, pctDigits)}`}
            />
            <Fact
              icon={<TrendingUp className="h-3.5 w-3.5" />}
              label={facts.weekly_spend_usd != null ? "Stated weekly spend" : "Stated monthly impact"}
              value={facts.weekly_spend_usd != null ? `${formatUsd(facts.weekly_spend_usd)} per week` : `${formatUsd(facts.monthly_increase_usd ?? 0)} per month`}
            />
            <Fact
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Effective date"
              value={facts.effective_date ? formatDate(facts.effective_date) : "Not stated in notice"}
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-ink-soft">
            <Pill tone="info" icon={<ShieldCheck className="h-3 w-3" aria-hidden />}>
              Confidence {formatConfidence(facts.confidence)}
            </Pill>
            <span>Extracted {formatDateTime(extraction.extracted_at)}</span>
          </div>
          <div className="mt-2.5">
            <ProviderNote meta={extraction.provider} kind="extraction" />
          </div>
        </div>

        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Source evidence</p>
          <ul className="mt-2 space-y-2">
            {signal.evidence.map((item) => (
              <li key={item.id} className="rounded-lg border border-line bg-white p-3">
                <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink">
                  <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info-500" aria-hidden />
                  <span className="whitespace-pre-wrap">
                    “<mark className="rounded bg-warning-100 px-0.5 text-ink">{item.excerpt}</mark>”
                  </span>
                </p>
                <p className="mt-1.5 pl-5 text-[11.5px] text-muted">
                  {extraction.source_filename} · {item.locator} · sha256:{extraction.checksum_sha256.slice(0, 12)}…
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="self-start rounded-xl border border-danger-100 bg-danger-50/50 p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Financial impact</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {headline ? <span className="tabular text-[26px] font-bold tracking-tight text-ink">{headline}</span> : null}
          <Pill tone={dispositionTone[disposition]} dot>
            {dispositionLabel[disposition]}
          </Pill>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">{effect.description}</p>
        <p className="mt-2 text-[11.5px] text-muted">
          Calculated by the deterministic engine from the verified facts above, not by a model.
        </p>
        {financialState ? (
          <dl className="mt-3 grid grid-cols-2 gap-2">
            {[
              { label: "Cash runway", value: financialState.cash_runway_days != null ? `${financialState.cash_runway_days} days` : "—" },
              { label: "Projected shortfall", value: financialState.projected_shortfall_cents > 0 ? formatCents(financialState.projected_shortfall_cents) : "None" },
              { label: "Expected outflows", value: formatCents(financialState.expected_outflows_cents) },
              { label: "Current cash", value: formatCents(financialState.current_cash_cents) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-white/90 px-3 py-2 ring-1 ring-danger-100/60">
                <dt className="text-[11px] text-muted">{item.label}</dt>
                <dd className="tabular text-[15px] font-bold text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <Link href="/cash-flow" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-info-600 hover:underline">
          See the updated forecast <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function DocumentAnalysisPanel({
  document,
  status,
  relatedSignals,
  run,
  onAnalyze,
  className,
}: {
  document: Document;
  status: DocumentAnalysisStatus;
  relatedSignals: Signal[];
  run: AnalysisRun;
  onAnalyze: () => void;
  className?: string;
}) {
  const analyzing = run.status === "analyzing";
  const extractedSignal =
    run.status === "success" ? run.response.signal : (relatedSignals.find((signal) => signal.extraction) ?? null);
  const financialState = run.status === "success" ? run.response.financial_state : null;
  const analyzed = status.kind === "analyzed" || run.status === "success";
  const showPipeline = analyzing || run.status === "error" || !!extractedSignal?.extraction || status.kind === "ready";
  const pipeline = showPipeline ? buildPipeline(document, run, extractedSignal) : null;

  return (
    <Card className={cn("space-y-5", className)} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-50 text-ink-soft ring-1 ring-line">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-bold tracking-tight text-ink">{document.title}</h2>
              <DocumentStatusPill status={status} />
            </div>
            <p className="mt-0.5 text-[12px] text-muted">
              {labelForDocumentType(document.document_type)} · {document.filename} · dated {formatDate(document.document_date)}
            </p>
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-soft">{document.source === "upload" ? "Source document saved. Analysis verifies evidence before any forecast adjustment." : document.summary}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {extractedSignal ? (
            <Button href={`/signals/${extractedSignal.id}`} variant={analyzed ? "primary" : "secondary"} iconRight={<ArrowRight className="h-4 w-4" aria-hidden />}>
              View signal detail
            </Button>
          ) : null}
          <Button
            variant={analyzed ? "secondary" : "primary"}
            onClick={onAnalyze}
            disabled={analyzing}
            aria-busy={analyzing}
            icon={
              analyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-4 w-4" aria-hidden />
              )
            }
          >
            {analyzing ? "Analyzing and validating…" : run.status === "error" ? "Retry analysis" : analyzed ? "Re-analyze document" : "Analyze document"}
          </Button>
        </div>
      </div>

      {pipeline ? <PipelineStrip steps={pipeline} /> : null}

      {analyzing ? (
        <div role="status" className="rounded-xl border border-info-100 bg-info-50/60 p-4">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
            <Loader2 className="h-4 w-4 animate-spin text-info-600" aria-hidden />
            Analyzing and validating {document.filename}
          </p>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            Requesting the configured extraction provider (Nemotron in live mode), extracting a structured signal, and verifying every fact against the document text before
            any eligible cost is incorporated into the forecast.
          </p>
          <div className="mt-3 space-y-2" aria-hidden>
            <span className="block h-3.5 w-2/5 animate-pulse rounded bg-info-100" />
            <span className="block h-3.5 w-full animate-pulse rounded bg-info-100" />
            <span className="block h-3.5 w-4/5 animate-pulse rounded bg-info-100" />
          </div>
        </div>
      ) : null}

      {run.status === "error" ? (
        (() => {
          const described = describeError(run.error);
          return described.tone === "info" ? (
            <div role="status" className="rounded-xl border border-info-100 bg-info-50 px-4 py-3 text-[12.5px] text-ink-soft">
              <p className="font-semibold text-ink">{described.title}</p>
              <p className="mt-0.5">{described.message}</p>
            </div>
          ) : (
            <ErrorState title={described.title} error={described.message} onRetry={onAnalyze} />
          );
        })()
      ) : null}

      {!analyzing && extractedSignal?.extraction ? (
        <ExtractedSignalSummary signal={extractedSignal} financialState={financialState} />
      ) : null}

      {!analyzing && !extractedSignal?.extraction && run.status !== "error" ? (
        <div className="rounded-xl border border-dashed border-line-strong p-4">
          {status.kind === "ready" ? (
            <>
              <p className="text-[13px] font-semibold text-ink">Not analyzed yet</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                Analyze this notice to extract a structured supplier signal with the entity, percentage, effective date,
                supporting excerpt, confidence, and the provider that produced it. Facts are verified against the source
                before any eligible cost is incorporated into the forecast.
              </p>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-ink">Processed from the deterministic fixture</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">
                {relatedSignals.length
                  ? "This document already contributes signals with traceable evidence. Model extraction is currently available for supplier pricing notices."
                  : "No signals reference this document."}
              </p>
              {relatedSignals.length ? (
                <ul className="mt-2.5 space-y-1.5">
                  {relatedSignals.map((signal) => (
                    <li key={signal.id}>
                      <Link href={`/signals/${signal.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-info-600 hover:underline">
                        {signal.title}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </Card>
  );
}

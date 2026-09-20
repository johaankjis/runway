"use client";

import type { Document, ExtractionResponse, FinancialState, Signal } from "@runway/contracts";
import {
  ArrowRight,
  Building2,
  CalendarDays,
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
import {
  formatCents,
  formatConfidence,
  formatDate,
  formatDateTime,
  formatPercent,
  formatUsd,
} from "@/lib/format";
import { cleanExcerpt, effectHeadline, labelForDocumentType } from "@/lib/presentation";

export type AnalysisRun =
  | { status: "idle" }
  | { status: "analyzing" }
  | { status: "success"; response: ExtractionResponse }
  | { status: "error"; error: Error };

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
        "Extraction currently supports supplier pricing notices with verifiable evidence. This document's signals come from the deterministic fixture.",
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

function ExtractedSignalSummary({ signal, financialState }: { signal: Signal; financialState: FinancialState | null }) {
  const extraction = signal.extraction;
  const effect = signal.financial_effect;
  const headline = effectHeadline(effect);
  if (!extraction) return null;
  const facts = extraction.attributes;
  const pctDigits = Number.isInteger(facts.percentage) ? 0 : 1;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-info-100 bg-info-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-info-100 text-info-600">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Extracted signal</p>
              <p className="text-[14px] font-semibold text-ink">{signal.title}</p>
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
            label="Stated monthly impact"
            value={`${formatUsd(facts.monthly_increase_usd)} per month`}
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
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Supporting evidence</p>
        <ul className="mt-2 space-y-2">
          {signal.evidence.map((item) => (
            <li key={item.id} className="rounded-lg border border-line bg-white p-3">
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-ink">
                <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info-500" aria-hidden />
                <span className="whitespace-pre-line">
                  “<mark className="rounded bg-warning-100 px-0.5 text-ink">{cleanExcerpt(item.excerpt)}</mark>”
                </span>
              </p>
              <p className="mt-1.5 pl-5 text-[11.5px] text-muted">
                {extraction.source_filename} · {item.locator} · sha256:{extraction.checksum_sha256.slice(0, 12)}…
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border border-danger-100 bg-danger-50/40 p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Financial effect</p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {headline ? <span className="tabular text-[22px] font-bold tracking-tight text-ink">{headline}</span> : null}
          <Pill tone="danger" dot>
            Already in baseline
          </Pill>
        </div>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-soft">
          The deterministic engine already includes this increase in the forecast. Extraction attaches provenance to
          the existing signal; it does not apply the cost a second time.
        </p>
        {financialState ? (
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Current cash", value: formatCents(financialState.current_cash_cents) },
              { label: "Projected shortfall", value: financialState.projected_shortfall_cents > 0 ? formatCents(financialState.projected_shortfall_cents) : "None" },
              { label: "Cash runway", value: financialState.cash_runway_days != null ? `${financialState.cash_runway_days} days` : "—" },
              { label: "Expected outflows", value: formatCents(financialState.expected_outflows_cents) },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-white/80 px-3 py-2">
                <dt className="text-[11px] text-muted">{item.label}</dt>
                <dd className="tabular text-[15px] font-bold text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
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
  const canAnalyze = status.kind === "ready" || status.kind === "analyzed";

  return (
    <Card className={cn("space-y-5", className)} aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-ink-soft">
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
            <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-soft">{document.summary}</p>
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
            {analyzing ? "Analyzing…" : analyzed ? "Re-analyze document" : canAnalyze ? "Analyze document" : "Analyze document"}
          </Button>
        </div>
      </div>

      {analyzing ? (
        <div role="status" className="rounded-xl border border-info-100 bg-info-50/60 p-4">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
            <Loader2 className="h-4 w-4 animate-spin text-info-600" aria-hidden />
            Analyzing {document.filename}
          </p>
          <p className="mt-1 text-[12.5px] text-ink-soft">
            Reading the source, extracting a structured signal, and verifying every fact against the document text before
            anything is stored.
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
                before anything is stored.
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

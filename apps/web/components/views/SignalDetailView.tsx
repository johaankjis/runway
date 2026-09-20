"use client";

import { ArrowLeft, Check, Share2, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ProviderBadge, ProviderNote } from "@/components/domain/ProviderBadge";
import { SignalIcon } from "@/components/domain/SignalIcon";
import { ProvenanceFlow, SourceDocumentViewer } from "@/components/domain/SourceEvidence";
import { ImpactBadge, Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { formatConfidence, formatDate, formatDateTime, formatUsd } from "@/lib/format";
import {
  calculationStatusLabel,
  calculationStatusTone,
  effectHeadline,
  effectKindLabel,
  impactTone,
  labelForCategory,
} from "@/lib/presentation";

type Tab = "summary" | "source" | "extracted" | "impact";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[14.5px] font-bold tracking-tight text-ink">{label}</p>
      <div className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{children}</div>
    </div>
  );
}

export function SignalDetailView({ id }: { id: string }) {
  // Revalidate on mount so provenance persisted by an extraction run is never stale.
  const signal = useApi(`signal:${id}`, () => api.getSignal(id), { revalidate: true });
  const documents = useApi("documents", api.getDocuments);
  const [tab, setTab] = useState<Tab>("summary");
  const [copied, setCopied] = useState(false);

  const document = documents.data?.find((doc) => doc.id === signal.data?.source_document_id);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  if (signal.error) {
    return (
      <div className="animate-fade-in space-y-4">
        <Link href="/signals" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Signals
        </Link>
        <ErrorState title="Signal not found" error={signal.error} onRetry={signal.refetch} />
      </div>
    );
  }

  if (!signal.data) {
    return (
      <div className="animate-fade-in">
        <LoadingState label="Loading signal" lines={6} />
      </div>
    );
  }

  const data = signal.data;
  const effect = data.financial_effect;
  const headline = effectHeadline(effect);
  const extraction = data.extraction ?? null;

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/signals" className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Signals
        </Link>
        <Button variant="secondary" size="sm" onClick={share} icon={copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Share2 className="h-3.5 w-3.5" aria-hidden />}>
          {copied ? "Link copied" : "Share"}
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <SignalIcon signal={data} tone={impactTone[data.impact_level]} size="xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">{data.title}</h1>
              <ImpactBadge level={data.impact_level} />
            </div>
            <p className="mt-1 text-[13.5px] text-muted">
              Detected in{" "}
              <span className="font-medium text-ink">{document?.filename ?? data.source_document_id}</span> ·{" "}
              {formatDateTime(data.detected_at)}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Pill tone="neutral">{labelForCategory(data.category)}</Pill>
              <Pill tone="info">Confidence {formatConfidence(data.confidence)}</Pill>
              {extraction ? <ProviderBadge meta={extraction.provider} kind="extraction" /> : null}
            </div>
          </div>
        </div>
      </div>

      <Tabs
        label="Signal sections"
        value={tab}
        onChange={setTab}
        className="mb-5"
        tabs={[
          { key: "summary", label: "Summary" },
          { key: "source", label: "Source document" },
          { key: "extracted", label: "Extracted data" },
          { key: "impact", label: "Financial impact" },
        ]}
      />

      {tab === "summary" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.15fr]">
          <Card className="space-y-6 self-start">
            <Field label="What happened?">{data.description}</Field>
            <Field label="Why it matters">
              {effect.description}
              {headline ? (
                <span className="mt-2 block tabular text-[22px] font-bold tracking-tight text-ink">{headline}</span>
              ) : null}
            </Field>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Field label="Category">{labelForCategory(data.category)}</Field>
              <Field label="Confidence">{formatConfidence(data.confidence)}</Field>
              <Field label="Detected">{formatDateTime(data.detected_at)}</Field>
              <Field label="Source">{document?.title ?? data.source_document_id}</Field>
            </div>
            {extraction ? (
              <Field label="Extraction">
                <ProviderNote meta={extraction.provider} kind="extraction" />
                <p className="mt-1.5 text-[12px] text-muted">
                  {extraction.attributes.entity} · +{extraction.attributes.percentage}% · {extraction.attributes.weekly_spend_usd != null ? `${formatUsd(extraction.attributes.weekly_spend_usd)} weekly spend` : `${formatUsd(extraction.attributes.monthly_increase_usd ?? 0)} per month`}
                  {extraction.attributes.effective_date ? ` · effective ${formatDate(extraction.attributes.effective_date)}` : ""} · extracted{" "}
                  {formatDateTime(extraction.extracted_at)}
                </p>
              </Field>
            ) : null}
            <div className="border-t border-line pt-4">
              <Button href="/scenarios" variant="secondary" size="sm" icon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />}>
                Explore a scenario
              </Button>
            </div>
          </Card>
          <SourceDocumentViewer signal={data} document={document} />
        </div>
      ) : null}

      {tab === "source" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
          <SourceDocumentViewer signal={data} document={document} />
          <Card className="space-y-4">
            <Field label="Document">{document?.title ?? data.source_document_id}</Field>
            <Field label="Summary">{document?.summary ?? "—"}</Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Document date">{document ? formatDate(document.document_date) : "—"}</Field>
              <Field label="Ingested">{document ? formatDateTime(document.ingested_at) : "—"}</Field>
              <Field label="Source">{document?.source ?? "—"}</Field>
              <Field label="MIME type">{document?.mime_type ?? "—"}</Field>
            </div>
            <Field label="Checksum (SHA-256)">
              <code className="block break-all font-mono text-[11.5px] text-muted">{document?.checksum_sha256 ?? "—"}</code>
            </Field>
            <Link href="/documents" className="text-[13px] font-medium text-info-600 hover:underline">
              Open Documents
            </Link>
          </Card>
        </div>
      ) : null}

      {tab === "extracted" ? (
        <Card padded={false}>
          <table className="w-full text-left text-[13px]">
            <caption className="sr-only">Structured fields extracted for this signal</caption>
            <tbody>
              {[
                ["Signal ID", data.id],
                ["Type", data.type],
                ["Category", data.category],
                ["Impact level", data.impact_level],
                ["Confidence", formatConfidence(data.confidence)],
                ["Detected at", data.detected_at],
                ["Source document", data.source_document_id],
                ["Effect kind", effect.kind],
                ["Effect amount (cents)", effect.amount_cents ?? "null"],
                ["Effect percentage", effect.percentage ?? "null"],
                ["Cadence", effect.cadence ?? "null"],
                ["Calculation status", effect.calculation_status],
                ...data.evidence.flatMap((item) => [
                  [`Evidence ${item.id} · excerpt`, item.excerpt],
                  [`Evidence ${item.id} · locator`, item.locator],
                ]),
                ...(extraction
                  ? [
                      ["Extraction · source file", extraction.source_filename],
                      ["Extraction · source title", extraction.source_title],
                      ["Extraction · checksum", extraction.checksum_sha256],
                      ["Extraction · extracted at", extraction.extracted_at],
                      ["Extraction · requested provider", extraction.provider.requested_provider],
                      ["Extraction · provider", extraction.provider.provider],
                      ["Extraction · mode", extraction.provider.mode],
                      ["Extraction · model", extraction.provider.model ?? "null"],
                      ["Extraction · failure reason", extraction.provider.failure_reason ?? "null"],
                      ["Facts · type", extraction.attributes.type],
                      ["Facts · entity", extraction.attributes.entity],
                      ["Facts · percentage", extraction.attributes.percentage],
                      ["Facts · monthly increase (USD)", extraction.attributes.monthly_increase_usd],
                      ["Facts · weekly spend (USD)", extraction.attributes.weekly_spend_usd ?? null],
                      ["Facts · effective date", extraction.attributes.effective_date ?? "null"],
                      ["Facts · confidence", formatConfidence(extraction.attributes.confidence)],
                    ]
                  : [["Extraction", "Not yet run — analyze the source document to attach provenance"]]),
              ].map(([key, value]) => (
                <tr key={String(key)} className="border-b border-line last:border-b-0">
                  <th scope="row" className="w-64 px-4 py-2.5 font-medium text-muted">
                    {key}
                  </th>
                  <td className="break-all px-4 py-2.5 font-mono text-[12px] text-ink">{String(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === "impact" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
          <Card className="space-y-5">
            <Field label="Effect">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold">{effectKindLabel[effect.kind]}</span>
                <Pill tone={calculationStatusTone[effect.calculation_status]} dot>
                  {calculationStatusLabel[effect.calculation_status]}
                </Pill>
              </div>
            </Field>
            {headline ? (
              <p className="tabular text-[32px] font-bold tracking-tight text-ink">{headline}</p>
            ) : (
              <p className="text-[15px] font-semibold text-muted">No dollar impact assigned</p>
            )}
            <Field label="How it is treated">{effect.description}</Field>
            <p className="text-[12px] text-muted">
              Applied effects are already part of the forecast in Cash Flow. Observed and unquantified effects are
              shown for awareness only until you test them as a scenario.
            </p>
            <Button href="/scenarios" size="sm" icon={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />}>
              Test in Scenarios
            </Button>
          </Card>
          <ProvenanceFlow signal={data} document={document} />
        </div>
      ) : null}

      {tab === "summary" ? (
        <section aria-labelledby="provenance-heading" className="mt-7">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="provenance-heading" className="text-[16px] font-bold tracking-tight text-ink">
                Where this number comes from
              </h2>
              <p className="mt-0.5 text-[12.5px] text-muted">
                Source document → extracted fact → deterministic financial impact. Nothing here is taken on faith.
              </p>
            </div>
          </div>
          <ProvenanceFlow signal={data} document={document} layout="horizontal" />
        </section>
      ) : null}
    </div>
  );
}

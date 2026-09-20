"use client";

import { ArrowLeft, Check, Share2, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SignalIcon } from "@/components/domain/SignalIcon";
import { ProvenanceFlow, SourceDocumentViewer } from "@/components/domain/SourceEvidence";
import { PageHeader } from "@/components/layout/PageHeader";
import { ImpactBadge, Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { formatConfidence, formatDate, formatDateTime } from "@/lib/format";
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
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">{label}</p>
      <div className="mt-1 text-[13.5px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

export function SignalDetailView({ id }: { id: string }) {
  const signal = useApi(`signal:${id}`, () => api.getSignal(id));
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

      <PageHeader
        eyebrow={
          <div className="flex items-center gap-3">
            <SignalIcon signal={data} tone={impactTone[data.impact_level]} size="lg" />
            <div className="flex flex-wrap items-center gap-2">
              <ImpactBadge level={data.impact_level} />
              <Pill tone="neutral">{labelForCategory(data.category)}</Pill>
              <Pill tone="info">Confidence {formatConfidence(data.confidence)}</Pill>
            </div>
          </div>
        }
        title={data.title}
        subtitle={
          <>
            Detected in{" "}
            <span className="font-medium text-ink">{document?.filename ?? data.source_document_id}</span> ·{" "}
            {formatDateTime(data.detected_at)}
          </>
        }
      />

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
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
          <Card className="space-y-5">
            <Field label="What happened?">{data.description}</Field>
            <Field label="Why it matters">
              {effect.description}
              {headline ? (
                <span className="mt-2 block tabular text-[20px] font-bold tracking-tight text-ink">{headline}</span>
              ) : null}
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">{labelForCategory(data.category)}</Field>
              <Field label="Confidence">{formatConfidence(data.confidence)}</Field>
              <Field label="Detected">{formatDateTime(data.detected_at)}</Field>
              <Field label="Source">{document?.title ?? data.source_document_id}</Field>
            </div>
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
              ].map(([key, value]) => (
                <tr key={String(key)} className="border-b border-line last:border-b-0">
                  <th scope="row" className="w-64 px-4 py-2.5 font-medium text-muted">
                    {key}
                  </th>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-ink">{String(value)}</td>
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
        <section aria-labelledby="provenance-heading" className="mt-6">
          <h2 id="provenance-heading" className="mb-3 text-[15px] font-semibold text-ink">
            Provenance
          </h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
            <ProvenanceFlow signal={data} document={document} />
            <Card tone="info" className="self-start">
              <p className="text-[13px] font-semibold text-ink">Why this matters for trust</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
                Runway never asks you to take an AI claim on faith. Each signal points to a specific excerpt and
                locator in a source document, and the financial effect is computed by the deterministic engine,
                not by a language model.
              </p>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}

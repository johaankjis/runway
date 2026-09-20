"use client";

import type { Document, Signal } from "@runway/contracts";
import { ArrowDown, FileText, Quote, Sparkles, TrendingDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { Pill } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/States";
import { cn } from "@/lib/cn";
import { fetchDocumentContent } from "@/lib/document-content";
import { formatConfidence, formatDate, formatDateTime } from "@/lib/format";
import {
  calculationStatusLabel,
  calculationStatusTone,
  effectHeadline,
  effectKindLabel,
  effectTone,
  labelForDocumentType,
} from "@/lib/presentation";

function StepCard({
  step,
  title,
  icon,
  tone,
  children,
}: {
  step: string;
  title: string;
  icon: ReactNode;
  tone: "neutral" | "info" | "danger";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative rounded-xl border p-4",
        tone === "neutral" && "border-line bg-white",
        tone === "info" && "border-info-100 bg-info-50/60",
        tone === "danger" && "border-danger-100 bg-danger-50/50",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "grid h-7 w-7 place-items-center rounded-md",
            tone === "neutral" && "bg-slate-100 text-ink-soft",
            tone === "info" && "bg-info-100 text-info-600",
            tone === "danger" && "bg-danger-100 text-danger-600",
          )}
        >
          {icon}
        </span>
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{step}</p>
          <p className="text-[13.5px] font-semibold text-ink">{title}</p>
        </div>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Connector() {
  return (
    <div aria-hidden className="flex justify-center py-1 text-muted-light">
      <ArrowDown className="h-4 w-4" />
    </div>
  );
}

/**
 * SOURCE -> EXTRACTED SIGNAL -> FINANCIAL EFFECT.
 * Makes it obvious that Runway can trace a claim back to a document excerpt.
 */
export function ProvenanceFlow({ signal, document }: { signal: Signal; document?: Document }) {
  const evidence = signal.evidence;
  const effect = signal.financial_effect;
  const headline = effectHeadline(effect);
  return (
    <div>
      <StepCard step="Source" title={document?.title ?? signal.source_document_id} icon={<FileText className="h-4 w-4" />} tone="neutral">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
          <dt className="text-muted">Type</dt>
          <dd className="text-ink">{document ? labelForDocumentType(document.document_type) : "Document"}</dd>
          <dt className="text-muted">Filename</dt>
          <dd className="truncate font-mono text-[11.5px] text-ink">{document?.filename ?? "—"}</dd>
          <dt className="text-muted">Document date</dt>
          <dd className="text-ink">{document ? formatDate(document.document_date) : "—"}</dd>
          <dt className="text-muted">Ingested</dt>
          <dd className="text-ink">{document ? formatDateTime(document.ingested_at) : "—"}</dd>
          {document ? (
            <>
              <dt className="text-muted">Checksum</dt>
              <dd className="truncate font-mono text-[11px] text-muted" title={document.checksum_sha256}>
                sha256:{document.checksum_sha256.slice(0, 16)}…
              </dd>
            </>
          ) : null}
        </dl>
      </StepCard>
      <Connector />
      <StepCard step="Extracted signal" title={signal.title} icon={<Sparkles className="h-4 w-4" />} tone="info">
        <ul className="space-y-2">
          {evidence.map((item) => (
            <li key={item.id} className="rounded-lg border border-info-100 bg-white p-3">
              <p className="flex items-start gap-2 text-[13px] text-ink">
                <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info-500" aria-hidden />
                <span>
                  “<mark className="rounded bg-warning-100 px-0.5 text-ink">{item.excerpt}</mark>”
                </span>
              </p>
              <p className="mt-1.5 pl-5 text-[11.5px] text-muted">
                {item.locator} · evidence {item.id}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-[12px] text-ink-soft">
          Confidence <strong className="text-ink">{formatConfidence(signal.confidence)}</strong> · detected{" "}
          {formatDateTime(signal.detected_at)}
        </p>
      </StepCard>
      <Connector />
      <StepCard step="Financial effect" title={effectKindLabel[effect.kind]} icon={<TrendingDown className="h-4 w-4" />} tone={effectTone(effect) === "neutral" ? "neutral" : "danger"}>
        <div className="flex flex-wrap items-center gap-2">
          {headline ? (
            <span className="tabular text-[22px] font-bold tracking-tight text-ink">{headline}</span>
          ) : (
            <span className="text-[14px] font-semibold text-ink">Not quantified</span>
          )}
          <Pill tone={calculationStatusTone[effect.calculation_status]} dot>
            {calculationStatusLabel[effect.calculation_status]}
          </Pill>
        </div>
        <p className="mt-2 text-[12.5px] text-ink-soft">{effect.description}</p>
        <p className="mt-2 text-[11.5px] text-muted">
          Calculated by the deterministic engine, not by a model.{" "}
          <Link href="/cash-flow" className="text-info-600 underline-offset-2 hover:underline">
            See forecast
          </Link>
        </p>
      </StepCard>
    </div>
  );
}

/** Renders the source document with the evidence excerpt highlighted in place. */
export function SourceDocumentViewer({ signal, document }: { signal: Signal; document?: Document }) {
  const [loaded, setLoaded] = useState<{ filename: string; content: string | null } | null>(null);
  const filename = document?.filename ?? null;

  useEffect(() => {
    if (!filename) return;
    let cancelled = false;
    fetchDocumentContent(filename).then((text) => {
      if (!cancelled) setLoaded({ filename, content: text });
    });
    return () => {
      cancelled = true;
    };
  }, [filename]);

  const content: string | null | undefined = !filename
    ? null
    : loaded?.filename === filename
      ? loaded.content
      : undefined;

  const lines = useMemo(() => (content ? content.split("\n") : []), [content]);
  const excerpts = signal.evidence.map((item) => item.excerpt);

  const renderLine = (line: string, index: number) => {
    const clean = line.replace(/\*\*/g, "").replace(/\s{2,}$/, "");
    if (!clean.trim()) return <div key={index} className="h-3" />;
    if (clean.startsWith("# ")) {
      return (
        <h3 key={index} className="text-[16px] font-bold text-ink">
          {clean.slice(2)}
        </h3>
      );
    }
    const hit = excerpts.find((excerpt) => clean.toLowerCase().includes(excerpt.toLowerCase()));
    if (!hit) {
      return (
        <p key={index} className="text-[12.5px] leading-relaxed text-ink-soft">
          {clean}
        </p>
      );
    }
    const start = clean.toLowerCase().indexOf(hit.toLowerCase());
    return (
      <p key={index} className="text-[12.5px] leading-relaxed text-ink">
        {clean.slice(0, start)}
        <mark className="rounded bg-warning-100 px-0.5 font-medium ring-1 ring-warning-500/40">
          {clean.slice(start, start + hit.length)}
        </mark>
        {clean.slice(start + hit.length)}
      </p>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-slate-50 px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-ink-soft">
          <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <span className="truncate font-medium">{document?.filename ?? signal.source_document_id}</span>
        </div>
        <Pill tone="neutral">Page 1 of 1</Pill>
      </div>
      <div className="scrollbar-thin max-h-[440px] space-y-1 overflow-y-auto bg-[#FCFCFB] p-5">
        {content === undefined ? (
          <div className="space-y-2.5">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-11/12" />
            <Skeleton className="h-3.5 w-4/5" />
          </div>
        ) : content === null ? (
          <div>
            <p className="text-[12.5px] text-muted">Full document text is unavailable in this environment.</p>
            <ul className="mt-3 space-y-2">
              {signal.evidence.map((item) => (
                <li key={item.id} className="text-[13px] text-ink">
                  “<mark className="rounded bg-warning-100 px-0.5">{item.excerpt}</mark>”
                  <span className="block text-[11.5px] text-muted">{item.locator}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          lines.map(renderLine)
        )}
      </div>
    </div>
  );
}

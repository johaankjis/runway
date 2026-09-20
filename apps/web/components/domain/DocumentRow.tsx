"use client";

import type { Document, ProviderMetadata } from "@runway/contracts";
import { CheckCircle2, FileText, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

import { CountBadge, Pill } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { labelForDocumentType } from "@/lib/presentation";
import { providerDisplayName } from "@/lib/providers";

/**
 * How far a document has travelled through the pipeline, derived from the
 * backend's signals (never guessed client-side):
 *  - analyzed:  a related signal carries persisted extraction provenance
 *  - ready:     the backend can extract this document but has not yet
 *  - processed: ingested from the deterministic fixture with fixture signals
 */
export type DocumentAnalysisStatus =
  | { kind: "analyzed"; provider: ProviderMetadata }
  | { kind: "analyzing" }
  | { kind: "error" }
  | { kind: "ready" }
  | { kind: "processed" };

export function DocumentStatusPill({ status }: { status: DocumentAnalysisStatus }) {
  if (status.kind === "analyzing") {
    return <Pill tone="info" icon={<Loader2 className="h-3 w-3 animate-spin" aria-hidden />}>Analyzing and validating…</Pill>;
  }
  if (status.kind === "error") {
    return <Pill tone="warning">Saved · analysis needs attention</Pill>;
  }
  if (status.kind === "analyzed") {
    const mode = status.provider.mode;
    return (
      <Pill
        tone={mode === "live" ? "success" : mode === "fallback" ? "warning" : "info"}
        icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}
        title={
          mode === "live"
            ? `Signal extracted live with ${providerDisplayName(status.provider.provider)}`
            : mode === "fallback"
              ? `${providerDisplayName(status.provider.requested_provider)} unavailable; deterministic fallback used`
              : "Signal extracted by the deterministic demo fixture"
        }
      >
        {mode === "live" ? "Analyzed · Nemotron" : mode === "fallback" ? "Analyzed · fallback" : "Analyzed · fixture"}
      </Pill>
    );
  }
  if (status.kind === "ready") {
    return (
      <Pill tone="violet" icon={<Sparkles className="h-3 w-3" aria-hidden />}>
        Ready to analyze
      </Pill>
    );
  }
  return (
    <Pill tone="success" icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}>
      Processed
    </Pill>
  );
}

export function DocumentRow({
  document,
  status,
  selected,
  onSelect,
}: {
  document: Document;
  status: DocumentAnalysisStatus;
  selected: boolean;
  onSelect: () => void;
}) {
  const signalCount = document.related_signal_ids.length;
  const firstSignal = document.related_signal_ids[0];
  return (
    <tr
      aria-selected={selected}
      onClick={onSelect}
      className={cn(
        "group cursor-pointer border-b border-line last:border-b-0 transition-colors",
        selected ? "bg-info-50/70 hover:bg-info-50" : "hover:bg-slate-50",
      )}
    >
      <td className="px-5 py-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          aria-pressed={selected}
          aria-label={`${selected ? "Selected: " : "Select "}${document.title}`}
          className="flex w-full items-center gap-3 rounded-md text-left"
        >
          <span
            aria-hidden
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1",
              selected ? "bg-info-50 text-info-600 ring-info-100" : "bg-slate-50 text-ink-soft ring-line",
            )}
          >
            <FileText className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold text-ink">{document.title}</span>
            <span className="block truncate text-[11.5px] text-muted">{document.filename}</span>
          </span>
        </button>
      </td>
      <td className="px-4 py-3 text-[12.5px] text-ink-soft">{labelForDocumentType(document.document_type)}</td>
      <td className="tabular px-4 py-3 text-[12.5px] text-ink-soft">{formatDate(document.ingested_at)}</td>
      <td className="px-4 py-3">
        <DocumentStatusPill status={status} />
      </td>
      <td className="px-4 py-3">
        {signalCount > 0 && firstSignal ? (
          <Link
            href={signalCount === 1 ? `/signals/${firstSignal}` : "/signals"}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-2 rounded-md text-[12.5px] font-medium text-ink hover:underline"
          >
            <CountBadge count={signalCount} />
            <span className="text-muted">{signalCount === 1 ? "signal" : "signals"}</span>
          </Link>
        ) : (
          <span className="text-[12.5px] text-muted">0</span>
        )}
      </td>
    </tr>
  );
}

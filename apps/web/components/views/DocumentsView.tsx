"use client";

import type { Document, ExtractionResponse, Signal } from "@runway/contracts";
import { Sparkles, Upload, UploadCloud } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

import { DocumentAnalysisPanel, type AnalysisRun } from "@/components/domain/DocumentAnalysisPanel";
import { DocumentRow, type DocumentAnalysisStatus } from "@/components/domain/DocumentRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilterPills } from "@/components/ui/FilterPills";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { invalidateApiCache, primeApiCache, useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { matchesDocumentFilter, type DocumentFilter } from "@/lib/presentation";

/** The backend's extraction grammar currently covers supplier pricing notices. */
const EXTRACTABLE_TYPES = new Set(["supplier_notice"]);

function statusFor(document: Document, related: Signal[]): DocumentAnalysisStatus {
  const extracted = related.find((signal) => signal.extraction);
  if (extracted?.extraction) return { kind: "analyzed", provider: extracted.extraction.provider };
  if (EXTRACTABLE_TYPES.has(document.document_type)) return { kind: "ready" };
  return { kind: "processed" };
}

export function DocumentsView() {
  const documents = useApi("documents", api.getDocuments);
  const signals = useApi("signals", api.getSignals, { revalidate: true });
  const [filter, setFilter] = useState<DocumentFilter>("all");
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, AnalysisRun>>({});
  const refetchSignals = signals.refetch;
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const all = documents.data ?? [];
  const visible = all.filter((doc) => matchesDocumentFilter(doc.document_type, filter));
  const count = (key: DocumentFilter) => all.filter((doc) => matchesDocumentFilter(doc.document_type, key)).length;
  const totalSignals = all.reduce((sum, doc) => sum + doc.related_signal_ids.length, 0);
  const signalsByDocument = new Map<string, Signal[]>();
  for (const signal of signals.data ?? []) {
    const list = signalsByDocument.get(signal.source_document_id) ?? [];
    list.push(signal);
    signalsByDocument.set(signal.source_document_id, list);
  }

  // The supplier notice is the demo entry point: pre-select it once documents arrive.
  const defaultId = all.find((doc) => EXTRACTABLE_TYPES.has(doc.document_type))?.id ?? all[0]?.id ?? null;
  const activeId = selectedId && all.some((doc) => doc.id === selectedId) ? selectedId : defaultId;
  const selected = all.find((doc) => doc.id === activeId) ?? null;

  const analyze = useCallback(
    async (documentId: string) => {
      setRuns((prev) => ({ ...prev, [documentId]: { status: "analyzing" } }));
      try {
        const response: ExtractionResponse = await api.extractDocument(documentId);
        // Persisted provenance must flow through the existing signal APIs, so
        // seed the caches with what the backend returned and refetch the list.
        primeApiCache(`signal:${response.signal.id}`, response.signal);
        primeApiCache("financial-state", response.financial_state);
        invalidateApiCache("signals");
        invalidateApiCache("recommendations");
        setRuns((prev) => ({ ...prev, [documentId]: { status: "success", response } }));
        refetchSignals();
      } catch (error) {
        setRuns((prev) => ({
          ...prev,
          [documentId]: { status: "error", error: error instanceof Error ? error : new Error(String(error)) },
        }));
      }
    },
    [refetchSignals],
  );

  useEffect(() => {
    if (selectedId) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  const handleFiles = (files: FileList | null) => {
    const names = Array.from(files ?? []).map((file) => file.name);
    setNotice(
      names.length
        ? `Received ${names.join(", ")}. Upload ingestion is not part of this milestone, so nothing was stored. Select the Metro Foods notice below to run extraction on a real document.`
        : "Upload ingestion is not part of this milestone. Documents shown below come from the deterministic fixture.",
    );
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Documents"
        subtitle="Select a document and let Runway extract a structured signal with traceable evidence."
        actions={
          <Button variant="secondary" onClick={() => inputRef.current?.click()} icon={<Upload className="h-4 w-4" aria-hidden />}>
            Upload document
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        aria-label="Upload document"
        multiple
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div
        role="button"
        tabIndex={0}
        aria-label="Drop a document to extract signals"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "mb-5 flex cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed bg-white px-5 py-4 transition-colors",
          dragging ? "border-info-500 bg-info-50" : "border-line-strong hover:border-navy-600",
        )}
      >
        <span aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-info-50 text-info-600">
          <UploadCloud className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink">Drop invoices, contracts, statements, or notices here</p>
          <p className="text-[12px] text-muted">
            Runway turns documents into structured financial signals with traceable evidence.
          </p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-ink-soft sm:inline-flex">
          <Sparkles className="h-3 w-3" aria-hidden />
          {all.length} documents · {totalSignals} signals extracted
        </span>
      </div>

      {notice ? (
        <div role="status" className="mb-4 rounded-xl border border-info-100 bg-info-50 px-4 py-3 text-[12.5px] text-ink-soft">
          {notice}
        </div>
      ) : null}

      <div className="mb-4">
        <FilterPills
          label="Filter documents by type"
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "All", count: all.length },
            { key: "invoice", label: "Invoices", count: count("invoice") },
            { key: "supplier_notice", label: "Supplier notices", count: count("supplier_notice") },
            { key: "sales_report", label: "Reports", count: count("sales_report") },
            { key: "other", label: "Other", count: count("other") },
          ]}
        />
      </div>

      <Card padded={false} className="overflow-hidden">
        {documents.error ? (
          <div className="p-5">
            <ErrorState title="Could not load documents" error={documents.error} onRetry={documents.refetch} />
          </div>
        ) : documents.loading && !documents.data ? (
          <div className="p-5">
            <LoadingState lines={6} />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No documents of this type" description="Try another filter or upload a document." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <caption className="sr-only">Documents. Select a row to inspect or analyze it.</caption>
              <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2.5">Name</th>
                  <th scope="col" className="px-4 py-2.5">Type</th>
                  <th scope="col" className="px-4 py-2.5">Date added</th>
                  <th scope="col" className="px-4 py-2.5">Status</th>
                  <th scope="col" className="px-4 py-2.5">Signals</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    document={doc}
                    status={statusFor(doc, signalsByDocument.get(doc.id) ?? [])}
                    selected={doc.id === activeId}
                    onSelect={() => setSelectedId(doc.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected ? (
        <div ref={panelRef} className="mt-5">
          <DocumentAnalysisPanel
            document={selected}
            status={statusFor(selected, signalsByDocument.get(selected.id) ?? [])}
            relatedSignals={signalsByDocument.get(selected.id) ?? []}
            run={runs[selected.id] ?? { status: "idle" }}
            onAnalyze={() => void analyze(selected.id)}
          />
        </div>
      ) : null}
    </div>
  );
}

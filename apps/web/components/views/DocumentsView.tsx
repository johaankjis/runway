"use client";

import type { Document, Signal } from "@runway/contracts";
import { Plus, Sparkles, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type DragEvent } from "react";

import { DocumentAnalysisPanel } from "@/components/domain/DocumentAnalysisPanel";
import { DocumentRow, type DocumentAnalysisStatus } from "@/components/domain/DocumentRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FilterPills } from "@/components/ui/FilterPills";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { invalidateApiCache, primeApiCache, useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { createDocumentWorkflow, type AnalysisRun } from "@/lib/document-workflow";
import { matchesDocumentFilter, type DocumentFilter } from "@/lib/presentation";

/** The backend's extraction grammar currently covers supplier pricing notices. */
const EXTRACTABLE_TYPES = new Set(["supplier_notice", "uploaded_document"]);

const workflow = createDocumentWorkflow(api, (response) => {
  primeApiCache(`signal:${response.signal.id}`, response.signal);
  primeApiCache("financial-state", response.financial_state);
  invalidateApiCache("signals");
  invalidateApiCache("documents");
  invalidateApiCache("recommendations");
});
const emptyRuns: Record<string, AnalysisRun> = {};
const serverSnapshot = () => emptyRuns;

function statusFor(document: Document, related: Signal[], run?: AnalysisRun): DocumentAnalysisStatus {
  if (run?.status === "analyzing") return { kind: "analyzing" };
  if (run?.status === "error") return { kind: "error" };
  if (run?.status === "success" && run.response.signal.extraction) {
    return { kind: "analyzed", provider: run.response.signal.extraction.provider };
  }
  const extracted = related.find((signal) => signal.extraction);
  if (extracted?.extraction) return { kind: "analyzed", provider: extracted.extraction.provider };
  if (EXTRACTABLE_TYPES.has(document.document_type)) return { kind: "ready" };
  return { kind: "processed" };
}

export function DocumentsView() {
  const documents = useApi("documents", api.getDocuments, { revalidate: true });
  const signals = useApi("signals", api.getSignals, { revalidate: true });
  const [filter, setFilter] = useState<DocumentFilter>("all");
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);
  const [uploaded, setUploaded] = useState<Document[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const runs = useSyncExternalStore(workflow.subscribe, workflow.getSnapshot, serverSnapshot);
  const refetchSignals = signals.refetch;
  const refetchDocuments = documents.refetch;
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const all = [...uploaded.filter((doc) => !documents.data?.some((item) => item.id === doc.id)), ...(documents.data ?? [])];
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

  useEffect(() => {
    // Refetch read-only lists when a request finishes, including after navigation.
    refetchSignals();
    refetchDocuments();
  }, [runs, refetchSignals, refetchDocuments]);

  useEffect(() => {
    if (selectedId) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedId]);

  const handleFiles = (files: FileList | null) => {
    if (uploadLock.current) return;
    setFile(null);
    if (!files?.length) return;
    if (files.length !== 1) {
      setNotice("Choose one file at a time.");
      return;
    }
    const next = files[0];
    if (!/\.(pdf|txt)$/i.test(next.name)) {
      setNotice("Only PDF or TXT files are supported.");
      return;
    }
    if (next.size === 0 || next.size > 10 * 1024 * 1024) {
      setNotice(next.size === 0 ? "The file is empty." : "File exceeds the 10 MB limit.");
      return;
    }
    setFile(next);
    setNotice(`Selected local file: ${next.name}. Ready to upload.`);
  };

  const upload = async () => {
    if (!file || uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    setNotice(`Uploading ${file.name} → processing document text…`);
    try {
      const { document, run } = await workflow.upload(file, (document) => {
        setUploaded((previous) => [document, ...previous]);
        invalidateApiCache("documents");
        documents.refetch();
        setSelectedId(document.id);
        setFilter("all");
        setFile(null);
        setNotice(`${document.filename} saved. Analyzing and validating source evidence with the configured provider (Nemotron in live mode)… Eligible effects will update the forecast automatically.`);
      });
      setNotice(run.status === "error"
        ? `${document.filename} was saved, but analysis could not complete. Review the details below and retry analysis; you do not need to upload again.`
        : run.status === "success" && run.response.application_status === "incorporated"
          ? `${document.filename} analyzed. Validated supplier costs are incorporated into the forecast. Current cash is unchanged.`
          : run.status === "success" && run.response.application_status === "potential_duplicate"
            ? `${document.filename} analyzed. Matching information already exists; no additional forecast adjustment was applied.`
            : `${document.filename} analyzed. Review the result below; no new forecast adjustment was applied.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed. Try again.");
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
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
        subtitle="Upload, manage, and see what Runway extracted. Analysis starts automatically after upload."
        actions={
          <Button disabled={uploading} onClick={() => inputRef.current?.click()} icon={<Plus className="h-4 w-4" aria-hidden />}>
            Upload document
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        aria-label="Upload document"
        accept=".pdf,.txt,application/pdf,text/plain"
        disabled={uploading}
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
          "mb-5 flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed px-5 py-4 transition-colors",
          dragging ? "border-info-500 bg-info-50" : "border-line-strong bg-white hover:border-navy-600 hover:bg-slate-50/60",
        )}
      >
        <span aria-hidden className="grid h-11 w-11 place-items-center rounded-xl bg-info-50 text-info-600 ring-1 ring-info-100">
          <UploadCloud className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink">Drop a supplier notice, invoice, or statement here</p>
          <p className="text-[12px] text-muted">
            PDF or TXT, up to 10 MB, one file at a time. Runway extracts the facts, verifies them against the source, and updates eligible forecasts.
          </p>
        </div>
        <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-ink-soft sm:inline-flex">
          <Sparkles className="h-3 w-3" aria-hidden />
          {all.length} documents · {totalSignals} signals
        </span>
      </div>

      {file ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3">
          <span className="text-[13px] font-medium text-ink">{file.name}</span>
          <span className="text-[12px] text-muted">{(file.size / 1024).toFixed(0)} KB</span>
          <Button className="ml-auto" disabled={uploading} onClick={() => void upload()} icon={<UploadCloud className="h-4 w-4" aria-hidden />}>
            {uploading ? "Uploading · processing…" : "Upload and analyze"}
          </Button>
        </div>
      ) : null}
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
              <thead className="border-b border-line bg-slate-50/80 text-[11px] font-bold uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Type</th>
                  <th scope="col" className="px-4 py-3">Date added</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Signals</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    document={doc}
                    status={statusFor(doc, signalsByDocument.get(doc.id) ?? [], runs[doc.id])}
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
            status={statusFor(selected, signalsByDocument.get(selected.id) ?? [], runs[selected.id])}
            relatedSignals={signalsByDocument.get(selected.id) ?? []}
            run={runs[selected.id] ?? { status: "idle" }}
            onAnalyze={() => { setNotice(null); void workflow.analyze(selected.id); }}
          />
        </div>
      ) : null}
    </div>
  );
}

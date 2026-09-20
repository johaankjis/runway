import type { Document, ExtractionResponse } from "@runway/contracts";

export type AnalysisRun =
  | { status: "idle" }
  | { status: "analyzing" }
  | { status: "success"; response: ExtractionResponse }
  | { status: "error"; error: Error };

type DocumentApi = {
  uploadDocument: (file: File) => Promise<Document>;
  extractDocument: (id: string) => Promise<ExtractionResponse>;
};

/** Request-driven, tab-local state survives route changes; subscriptions never start work. */
export function createDocumentWorkflow(
  api: DocumentApi,
  onResult: (response: ExtractionResponse) => void,
) {
  let runs: Record<string, AnalysisRun> = {};
  const listeners = new Set<() => void>();
  const inFlight = new Map<string, Promise<AnalysisRun>>();
  const publish = (id: string, run: AnalysisRun) => {
    runs = { ...runs, [id]: run };
    listeners.forEach((listener) => listener());
  };

  const analyze = (id: string): Promise<AnalysisRun> => {
    const pending = inFlight.get(id);
    if (pending) return pending;
    // Install the guard before notifying subscribers or invoking the API.
    const task = Promise.resolve().then(async (): Promise<AnalysisRun> => {
      try {
        const response = await api.extractDocument(id);
        onResult(response);
        const run: AnalysisRun = { status: "success", response };
        publish(id, run);
        return run;
      } catch (error) {
        const run: AnalysisRun = {
          status: "error",
          error: error instanceof Error ? error : new Error(String(error)),
        };
        publish(id, run);
        return run;
      } finally {
        inFlight.delete(id);
      }
    });
    inFlight.set(id, task);
    publish(id, { status: "analyzing" });
    return task;
  };

  return {
    getSnapshot: () => runs,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    analyze,
    async upload(file: File, onUploaded: (document: Document) => void) {
      const document = await api.uploadDocument(file);
      const analysis = analyze(document.id);
      onUploaded(document);
      return { document, run: await analysis };
    },
  };
}

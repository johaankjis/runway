/** Fetches a source document's text from the local Next.js route handler. */
export async function fetchDocumentContent(filename: string): Promise<string | null> {
  try {
    const response = await fetch(`/api/document-content?filename=${encodeURIComponent(filename)}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { content?: string };
    return body.content ?? null;
  } catch {
    return null;
  }
}

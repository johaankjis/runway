import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

/**
 * Serves the raw text of a synthetic source document so the Signal Detail
 * page can show evidence in context. This is a presentation convenience for
 * the local demo only: the backend owns document metadata (GET /api/documents);
 * this route reads the fixture file named by that metadata from disk.
 */
const DOCUMENTS_DIR = path.resolve(process.cwd(), "../../data/documents");

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filename = url.searchParams.get("filename") ?? "";
  if (!filename || path.basename(filename) !== filename || !filename.endsWith(".md")) {
    return NextResponse.json({ detail: "Invalid filename" }, { status: 400 });
  }
  try {
    const available = await readdir(DOCUMENTS_DIR);
    if (!available.includes(filename)) {
      return NextResponse.json({ detail: "Document not found" }, { status: 404 });
    }
    const content = await readFile(path.join(DOCUMENTS_DIR, filename), "utf8");
    return NextResponse.json({ filename, content });
  } catch {
    return NextResponse.json({ detail: "Document content unavailable" }, { status: 404 });
  }
}

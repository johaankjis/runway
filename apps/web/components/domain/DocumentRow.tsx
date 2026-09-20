"use client";

import type { Document } from "@runway/contracts";
import { CheckCircle2, FileText } from "lucide-react";
import Link from "next/link";

import { CountBadge, Pill } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import { labelForDocumentType } from "@/lib/presentation";

export function DocumentRow({ document }: { document: Document }) {
  const signalCount = document.related_signal_ids.length;
  const firstSignal = document.related_signal_ids[0];
  return (
    <tr className="group border-b border-line last:border-b-0 hover:bg-slate-50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-ink-soft">
            <FileText className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-ink">{document.title}</p>
            <p className="truncate text-[11.5px] text-muted">{document.filename}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-[12.5px] text-ink-soft">{labelForDocumentType(document.document_type)}</td>
      <td className="tabular px-4 py-3 text-[12.5px] text-ink-soft">{formatDate(document.ingested_at)}</td>
      <td className="px-4 py-3">
        <Pill tone="success" icon={<CheckCircle2 className="h-3 w-3" aria-hidden />}>
          Processed
        </Pill>
      </td>
      <td className="px-4 py-3">
        {signalCount > 0 && firstSignal ? (
          <Link
            href={signalCount === 1 ? `/signals/${firstSignal}` : "/signals"}
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

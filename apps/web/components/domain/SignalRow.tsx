"use client";

import type { Signal } from "@runway/contracts";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { ImpactBadge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatConfidence, formatDate } from "@/lib/format";
import { effectHeadline, impactTone } from "@/lib/presentation";

import { SignalIcon } from "./SignalIcon";

export function SignalRow({
  signal,
  sourceLabel,
  highlighted = false,
  dense = false,
}: {
  signal: Signal;
  sourceLabel?: string;
  highlighted?: boolean;
  dense?: boolean;
}) {
  const headline = effectHeadline(signal.financial_effect);
  return (
    <li>
      <Link
        href={`/signals/${signal.id}`}
        className={cn(
          "group flex items-center gap-4 border-b border-line px-4 transition-colors last:border-b-0 hover:bg-slate-50",
          dense ? "py-3" : "py-3.5",
          highlighted && "bg-danger-50/60 hover:bg-danger-50",
        )}
      >
        <SignalIcon signal={signal} tone={impactTone[signal.impact_level]} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold text-ink">{signal.title}</p>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {!dense && <span className="text-ink-soft">{signal.description} · </span>}
            {sourceLabel ?? signal.source_document_id} · {formatDate(signal.detected_at)}
            {!dense && signal.confidence < 1 ? ` · ${formatConfidence(signal.confidence)} confidence` : ""}
          </p>
        </div>
        {headline ? (
          <span className="tabular hidden text-[12.5px] font-semibold text-ink-soft md:block">{headline}</span>
        ) : null}
        <ImpactBadge level={signal.impact_level} />
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-light transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}

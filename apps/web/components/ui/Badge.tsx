import type { ImpactLevel } from "@runway/contracts";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { impactLabel, impactTone, type Tone } from "@/lib/presentation";

const toneClasses: Record<Tone, string> = {
  danger: "bg-danger-100 text-danger-600",
  warning: "bg-warning-100 text-warning-600",
  success: "bg-success-100 text-success-600",
  info: "bg-info-100 text-info-600",
  neutral: "bg-slate-100 text-slate-600",
  violet: "bg-violet-100 text-violet-600",
};

const dotClasses: Record<Tone, string> = {
  danger: "bg-danger-500",
  warning: "bg-warning-500",
  success: "bg-success-500",
  info: "bg-info-500",
  neutral: "bg-slate-400",
  violet: "bg-violet-600",
};

export function Pill({
  tone = "neutral",
  children,
  className,
  dot = false,
  icon,
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
  icon?: ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-5 whitespace-nowrap",
        toneClasses[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dotClasses[tone])} /> : null}
      {icon}
      {children}
    </span>
  );
}

/** Impact treatment for a signal or recommendation, never relying on color alone. */
export function ImpactBadge({ level, className }: { level: ImpactLevel; className?: string }) {
  return (
    <Pill tone={impactTone[level]} className={className}>
      {impactLabel[level]}
    </Pill>
  );
}

export function CountBadge({ count, tone = "danger" }: { count: number; tone?: Tone }) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular",
        tone === "danger" ? "bg-danger-500 text-white" : toneClasses[tone],
      )}
    >
      {count}
    </span>
  );
}

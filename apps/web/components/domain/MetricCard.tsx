import type { ReactNode } from "react";

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/presentation";

const valueTone: Record<Tone, string> = {
  danger: "text-danger-600",
  warning: "text-warning-600",
  success: "text-success-600",
  info: "text-info-600",
  neutral: "text-ink",
  violet: "text-violet-600",
};

export function MetricCard({
  label,
  value,
  tone = "neutral",
  delta,
  hint,
  icon,
  size = "md",
  className,
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
  delta?: { text: string; tone: Tone; icon?: ReactNode };
  hint?: ReactNode;
  icon?: ReactNode;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-muted">{label}</p>
        {icon}
      </div>
      <p className={cn("tabular font-bold tracking-tight", size === "lg" ? "text-[30px]" : "text-[24px]", valueTone[tone])}>
        {value}
      </p>
      {delta ? (
        <p className={cn("flex items-center gap-1 text-xs font-medium", valueTone[delta.tone])}>
          {delta.icon}
          {delta.text}
        </p>
      ) : null}
      {hint ? <p className="text-[11.5px] text-muted">{hint}</p> : null}
    </Card>
  );
}

/** Inline stat used inside larger cards (e.g. the cash-position header). */
export function InlineStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="min-w-0">
      <p className={cn("tabular text-[20px] font-bold leading-tight tracking-tight", valueTone[tone])}>{value}</p>
      <p className="mt-0.5 text-[11.5px] text-muted">{label}</p>
    </div>
  );
}

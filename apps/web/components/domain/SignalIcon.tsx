import type { Signal } from "@runway/contracts";
import {
  CalendarClock,
  FileWarning,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/presentation";

const iconByCategory: Record<string, LucideIcon> = {
  expenses: TrendingUp,
  receivables: FileWarning,
  revenue: TrendingDown,
  payroll: CalendarClock,
  customer_risk: Users,
};

const toneClasses: Record<Tone, string> = {
  danger: "bg-danger-50 text-danger-500 ring-danger-100",
  warning: "bg-warning-50 text-warning-600 ring-warning-100",
  success: "bg-success-50 text-success-600 ring-success-100",
  info: "bg-info-50 text-info-600 ring-info-100",
  neutral: "bg-slate-50 text-slate-500 ring-slate-200",
  violet: "bg-violet-50 text-violet-600 ring-violet-100",
};

export function SignalIcon({
  signal,
  tone,
  size = "md",
  className,
}: {
  signal: Pick<Signal, "category">;
  tone: Tone;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const Icon = iconByCategory[signal.category] ?? FileWarning;
  const box =
    size === "xl"
      ? "h-14 w-14 rounded-2xl"
      : size === "lg"
        ? "h-11 w-11 rounded-xl"
        : size === "sm"
          ? "h-7 w-7 rounded-md"
          : "h-9 w-9 rounded-lg";
  const glyph = size === "xl" ? "h-6 w-6" : size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center ring-1", box, toneClasses[tone], className)}>
      <Icon className={glyph} />
    </span>
  );
}

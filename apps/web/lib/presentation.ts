/**
 * Presentation-only helpers that map contract values to UI treatments.
 * Nothing here performs authoritative financial arithmetic.
 */
import type {
  FinancialEffect,
  ImpactLevel,
  Recommendation,
  Signal,
} from "@runway/contracts";

import { formatCents, formatPercent, formatSignedCents } from "./format";

export type Tone = "danger" | "warning" | "success" | "info" | "neutral" | "violet";

export const impactTone: Record<ImpactLevel, Tone> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "neutral",
};

export const impactLabel: Record<ImpactLevel, string> = {
  critical: "Critical",
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
};

export const impactRank: Record<ImpactLevel, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

export function sortByImpact<T extends { impact_level: ImpactLevel }>(items: T[]): T[] {
  return [...items].sort((a, b) => impactRank[a.impact_level] - impactRank[b.impact_level]);
}

export type SignalFilter = "all" | "high" | "medium" | "low";

export function matchesSignalFilter(signal: Signal, filter: SignalFilter): boolean {
  if (filter === "all") return true;
  if (filter === "high") return signal.impact_level === "high" || signal.impact_level === "critical";
  return signal.impact_level === filter;
}

export const categoryLabel: Record<string, string> = {
  expenses: "Supplier / Operating expense",
  receivables: "Receivables",
  revenue: "Revenue",
  payroll: "Payroll",
  customer_risk: "Customer risk",
};

export function labelForCategory(category: string): string {
  return categoryLabel[category] ?? category.replace(/_/g, " ");
}

export const effectKindLabel: Record<FinancialEffect["kind"], string> = {
  expense_increase: "Expense increase",
  delayed_inflow: "Delayed inflow",
  revenue_decrease: "Revenue decrease",
  scheduled_outflow: "Scheduled outflow",
  risk_indicator: "Risk indicator",
};

export const calculationStatusLabel: Record<FinancialEffect["calculation_status"], string> = {
  applied: "Applied to forecast",
  observed: "Observed, not applied",
  not_quantified: "Not quantified",
};

export const calculationStatusTone: Record<FinancialEffect["calculation_status"], Tone> = {
  applied: "danger",
  observed: "warning",
  not_quantified: "neutral",
};

/** Short "headline" for a financial effect, e.g. "+$2,140 / month" or "-11.8% weekly". */
export function effectHeadline(effect: FinancialEffect): string | null {
  const cadence =
    effect.cadence === "monthly" ? "/ month" : effect.cadence === "weekly" ? "/ week" : "";
  const sign =
    effect.kind === "expense_increase" || effect.kind === "scheduled_outflow"
      ? -1
      : effect.kind === "revenue_decrease"
        ? -1
        : 1;

  if (effect.amount_cents != null) {
    const amount =
      effect.kind === "delayed_inflow"
        ? formatCents(effect.amount_cents)
        : formatSignedCents(sign * effect.amount_cents);
    return `${amount}${cadence ? ` ${cadence}` : ""}`.trim();
  }
  if (effect.percentage != null) {
    const pct = formatPercent(effect.percentage, 1);
    return `${sign < 0 ? "-" : "+"}${pct}${effect.cadence === "weekly" ? " week over week" : ""}`;
  }
  return null;
}

export function effectTone(effect: FinancialEffect): Tone {
  if (effect.calculation_status === "not_quantified") return "neutral";
  return effect.kind === "delayed_inflow" ? "warning" : "danger";
}

/** Human "source" label for a signal's evidence (document title is resolved by the caller). */
export function signalSourceLabel(signal: Signal, documentTitle?: string): string {
  return documentTitle ?? signal.source_document_id;
}

// --- Recommendations --------------------------------------------------------

export type RecommendationHorizon = "immediate" | "short_term" | "long_term";

export const recommendationHorizon: Record<ImpactLevel, RecommendationHorizon> = {
  critical: "immediate",
  high: "short_term",
  medium: "long_term",
  low: "long_term",
};

export const horizonLabel: Record<RecommendationHorizon, string> = {
  immediate: "Immediate",
  short_term: "Short term",
  long_term: "Long term",
};

export const horizonTone: Record<RecommendationHorizon, Tone> = {
  immediate: "danger",
  short_term: "warning",
  long_term: "violet",
};

export function horizonFor(recommendation: Recommendation): RecommendationHorizon {
  return recommendationHorizon[recommendation.priority];
}

// --- Documents --------------------------------------------------------------

export const documentTypeLabel: Record<string, string> = {
  supplier_notice: "Supplier notice",
  invoice: "Invoice",
  sales_report: "Sales report",
  payroll_schedule: "Payroll schedule",
  customer_update: "Customer update",
};

export function labelForDocumentType(type: string): string {
  return documentTypeLabel[type] ?? type.replace(/_/g, " ");
}

export type DocumentFilter = "all" | "invoice" | "supplier_notice" | "sales_report" | "other";

export function matchesDocumentFilter(type: string, filter: DocumentFilter): boolean {
  if (filter === "all") return true;
  if (filter === "other") {
    return !["invoice", "supplier_notice", "sales_report"].includes(type);
  }
  return type === filter;
}

// --- Evidence ---------------------------------------------------------------

/**
 * Evidence excerpts are verbatim source text (that is what makes them
 * verifiable). For display only, strip Markdown emphasis markers and trailing
 * hard-break spaces so a quoted span reads cleanly.
 */
export function cleanExcerpt(excerpt: string): string {
  return excerpt
    .split("\n")
    .map((line) => line.replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").replace(/\s+$/, ""))
    .join("\n")
    .trim();
}

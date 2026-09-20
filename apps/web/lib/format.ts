const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** $43,200 */
export function formatCents(cents: number): string {
  return usd.format(Math.round(cents / 100));
}

/** $2,140 — for amounts the API already expresses in whole USD (e.g. extracted facts). */
export function formatUsd(dollars: number): string {
  return usd.format(dollars);
}

/** +$19,400 / -$51,700 */
export function formatSignedCents(cents: number): string {
  if (cents === 0) return usd.format(0);
  const sign = cents > 0 ? "+" : "-";
  return `${sign}${usd.format(Math.abs(Math.round(cents / 100)))}`;
}

/** $43.2K */
export function formatCompactCents(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) < 1000) return usd.format(dollars);
  return usdCompact.format(dollars);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatSignedPercent(value: number, digits = 0): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatConfidence(value: number): string {
  return `${Math.round(value * 100)}%`;
}

const dateShort = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const dateLong = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const dateTime = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function parseDate(value: string): Date {
  // Date-only strings are parsed as UTC by the platform; anchor them to noon
  // so they never shift to the previous day in western time zones.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
}

/** Sep 19 */
export function formatDateShort(value: string): string {
  return dateShort.format(parseDate(value));
}

/** Sep 19, 2026 */
export function formatDate(value: string): string {
  return dateLong.format(parseDate(value));
}

/** Sep 19, 2026, 9:00 AM */
export function formatDateTime(value: string): string {
  return dateTime.format(parseDate(value));
}

export function daysBetween(from: string, to: string): number {
  const a = parseDate(from);
  const b = parseDate(to);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function addDays(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/** "supplier_notice" -> "Supplier notice" */
export function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

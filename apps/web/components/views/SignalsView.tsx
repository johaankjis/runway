"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";

import { SignalRow } from "@/components/domain/SignalRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { FilterPills } from "@/components/ui/FilterPills";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { labelForCategory, matchesSignalFilter, sortByImpact, type SignalFilter } from "@/lib/presentation";

export function SignalsView() {
  const signals = useApi("signals", api.getSignals);
  const documents = useApi("documents", api.getDocuments);
  const [filter, setFilter] = useState<SignalFilter>("all");
  const [category, setCategory] = useState<string>("all");

  const documentTitles = new Map((documents.data ?? []).map((doc) => [doc.id, doc.title]));
  const all = useMemo(() => sortByImpact(signals.data ?? []), [signals.data]);
  const categories = useMemo(() => Array.from(new Set(all.map((signal) => signal.category))), [all]);
  const visible = all.filter(
    (signal) => matchesSignalFilter(signal, filter) && (category === "all" || signal.category === category),
  );

  const count = (key: SignalFilter) => all.filter((signal) => matchesSignalFilter(signal, key)).length;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Signals" subtitle="Recent changes that may impact your business, ranked by impact." />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <FilterPills
          label="Filter signals by impact"
          value={filter}
          onChange={setFilter}
          options={[
            { key: "all", label: "All", count: all.length },
            { key: "high", label: "High impact", count: count("high") },
            { key: "medium", label: "Medium", count: count("medium") },
            { key: "low", label: "Low", count: count("low") },
          ]}
        />
        <label className="relative inline-flex items-center">
          <span className="sr-only">Filter by category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="select-plain h-9 cursor-pointer rounded-lg border border-line-strong bg-white pl-3 pr-9 text-[13px] font-medium text-ink shadow-sm focus:border-info-500 focus:outline-none"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {labelForCategory(item)}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-muted" aria-hidden />
        </label>
      </div>

      <Card padded={false}>
        {signals.error ? (
          <div className="p-5">
            <ErrorState title="Could not load signals" error={signals.error} onRetry={signals.refetch} />
          </div>
        ) : signals.loading && !signals.data ? (
          <div className="p-5">
            <LoadingState lines={6} />
          </div>
        ) : visible.length === 0 ? (
          <div className="p-5">
            <EmptyState title="No signals match this filter" description="Try a broader impact level or category." />
          </div>
        ) : (
          <ul aria-label="Signals">
            {visible.map((signal) => (
              <SignalRow
                key={signal.id}
                signal={signal}
                sourceLabel={documentTitles.get(signal.source_document_id)}
                highlighted={signal.impact_level === "critical"}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

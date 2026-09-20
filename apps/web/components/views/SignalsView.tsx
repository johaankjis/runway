"use client";

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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          <span>Category</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-8 rounded-lg border border-line-strong bg-white px-2.5 text-[12.5px] font-medium text-ink"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {labelForCategory(item)}
              </option>
            ))}
          </select>
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

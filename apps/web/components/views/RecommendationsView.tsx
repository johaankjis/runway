"use client";

import { useState } from "react";

import { RecommendationCard } from "@/components/domain/RecommendationCard";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterPills } from "@/components/ui/FilterPills";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { horizonFor, impactRank, type RecommendationHorizon } from "@/lib/presentation";

type Filter = "all" | RecommendationHorizon;

export function RecommendationsView() {
  const recommendations = useApi("recommendations", api.getRecommendations);
  const signals = useApi("signals", api.getSignals);
  const [filter, setFilter] = useState<Filter>("all");

  const signalsById = new Map((signals.data ?? []).map((signal) => [signal.id, signal]));
  const all = [...(recommendations.data ?? [])].sort((a, b) => impactRank[a.priority] - impactRank[b.priority]);
  const visible = all.filter((item) => filter === "all" || horizonFor(item) === filter);
  const count = (key: RecommendationHorizon) => all.filter((item) => horizonFor(item) === key).length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Recommendations"
        subtitle="Actionable next steps to keep your business on track. Runway suggests; you decide."
        actions={
          <FilterPills
            label="Filter recommendations by urgency"
            value={filter}
            onChange={setFilter}
            options={[
              { key: "all", label: "All", count: all.length },
              { key: "immediate", label: "Immediate", count: count("immediate") },
              { key: "short_term", label: "Short term", count: count("short_term") },
              { key: "long_term", label: "Long term", count: count("long_term") },
            ]}
          />
        }
      />

      {recommendations.error ? (
        <ErrorState title="Could not load recommendations" error={recommendations.error} onRetry={recommendations.refetch} />
      ) : recommendations.loading && !recommendations.data ? (
        <LoadingState lines={6} />
      ) : visible.length === 0 ? (
        <EmptyState title="Nothing in this bucket" description="No recommendations match the selected urgency." />
      ) : (
        <div className="space-y-3">
          {visible.map((recommendation) => (
            <RecommendationCard key={recommendation.id} recommendation={recommendation} signalsById={signalsById} />
          ))}
        </div>
      )}
    </div>
  );
}

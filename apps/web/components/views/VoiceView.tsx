"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  TranscriptList,
  VoiceAssistantPanel,
  type TranscriptEntry,
  type VoiceStatus,
} from "@/components/domain/VoiceAssistantPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { api } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { sortByImpact } from "@/lib/presentation";
import { createVoiceAdapter, SUGGESTED_QUESTIONS } from "@/lib/voice";

export function VoiceView() {
  const business = useApi("business", api.getBusiness);
  const state = useApi("financial-state", api.getFinancialState);
  const signals = useApi("signals", api.getSignals);
  const adapter = useMemo(() => createVoiceAdapter(), []);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    const offStatus = adapter.onStatus(setStatus);
    const offTranscript = adapter.onTranscript((role, text) => {
      counter.current += 1;
      setTranscript((prev) => [...prev, { id: `t-${counter.current}`, role, text, at: new Date().toISOString() }]);
    });
    return () => {
      offStatus();
      offTranscript();
    };
  }, [adapter]);

  const toggle = () => {
    if (status === "listening") void adapter.stop();
    else void adapter.start();
  };

  const ask = (question: string) => {
    counter.current += 1;
    const userEntry: TranscriptEntry = { id: `t-${counter.current}`, role: "user", text: question, at: new Date().toISOString() };
    counter.current += 1;
    const replyEntry: TranscriptEntry = {
      id: `t-${counter.current}`,
      role: "runway",
      text: adapter.available
        ? "…"
        : "Voice responses arrive once the ElevenLabs provider is connected. The financial context on the right is what Runway will speak from.",
      at: new Date().toISOString(),
    };
    setTranscript((prev) => [...prev, userEntry, replyEntry]);
  };

  const topSignals = sortByImpact(signals.data ?? []).slice(0, 3);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            Talk to Runway <Pill tone="info">Beta</Pill>
          </span>
        }
        subtitle="Get insights, ask questions, and explore scenarios with your voice."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <VoiceAssistantPanel
            status={status}
            onToggle={toggle}
            suggestions={SUGGESTED_QUESTIONS}
            onSuggestion={ask}
            footer={
              <span>
                Powered by ElevenLabs · Voice responses may be shortened for demo.
                {!adapter.available ? " Provider not yet connected." : ""}
              </span>
            }
          />
          <Card>
            <CardHeader title="Conversation" subtitle="Transcript of this session." />
            <TranscriptList entries={transcript} />
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Financial context" subtitle="What Runway will speak from." />
            {state.data ? (
              <dl className="grid grid-cols-2 gap-3">
                {[
                  { label: "Cash runway", value: state.data.cash_runway_days != null ? `${state.data.cash_runway_days} days` : "—", tone: "text-danger-600" },
                  { label: "Projected shortfall", value: state.data.projected_shortfall_cents > 0 ? formatCents(state.data.projected_shortfall_cents) : "None", tone: "text-danger-600" },
                  { label: "Current cash", value: formatCents(state.data.current_cash_cents), tone: "text-ink" },
                  { label: "Projected balance", value: formatCents(state.data.projected_ending_cash_cents), tone: "text-ink" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-canvas p-3">
                    <dt className="text-[11.5px] text-muted">{item.label}</dt>
                    <dd className={`tabular mt-0.5 text-[18px] font-bold tracking-tight ${item.tone}`}>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <LoadingState lines={3} />
            )}
          </Card>
          <Card>
            <CardHeader title="Top signals" subtitle={business.data ? `Active for ${business.data.name}` : undefined} />
            <ul className="space-y-2.5">
              {topSignals.map((signal) => (
                <li key={signal.id} className="text-[13px]">
                  <p className="font-semibold text-ink">{signal.title}</p>
                  <p className="text-[12px] text-muted">{signal.description}</p>
                </li>
              ))}
              {!signals.data ? <LoadingState lines={3} /> : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

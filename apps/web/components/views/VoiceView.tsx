"use client";

import type { VoiceResponse } from "@runway/contracts";
import { AlertTriangle, ArrowRight, FlaskConical, Quote, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ProviderBadge } from "@/components/domain/ProviderBadge";
import { VoiceAssistantPanel, type VoiceStatus } from "@/components/domain/VoiceAssistantPanel";
import { PageHeader } from "@/components/layout/PageHeader";
import { Pill } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { useApi } from "@/hooks/useApi";
import { api, ApiError, NetworkError } from "@/lib/api";
import { formatCents } from "@/lib/format";
import { sortByImpact } from "@/lib/presentation";
import { providerDescription } from "@/lib/providers";
import { DEFAULT_PROMPT, decodeAudio, VOICE_PROMPTS, type VoicePrompt } from "@/lib/voice";

type AudioState = { kind: "none" } | { kind: "ready"; url: string } | { kind: "malformed" };

interface Briefing {
  prompt: VoicePrompt;
  response: VoiceResponse;
  audio: AudioState;
}

function describeError(error: Error): { title: string; message: string } {
  if (error instanceof NetworkError) {
    return {
      title: "Runway API unreachable",
      message: "Briefings are generated from the backend's calculated state. Start the API (fixture voice mode needs no credentials) and try again.",
    };
  }
  if (error instanceof ApiError && error.status === 422) {
    return { title: "The briefing request was rejected", message: error.message };
  }
  return { title: "Couldn't generate a briefing", message: error.message };
}

export function VoiceView() {
  const business = useApi("business", api.getBusiness);
  const state = useApi("financial-state", api.getFinancialState, { revalidate: true });
  const signals = useApi("signals", api.getSignals, { revalidate: true });

  const [phase, setPhase] = useState<"idle" | "generating" | "ready" | "error">("idle");
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [activePrompt, setActivePrompt] = useState<VoicePrompt | null>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const requestId = useRef(0);

  const releaseAudio = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => releaseAudio, [releaseAudio]);

  const generate = useCallback(
    async (prompt: VoicePrompt) => {
      const id = ++requestId.current;
      setActivePrompt(prompt);
      setPhase("generating");
      setError(null);
      setPlaying(false);
      audioRef.current?.pause();
      try {
        const response = await api.createVoiceBriefing(prompt.request);
        if (id !== requestId.current) return;
        releaseAudio();
        let audio: AudioState = { kind: "none" };
        if (response.audio_base64 && response.audio_mime_type) {
          try {
            const blob = decodeAudio(response.audio_base64, response.audio_mime_type);
            const url = URL.createObjectURL(blob);
            objectUrlRef.current = url;
            audio = { kind: "ready", url };
          } catch {
            audio = { kind: "malformed" };
          }
        }
        setBriefing({ prompt, response, audio });
        setPhase("ready");
        if (audio.kind === "ready") {
          // Playback follows the owner's click; browsers may still block it, in
          // which case the visible controls remain available.
          window.setTimeout(() => {
            audioRef.current?.play().catch(() => undefined);
          }, 0);
        }
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setPhase("error");
      }
    },
    [releaseAudio],
  );

  const hasLiveAudio = briefing?.audio.kind === "ready";
  const status: VoiceStatus =
    phase === "generating"
      ? "generating"
      : phase === "error"
        ? "error"
        : phase === "ready" && briefing
          ? hasLiveAudio
            ? playing
              ? "playing"
              : "ready"
            : briefing.response.provider.mode === "fallback"
              ? "fallback"
              : "fixture"
          : "idle";

  const onPrimary = () => {
    if (status === "playing") {
      audioRef.current?.pause();
      return;
    }
    if (status === "ready" && hasLiveAudio) {
      audioRef.current?.play().catch(() => undefined);
      return;
    }
    void generate(activePrompt ?? DEFAULT_PROMPT);
  };

  const primaryLabel =
    status === "playing"
      ? "Pause briefing audio"
      : status === "ready"
        ? "Play briefing audio"
        : status === "generating"
          ? "Generating briefing"
          : `Generate briefing: ${(activePrompt ?? DEFAULT_PROMPT).label}`;

  const topSignals = sortByImpact(signals.data ?? []).slice(0, 3);
  const signalsById = new Map((signals.data ?? []).map((signal) => [signal.id, signal]));
  const contextState = briefing?.response.financial_state ?? state.data;
  const failure = phase === "error" && error ? describeError(error) : null;
  const retry = () => void generate(activePrompt ?? DEFAULT_PROMPT);

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={
          <span className="inline-flex items-center gap-2.5">
            Talk to Runway <Pill tone="info">Beta</Pill>
          </span>
        }
        subtitle="Grounded briefings spoken from your calculated cash position. Nothing here is invented by a model."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <VoiceAssistantPanel
            status={status}
            onPrimary={onPrimary}
            primaryLabel={primaryLabel}
            prompts={VOICE_PROMPTS}
            activePromptId={activePrompt?.id ?? null}
            onPrompt={(prompt) => void generate(prompt)}
            footer={
              briefing ? (
                <span>{providerDescription(briefing.response.provider, "voice")}</span>
              ) : (
                <span>Briefing text is composed by the deterministic engine; ElevenLabs speaks it when a live voice provider is configured.</span>
              )
            }
          />

          <Card>
            <CardHeader
              title="Briefing"
              subtitle={briefing ? `“${briefing.prompt.label}”` : "Pick a question above or tap the button for a summary."}
              action={briefing ? <ProviderBadge meta={briefing.response.provider} kind="voice" /> : null}
            />

            {phase === "generating" ? (
              <LoadingState label="Generating briefing" lines={4} />
            ) : failure ? (
              <ErrorState title={failure.title} error={failure.message} onRetry={retry} />
            ) : briefing ? (
              <div className="space-y-4">
                <blockquote className="flex items-start gap-3 rounded-xl bg-canvas p-4">
                  <Quote className="mt-1 h-4 w-4 shrink-0 text-info-500" aria-hidden />
                  <p className="text-[15px] leading-relaxed text-ink">{briefing.response.text}</p>
                </blockquote>

                {briefing.audio.kind === "ready" ? (
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Audio</p>
                    <audio
                      ref={audioRef}
                      controls
                      preload="auto"
                      src={briefing.audio.url}
                      aria-label="Briefing audio"
                      className="w-full"
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                      onEnded={() => setPlaying(false)}
                    />
                  </div>
                ) : briefing.audio.kind === "malformed" ? (
                  <p role="status" className="flex items-start gap-2 rounded-lg border border-warning-100 bg-warning-50 px-3 py-2 text-[12.5px] text-ink-soft">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-600" aria-hidden />
                    The voice provider returned audio that could not be decoded. The briefing text above is complete.
                  </p>
                ) : briefing.response.provider.mode === "fallback" ? (
                  <p role="status" className="flex items-start gap-2 rounded-lg border border-warning-100 bg-warning-50 px-3 py-2 text-[12.5px] text-ink-soft">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning-600" aria-hidden />
                    {providerDescription(briefing.response.provider, "voice")}
                  </p>
                ) : (
                  <p role="status" className="flex items-start gap-2 rounded-lg border border-line bg-slate-50 px-3 py-2 text-[12.5px] text-ink-soft">
                    <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                    Text-only demo fixture. Configure ElevenLabs on the API to hear this briefing spoken.
                  </p>
                )}

                <div className="border-t border-line pt-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted">Grounded in</p>
                  <ul className="mt-2 flex flex-wrap gap-2 text-[12px]">
                    <li>
                      <Pill tone="neutral">Cash {formatCents(briefing.response.financial_state.current_cash_cents)}</Pill>
                    </li>
                    <li>
                      <Pill tone={briefing.response.financial_state.projected_shortfall_cents > 0 ? "danger" : "success"}>
                        Shortfall{" "}
                        {briefing.response.financial_state.projected_shortfall_cents > 0
                          ? formatCents(briefing.response.financial_state.projected_shortfall_cents)
                          : "none"}
                      </Pill>
                    </li>
                    <li>
                      <Pill tone="neutral">
                        Runway{" "}
                        {briefing.response.financial_state.cash_runway_days != null
                          ? `${briefing.response.financial_state.cash_runway_days} days`
                          : "unbounded"}
                      </Pill>
                    </li>
                    {briefing.response.signal_ids.map((signalId) => (
                      <li key={signalId}>
                        <Link
                          href={`/signals/${signalId}`}
                          className="inline-flex items-center gap-1 rounded-full border border-info-100 bg-info-50 px-2.5 py-0.5 text-[11px] font-semibold text-info-600 hover:underline"
                        >
                          {signalsById.get(signalId)?.title ?? signalId}
                          <ArrowRight className="h-3 w-3" aria-hidden />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {briefing.response.scenario ? (
                    <div className="mt-3 rounded-lg border border-info-100 bg-info-50/60 px-3 py-2.5 text-[12.5px] text-ink-soft">
                      <p className="font-semibold text-ink">
                        Scenario “{briefing.response.scenario.name}” · engine result
                      </p>
                      <p className="mt-0.5">
                        Projected ending cash {formatCents(briefing.response.scenario.projected.projected_ending_cash_cents)} · shortfall{" "}
                        {briefing.response.scenario.projected.projected_shortfall_cents > 0
                          ? formatCents(briefing.response.scenario.projected.projected_shortfall_cents)
                          : "none"}{" "}
                        · runway{" "}
                        {briefing.response.scenario.projected.cash_runway_days != null
                          ? `${briefing.response.scenario.projected.cash_runway_days} days`
                          : "unbounded"}
                      </p>
                      <Button href="/scenarios" variant="ghost" size="sm" className="mt-1.5 -ml-2" iconRight={<SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />}>
                        Open Scenarios
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[12.5px] text-muted">
                Your briefing will appear here with the numbers it was grounded in.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Financial context" subtitle="What Runway speaks from." />
            {contextState ? (
              <dl className="grid grid-cols-2 gap-3">
                {[
                  { label: "Cash runway", value: contextState.cash_runway_days != null ? `${contextState.cash_runway_days} days` : "—", tone: "text-danger-600" },
                  { label: "Projected shortfall", value: contextState.projected_shortfall_cents > 0 ? formatCents(contextState.projected_shortfall_cents) : "None", tone: "text-danger-600" },
                  { label: "Current cash", value: formatCents(contextState.current_cash_cents), tone: "text-ink" },
                  { label: "Projected balance", value: formatCents(contextState.projected_ending_cash_cents), tone: "text-ink" },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg bg-canvas p-3">
                    <dt className="text-[11.5px] text-muted">{item.label}</dt>
                    <dd className={`tabular mt-0.5 text-[18px] font-bold tracking-tight ${item.tone}`}>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : state.error ? (
              <ErrorState title="Could not load financial state" error={state.error} onRetry={state.refetch} />
            ) : (
              <LoadingState lines={3} />
            )}
          </Card>
          <Card>
            <CardHeader title="Top signals" subtitle={business.data ? `Active for ${business.data.name}` : undefined} />
            <ul className="space-y-2.5">
              {topSignals.map((signal) => (
                <li key={signal.id} className="text-[13px]">
                  <Link href={`/signals/${signal.id}`} className="font-semibold text-ink hover:underline">
                    {signal.title}
                  </Link>
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

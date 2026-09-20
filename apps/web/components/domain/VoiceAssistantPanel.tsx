"use client";

import { AlertTriangle, AudioLines, FlaskConical, Loader2, Pause, Play } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { VoicePrompt } from "@/lib/voice";

/**
 * idle       nothing generated yet
 * generating waiting on POST /api/voice/briefing
 * ready      briefing with live audio, not playing
 * playing    live audio is playing
 * fixture    briefing generated in fixture mode (text only, by design)
 * fallback   live provider requested but unavailable (text only)
 * error      the request failed
 */
export type VoiceStatus = "idle" | "generating" | "ready" | "playing" | "fixture" | "fallback" | "error";

const statusCopy: Record<VoiceStatus, string> = {
  idle: "Ask Runway for a grounded briefing",
  generating: "Checking your numbers…",
  ready: "Briefing ready · tap to play",
  playing: "Runway is speaking",
  fixture: "Briefing ready · text only (demo fixture)",
  fallback: "Briefing ready · voice provider unavailable",
  error: "Couldn't generate a briefing",
};

function Waveform({ active }: { active: boolean }) {
  const bars = [0.4, 0.7, 1, 0.6, 0.85, 0.5, 0.9, 0.65, 0.45];
  return (
    <div aria-hidden className="flex h-10 items-center justify-center gap-1">
      {bars.map((scale, index) => (
        <span
          key={index}
          className={cn(
            "block w-1 rounded-full bg-danger-500/70",
            active ? "animate-wave" : "opacity-30",
          )}
          style={{
            height: `${Math.round(scale * 36)}px`,
            animationDelay: `${index * 90}ms`,
            transformOrigin: "center",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Voice-first shell. The primary control generates a briefing (or plays/pauses
 * live audio once one exists); prompt chips pick which supported focus to ask.
 */
export function VoiceAssistantPanel({
  status,
  onPrimary,
  primaryLabel,
  prompts,
  activePromptId,
  onPrompt,
  disabled = false,
  footer,
}: {
  status: VoiceStatus;
  onPrimary: () => void;
  primaryLabel: string;
  prompts: VoicePrompt[];
  activePromptId: string | null;
  onPrompt: (prompt: VoicePrompt) => void;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  const busy = status === "generating";
  const active = status === "playing" || busy;
  const Icon =
    status === "generating"
      ? Loader2
      : status === "playing"
        ? Pause
        : status === "ready"
          ? Play
          : status === "fallback"
            ? AlertTriangle
            : status === "fixture"
              ? FlaskConical
              : AudioLines;

  return (
    <section
      aria-label="Voice briefing"
      className="flex flex-col items-center rounded-2xl border border-line bg-white px-6 py-8 shadow-card"
    >
      <p role="status" aria-live="polite" className="text-center text-[17px] font-semibold text-ink">
        {statusCopy[status]}
      </p>

      <div className="mt-6 flex h-[172px] w-full max-w-md items-center justify-center gap-6">
        <Waveform active={status === "playing"} />
        <div className="relative grid place-items-center">
          {active ? (
            <span aria-hidden className="absolute inset-0 rounded-full bg-danger-500/30 animate-pulse-ring" />
          ) : null}
          <button
            type="button"
            onClick={onPrimary}
            disabled={disabled || busy}
            aria-busy={busy}
            aria-label={primaryLabel}
            className={cn(
              "relative grid h-24 w-24 place-items-center rounded-full bg-navy-900 text-white transition-all",
              "hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60",
              active ? "shadow-glow ring-4 ring-danger-500/50" : "shadow-pop ring-4 ring-danger-500/20",
            )}
          >
            <Icon className={cn("h-9 w-9", busy && "animate-spin")} aria-hidden />
          </button>
        </div>
        <Waveform active={status === "playing"} />
      </div>

      <div role="group" aria-label="Suggested questions" className="mt-7 flex flex-wrap justify-center gap-2">
        {prompts.map((prompt) => {
          const selected = prompt.id === activePromptId;
          return (
            <button
              key={prompt.id}
              type="button"
              onClick={() => onPrompt(prompt)}
              disabled={disabled || busy}
              aria-pressed={selected}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "border-navy-900 bg-navy-900 text-white"
                  : "border-line-strong bg-white text-ink hover:border-navy-600 hover:bg-slate-50",
              )}
            >
              “{prompt.label}”
            </button>
          );
        })}
      </div>

      {footer ? <div className="mt-6 text-center text-[11.5px] text-muted">{footer}</div> : null}
    </section>
  );
}

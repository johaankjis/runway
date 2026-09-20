"use client";

import { Loader2, Mic, Square } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { VoicePrompt } from "@/lib/voice";

/**
 * idle       nothing generated yet
 * listening  browser recognition is capturing one utterance
 * generating waiting on a grounded answer or briefing
 * ready      briefing with live audio, not playing
 * playing    live audio is playing
 * fixture    briefing generated in fixture mode (text only, by design)
 * fallback   live provider requested but unavailable (text only)
 * error      the request failed
 */
export type VoiceStatus = "idle" | "listening" | "generating" | "ready" | "playing" | "fixture" | "fallback" | "error";

const statusCopy: Record<VoiceStatus, string> = {
  idle: "Ask Runway",
  listening: "Listening…",
  generating: "Understanding your question…",
  ready: "Answer ready · ask another question",
  playing: "Runway is responding",
  fixture: "Briefing ready · text only (demo fixture)",
  fallback: "Briefing ready · voice provider unavailable",
  error: "Couldn't generate a briefing",
};

const statusHint: Record<VoiceStatus, string> = {
  idle: "Tap to speak, type a question, or pick a question below.",
  listening: "Speak one question. Tap again to stop, or cancel below.",
  generating: "Composing the briefing from the engine's calculated state.",
  ready: "Spoken by ElevenLabs. Use the player below to replay or scrub.",
  playing: "Use the audio player below to pause or replay.",
  fixture: "Configure ElevenLabs on the API to hear briefings spoken.",
  fallback: "The briefing text is complete; audio could not be produced.",
  error: "Check the message below and try again.",
};

const WAVE_BARS = [0.3, 0.45, 0.35, 0.6, 0.5, 0.8, 0.45, 0.95, 0.6, 0.75, 0.4, 0.9, 0.55, 0.7, 0.35, 0.85, 0.5, 0.65, 0.4, 0.55, 0.3];

function Waveform({ active, mirrored = false }: { active: boolean; mirrored?: boolean }) {
  const bars = mirrored ? [...WAVE_BARS].reverse() : WAVE_BARS;
  return (
    <div aria-hidden className="hidden h-12 flex-1 items-center justify-center gap-[5px] sm:flex">
      {bars.map((scale, index) => (
        <span
          key={index}
          className={cn(
            "block w-[3px] rounded-full bg-danger-500",
            active ? "animate-wave opacity-80" : "opacity-[0.18]",
          )}
          style={{
            height: `${Math.round(scale * 44)}px`,
            animationDelay: `${index * 70}ms`,
            transformOrigin: "center",
          }}
        />
      ))}
    </div>
  );
}

export function VoiceAssistantPanel({
  status,
  onPrimary,
  primaryLabel,
  prompts,
  activePromptId,
  onPrompt,
  disabled = false,
  languageControl,
  footer,
}: {
  status: VoiceStatus;
  onPrimary: () => void;
  primaryLabel: string;
  prompts: VoicePrompt[];
  activePromptId: string | null;
  onPrompt: (prompt: VoicePrompt) => void;
  disabled?: boolean;
  languageControl?: ReactNode;
  footer?: ReactNode;
}) {
  const busy = status === "generating";
  const active = status === "playing" || status === "listening";
  const Icon = busy ? Loader2 : status === "listening" ? Square : Mic;

  return (
    <section
      aria-label="Voice briefing"
      className="relative flex flex-col items-center rounded-2xl border border-line bg-white px-6 pb-7 pt-6 shadow-card"
    >
      {languageControl ? (
        <div className="mb-4 flex w-full justify-center sm:absolute sm:right-5 sm:top-5 sm:mb-0 sm:w-auto">{languageControl}</div>
      ) : null}

      <p role="status" aria-live="polite" className="mt-1 text-center text-[22px] font-semibold tracking-tight text-ink sm:mt-3">
        {statusCopy[status]}
      </p>
      <p className="mt-1 max-w-md text-center text-[12.5px] text-muted">{statusHint[status]}</p>

      <div className="mt-7 flex w-full max-w-3xl items-center justify-center gap-6">
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
              "relative grid h-28 w-28 place-items-center rounded-full bg-navy-900 text-white transition-all",
              "hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60",
              active
                ? "shadow-glow ring-8 ring-danger-500/30"
                : "shadow-[0_0_0_8px_rgba(225,29,72,0.10),0_0_40px_rgba(225,29,72,0.25)] ring-8 ring-danger-500/15 hover:ring-danger-500/25",
            )}
          >
            <Icon className={cn("h-10 w-10", busy && "animate-spin")} aria-hidden strokeWidth={1.75} />
          </button>
        </div>
        <Waveform active={status === "playing"} mirrored />
      </div>

      <div role="group" aria-label="Suggested questions" className="mt-8 flex max-w-3xl flex-wrap justify-center gap-2.5">
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
                "rounded-full border px-4 py-2 text-[13px] font-medium shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60",
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

      {footer ? <div className="mt-7 text-center text-[11.5px] text-muted">{footer}</div> : null}
    </section>
  );
}

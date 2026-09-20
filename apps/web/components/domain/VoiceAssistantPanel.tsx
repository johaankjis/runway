"use client";

import { Mic, MicOff, Square } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type VoiceStatus = "idle" | "listening" | "processing" | "speaking" | "unavailable";

export interface TranscriptEntry {
  id: string;
  role: "user" | "runway";
  text: string;
  at: string;
}

const statusCopy: Record<VoiceStatus, string> = {
  idle: "Tap to talk to Runway",
  listening: "I'm listening…",
  processing: "Checking your numbers…",
  speaking: "Runway is responding",
  unavailable: "Voice provider not connected",
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
 * Visual shell for the voice experience. The ElevenLabs integration can drive
 * `status`, `transcript`, and the `onToggle` handler without changing layout.
 */
export function VoiceAssistantPanel({
  status,
  onToggle,
  suggestions,
  onSuggestion,
  disabled = false,
  footer,
}: {
  status: VoiceStatus;
  onToggle: () => void;
  suggestions: string[];
  onSuggestion: (question: string) => void;
  disabled?: boolean;
  footer?: ReactNode;
}) {
  const active = status === "listening" || status === "speaking" || status === "processing";
  const Icon = status === "unavailable" ? MicOff : status === "listening" ? Square : Mic;

  return (
    <section
      aria-label="Voice interaction"
      className="flex flex-col items-center rounded-2xl border border-line bg-white px-6 py-8 shadow-card"
    >
      <p role="status" aria-live="polite" className="text-[17px] font-semibold text-ink">
        {statusCopy[status]}
      </p>

      <div className="mt-6 flex h-[172px] w-full max-w-md items-center justify-center gap-6">
        <Waveform active={status === "listening"} />
        <div className="relative grid place-items-center">
          {active ? (
            <span aria-hidden className="absolute inset-0 rounded-full bg-danger-500/30 animate-pulse-ring" />
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            disabled={disabled}
            aria-pressed={status === "listening"}
            aria-label={status === "listening" ? "Stop listening" : "Start talking to Runway"}
            className={cn(
              "relative grid h-24 w-24 place-items-center rounded-full bg-navy-900 text-white transition-all",
              "hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60",
              active ? "shadow-glow ring-4 ring-danger-500/50" : "shadow-pop ring-4 ring-danger-500/20",
            )}
          >
            <Icon className="h-9 w-9" aria-hidden />
          </button>
        </div>
        <Waveform active={status === "speaking"} />
      </div>

      <div className="mt-7 flex flex-wrap justify-center gap-2">
        {suggestions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onSuggestion(question)}
            className="rounded-full border border-line-strong bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-ink transition-colors hover:border-navy-600 hover:bg-slate-50"
          >
            “{question}”
          </button>
        ))}
      </div>

      {footer ? <div className="mt-6 text-[11.5px] text-muted">{footer}</div> : null}
    </section>
  );
}

export function TranscriptList({ entries }: { entries: TranscriptEntry[] }) {
  if (!entries.length) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[12.5px] text-muted">
        Your conversation with Runway will appear here.
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {entries.map((entry) => (
        <li key={entry.id} className={cn("flex", entry.role === "user" ? "justify-end" : "justify-start")}>
          <div
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
              entry.role === "user" ? "rounded-br-md bg-navy-900 text-white" : "rounded-bl-md bg-slate-100 text-ink",
            )}
          >
            <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-wide opacity-60">
              {entry.role === "user" ? "You" : "Runway"}
            </p>
            {entry.text}
          </div>
        </li>
      ))}
    </ol>
  );
}

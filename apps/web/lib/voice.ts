/**
 * Voice integration seam. The ElevenLabs owner replaces `createVoiceAdapter`
 * with a real provider; the page and panel only depend on this interface.
 */
import type { VoiceStatus } from "@/components/domain/VoiceAssistantPanel";

export interface VoiceAdapter {
  /** Begin capturing the user's speech. */
  start(): Promise<void>;
  /** Stop capturing and end any playback. */
  stop(): Promise<void>;
  /** Subscribe to status changes. Returns an unsubscribe function. */
  onStatus(listener: (status: VoiceStatus) => void): () => void;
  /** Subscribe to final transcripts (user speech and Runway replies). */
  onTranscript(listener: (role: "user" | "runway", text: string) => void): () => void;
  /** Whether a real provider is wired up. */
  readonly available: boolean;
}

/**
 * Placeholder adapter: reports "listening" while toggled on and emits no
 * transcripts. Provides visual behavior only; no audio is captured.
 */
export function createVoiceAdapter(): VoiceAdapter {
  const statusListeners = new Set<(status: VoiceStatus) => void>();
  const emit = (status: VoiceStatus) => statusListeners.forEach((listener) => listener(status));
  return {
    available: false,
    async start() {
      emit("listening");
    },
    async stop() {
      emit("idle");
    },
    onStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    onTranscript() {
      return () => undefined;
    },
  };
}

export const SUGGESTED_QUESTIONS = [
  "Why is my cash runway down?",
  "What happens if Northstar pays next week?",
  "Summarize today's changes.",
  "What should I look at right now?",
];

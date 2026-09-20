/**
 * Voice integration: maps owner questions onto the backend's briefing focus
 * enum (POST /api/voice/briefing) and decodes ElevenLabs audio for playback.
 *
 * These fixed chips retain their deterministic briefing route. Spoken and typed
 * questions use the dedicated one-turn question route.
 */
import type { VoiceRequest } from "@runway/contracts";

export interface VoicePrompt {
  id: string;
  /** What the owner would say. */
  label: string;
  /** Exact request the backend supports for that question. */
  request: VoiceRequest;
}

export const VOICE_PROMPTS: VoicePrompt[] = [
  { id: "summary", label: "Summarize my financial situation", request: { focus: "summary" } },
  { id: "runway", label: "Why is my runway down?", request: { focus: "runway" } },
  { id: "changes", label: "What changed today?", request: { focus: "changes" } },
  { id: "biggest_risk", label: "What is my biggest risk?", request: { focus: "biggest_risk" } },
  {
    id: "scenario",
    label: "What if supplier costs rise another 5%?",
    request: {
      focus: "scenario",
      scenario: {
        name: "Cost pressure",
        revenue_change_percent: 0,
        expense_change_percent: 5,
        cash_adjustment_cents: 0,
      },
    },
  },
];

export const DEFAULT_PROMPT = VOICE_PROMPTS[0];

export class MalformedAudioError extends Error {
  constructor() {
    super("The provider returned audio that could not be decoded.");
    this.name = "MalformedAudioError";
  }
}

/**
 * Decode base64 MP3 bytes into a Blob. Throws MalformedAudioError instead of
 * handing the browser garbage, so the page can show text-only with a notice.
 */
export function decodeAudio(base64: string, mimeType: string): Blob {
  const clean = base64.replace(/\s+/g, "");
  if (!clean || clean.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
    throw new MalformedAudioError();
  }
  let binary: string;
  try {
    binary = atob(clean);
  } catch {
    throw new MalformedAudioError();
  }
  if (binary.length < 4) throw new MalformedAudioError();
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

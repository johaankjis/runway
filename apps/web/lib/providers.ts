/**
 * Presentation helpers for backend provider metadata (Nemotron / ElevenLabs /
 * fixture). These only translate what the API returned into labels; they never
 * upgrade a fixture or fallback result into a "live" claim.
 */
import type { ProviderMetadata } from "@runway/contracts";

import type { Tone } from "./presentation";

export type ProviderKind = "extraction" | "voice";

const providerName: Record<ProviderMetadata["provider"], string> = {
  fixture: "Demo fixture",
  nemotron: "NVIDIA Nemotron",
  elevenlabs: "ElevenLabs",
};

const failureCopy: Record<NonNullable<ProviderMetadata["failure_reason"]>, string> = {
  missing_credentials: "credentials not configured",
  provider_unavailable: "provider unreachable",
  grounding_validation_failed: "briefing grounding validation failed; safe English text is shown",
  invalid_output: "provider returned invalid output",
};

export function providerDisplayName(provider: ProviderMetadata["provider"]): string {
  return providerName[provider];
}

export function requestedProviderName(meta: ProviderMetadata): string {
  return providerName[meta.requested_provider];
}

/** Short pill text, e.g. "Extracted with NVIDIA Nemotron" or "Demo fixture". */
export function providerLabel(meta: ProviderMetadata, kind: ProviderKind): string {
  if (meta.mode === "live") {
    return kind === "extraction"
      ? `Extracted with ${providerName[meta.provider]}`
      : `Spoken by ${providerName[meta.provider]}`;
  }
  if (meta.mode === "fallback") {
    return `${requestedProviderName(meta)} unavailable · deterministic fallback`;
  }
  return "Demo fixture";
}

export function providerTone(meta: ProviderMetadata): Tone {
  if (meta.mode === "live") return "success";
  if (meta.mode === "fallback") return "warning";
  return "neutral";
}

/** One-sentence explanation shown next to the pill. */
export function providerDescription(meta: ProviderMetadata, kind: ProviderKind): string {
  const what = kind === "extraction" ? "extraction" : "briefing audio";
  if (meta.mode === "live") {
    return meta.model
      ? `Live ${what} from ${providerName[meta.provider]} (${meta.model}), validated against the source before use.`
      : `Live ${what} from ${providerName[meta.provider]}, validated against the source before use.`;
  }
  if (meta.mode === "fallback") {
    const reason = meta.failure_reason ? failureCopy[meta.failure_reason] : "request failed";
    return `${requestedProviderName(meta)} was requested but ${reason}. Runway used the deterministic fixture ${kind === "extraction" ? "extractor" : "text-only briefing"} instead; no live call succeeded.`;
  }
  return kind === "extraction"
    ? "Deterministic demo extraction with the same validation as a live model call. No external provider was contacted."
    : "Text-only demo briefing grounded in engine state. No speech synthesis provider was contacted.";
}

export function modeLabel(mode: ProviderMetadata["mode"]): string {
  return mode === "live" ? "Live" : mode === "fallback" ? "Fallback" : "Fixture";
}

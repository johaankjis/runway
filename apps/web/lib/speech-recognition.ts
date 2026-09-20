import type { VoiceLanguage } from "@runway/contracts";

export const RECOGNITION_LOCALES: Record<VoiceLanguage, string> = {
  en: "en-US", es: "es-ES", fr: "fr-FR", hi: "hi-IN", ar: "ar-SA",
};

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
export interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => Recognition;
export function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const browser = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

export function recognitionError(error: string): string {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Microphone permission was denied. Allow microphone access or type your question below.";
  }
  if (error === "no-speech") return "No speech was detected. Try again or type your question.";
  return "Speech recognition is unavailable. Try again or type your question below.";
}

export interface SpeechSession {
  start(): void;
  stop(): void;
  cancel(): void;
}

/** No MediaRecorder, audio buffer, upload, or persistent transcript storage. */
export function createSpeechSession(language: VoiceLanguage, callbacks: {
  onListening(): void;
  onTranscript(transcript: string): void;
  onError(message: string): void;
  onEnd(): void;
}): SpeechSession | null {
  const Constructor = recognitionConstructor();
  if (!Constructor) return null;
  const recognition = new Constructor();
  recognition.lang = RECOGNITION_LOCALES[language];
  recognition.continuous = false;
  recognition.interimResults = false;
  let active = true;
  let received = false;
  let failed = false;
  recognition.onstart = () => { if (active) callbacks.onListening(); };
  recognition.onresult = (event) => {
    if (!active || received) return;
    const result = Array.from(event.results).find((item) => item.isFinal);
    const transcript = result?.[0].transcript.trim().slice(0, 500);
    if (!transcript) return;
    received = true;
    callbacks.onTranscript(transcript);
  };
  recognition.onerror = (event) => {
    if (!active) return;
    failed = true;
    active = false;
    callbacks.onError(recognitionError(event.error));
    callbacks.onEnd();
    recognition.abort();
  };
  recognition.onend = () => {
    if (!active) return;
    active = false;
    if (!received && !failed) callbacks.onError("No question captured. Try again or type below.");
    callbacks.onEnd();
  };
  return {
    start() {
      try { recognition.start(); } catch {
        active = false;
        callbacks.onError(recognitionError("unavailable"));
        callbacks.onEnd();
      }
    },
    stop() { if (active) recognition.stop(); },
    cancel() {
      active = false;
      recognition.abort();
    },
  };
}

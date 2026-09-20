import assert from "node:assert/strict";
import test from "node:test";
import { createSpeechSession, recognitionConstructor, RECOGNITION_LOCALES } from "../apps/web/lib/speech-recognition.ts";
import { decodeAudio, VOICE_PROMPTS } from "../apps/web/lib/voice.ts";

function setup(t, locale = "en") {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  let instance;
  class FakeRecognition {
    constructor() { instance = this; }
    start() { this.onstart?.(); }
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
  }
  globalThis.window = { webkitSpeechRecognition: FakeRecognition };
  const events = [];
  const session = createSpeechSession(locale, {
    onListening: () => events.push("listening"),
    onTranscript: (text) => events.push(text),
    onError: (message) => events.push(message),
    onEnd: () => events.push("ended"),
  });
  return { session, events, get recognition() { return instance; } };
}

test("unsupported browser and server rendering are safe", (t) => {
  const previous = globalThis.window;
  t.after(() => { globalThis.window = previous; });
  delete globalThis.window;
  assert.equal(recognitionConstructor(), undefined);
  globalThis.window = {};
  assert.equal(createSpeechSession("en", {}), null);
});

for (const [language, locale] of Object.entries(RECOGNITION_LOCALES)) {
  test(`${language}: one utterance, final transcript only, no duplicate submission`, (t) => {
    const { session, recognition, events } = setup(t, language);
    assert.equal(recognition.lang, locale);
    assert.equal(recognition.continuous, false);
    assert.equal(recognition.interimResults, false);
    session.start();
    recognition.onresult({ results: [{ isFinal: false, 0: { transcript: "ignored" } }] });
    assert.deepEqual(events, ["listening"]);
    recognition.onresult({ results: [{ isFinal: true, 0: { transcript: " Why did my runway go down? " } }] });
    recognition.onresult({ results: [{ isFinal: true, 0: { transcript: "duplicate" } }] });
    session.stop();
    assert.deepEqual(events, ["listening", "Why did my runway go down?", "ended"]);
  });
}

test("cancel ignores late transcript and error events", (t) => {
  const { session, recognition, events } = setup(t);
  session.start();
  session.cancel();
  recognition.onresult({ results: [{ isFinal: true, 0: { transcript: "late" } }] });
  recognition.onerror({ error: "aborted" });
  assert.deepEqual(events, ["listening"]);
});

test("permission denial remains recoverable and does not submit", (t) => {
  const { session, recognition, events } = setup(t);
  session.start();
  recognition.onerror({ error: "not-allowed" });
  recognition.onend();
  assert.match(events[1], /permission was denied/);
  assert.equal(events.at(-1), "ended");
  const retry = setup(t);
  retry.session.start();
  assert.deepEqual(retry.events, ["listening"]);
});

test("no speech and synchronous start failures have recoverable messages", (t) => {
  const first = setup(t);
  first.session.start();
  first.session.stop();
  assert.match(first.events[1], /No question captured/);
  const second = setup(t);
  second.recognition.start = () => { throw new Error("denied"); };
  second.session.start();
  assert.match(second.events[0], /unavailable/);
  assert.equal(second.events[1], "ended");
});

test("existing chips and MP3 decoding remain available", () => {
  assert.equal(VOICE_PROMPTS.length, 5);
  assert.deepEqual(VOICE_PROMPTS.map((p) => p.request.focus), ["summary", "runway", "changes", "biggest_risk", "scenario"]);
  assert.equal(decodeAudio("SUQzdGVzdA==", "audio/mpeg").type, "audio/mpeg");
  assert.throws(() => decodeAudio("invalid", "audio/mpeg"));
});

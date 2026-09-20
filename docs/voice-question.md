# One-turn Voice Q&A

`POST /api/voice/question` accepts only `{question, language}`. The question is
nonblank and limited to 500 characters. No browser-supplied financial context is
accepted. The server snapshots financial state and signals under the repository
lock; the request neither calculates nor changes financial state.

The existing NVIDIA/OpenRouter settings (`RUNWAY_SIGNAL_PROVIDER`, `NVIDIA_*`)
control question interpretation. No new credentials or provider configuration
are required. The request is one non-streaming completion with no history,
memory, tools, or actions.

## Grounding boundary

Nemotron interprets the question and selects a complete answer from a catalog of
server-rendered verified statements. It must return the exact selected text and
signal IDs. This is intentionally more conservative than unrestricted generated
prose: numeric allowlists alone would accept swapped cash/inflow amounts,
unsupported causal claims, and spelled-out invented amounts.

Validation checks the structured schema, bounded nonempty text, selected answer,
exact ordered numeric tokens, exact complete text, and exact linked signal IDs.
Only the accepted catalog answer reaches speech synthesis. Invalid output falls
back to conservative deterministic intent matching. Unknown questions receive a
localized scope response; hypothetical questions direct the user to Scenarios.
The existing scenario chip still uses the original deterministic briefing route.

Supplier answers distinguish validated source facts, stored deterministic
calculation explanations, and incorporated forecast expenses. Metro Foods is
explicitly described as a baseline effect, never a new adjustment. No financial,
forecast, scenario, extraction, upload, or provenance code is changed.

`answer_provider` describes Nemotron/fixture/fallback, while the existing
`provider` field describes ElevenLabs/fixture/fallback. `grounding` distinguishes
validated live selection from deterministic fallback. Speech uses the existing
`ElevenLabsVoiceProvider`, model configuration, MP3 representation, and player.
Speech failure leaves the answer intact.

## Browser interaction

The typed abstraction feature-detects `SpeechRecognition` then
`webkitSpeechRecognition`. It sets `continuous=false`, `interimResults=false`,
and submits at most one final transcript. The central control starts recognition
or stops the current utterance. Cancel ignores late callbacks. Unmount cancels
recognition and invalidates pending answer delivery.

The input remains editable, including while a request is processing, for a
corrected subsequent submission. Only the latest question/answer is displayed.
Existing chips retain their briefing route and remain available without speech
support. The audio player retains replay/pause controls; the central button asks
a new question.

Recognition locales: English `en-US`, Spanish `es-ES`, French `fr-FR`, Hindi
`hi-IN`, Arabic `ar-SA`. Answer selection uses existing reviewed multilingual
briefing templates. Specialized supplier explanations currently have reviewed
English templates only; other languages return the localized scope response
rather than accept unverified translations. Offline intent matching is a small
English grammar; live Nemotron can interpret questions in the selected language.

Runway does not capture, persist, or upload raw microphone audio. Native browser
recognition may use the browser vendor's speech service; this is disclosed on
the page. Provider keys and all Nemotron/ElevenLabs calls stay server-side.

## Verification and limits

- Python Q&A tests cover live mock responses, repository context, client-context
  rejection, numbers/causality/signals/schema rejection, provider fallback,
  scope boundaries, speech failures, multilingual facts, FreshFields and reset,
  and Metro Foods baseline behavior.
- Node recognition tests exercise unsupported/server environments, five locales,
  listening, final-only delivery, duplicate prevention, cancellation, permission
  errors, no-speech recovery, and existing chip/audio utilities.
- Private local API smoke test returned current cash and truthful fixture metadata.
- Interactive browser QA was attempted on ports 3107/8107 but the browser tool
  failed to load its request-header policy twice. Actual microphone capture,
  live Nemotron/ElevenLabs, and browser autoplay were not verified in this session.
- Browsers may block automatic playback; the existing audio controls remain.
- Free-form prose generation is deliberately unsupported: Nemotron selects
  verified complete statements, and may conservatively return scope for questions
  outside the bounded answer catalog.

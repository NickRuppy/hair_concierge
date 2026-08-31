# Saved-product planning evidence

2026-08-28, base `2ae521b50cda5a8de0e43b15119646179beff351`.
Question: can historical inventory be preselected without an extra user screen?

- `current-products.png`: actual local `/labs/personal-plan/stage-3` UI, in-memory
  fixture gateway. Selected Conditioner Balance, 3–4×/week, then Add another to
  reveal the existing saved-product card. No account or production data used.
- `prefill.html`: static contextual proposal using the existing ProductCaptureScreen
  hierarchy, controls, layout dimensions and colors. Uses fixture data, system
  fonts and an existing Back control. The small source-label change is proposed;
  buttons are intentionally nonfunctional. Hash links compare two static states.
- `proposed-desktop.png`, `proposed-mobile.png`: proposal captures at default desktop
  and 390×844 viewport; Codex checked card text wrapping and visible Weiter.
- `unresolved-mobile.png`: saved name in current search/intake, no guessed product;
  Weiter stays disabled until ordinary capture requirements are met.
- `prefill.html#preparation-pending`: static Feinschliff preparation state. It
  keeps the existing header/back affordance and saved status; retry is disabled
  while preparation is running.
- `prefill.html#preparation-error`: static inline retry state for failed product
  preparation. It uses the actual `RefinementFlow` message, states that
  answers remain saved, and offers only `Erneut versuchen` in the same
  module. It has no chapter overview, confirmation screen, or new page. Its
  source basis is `refinement-flow.tsx` `LoadingShell` and
  `refinement-bridge.tsx` / `PersonalPlanChapterTransition` handoff contract.
- `recovery-desktop.png`, `recovery-mobile.png`, `preparation-mobile.png`: Codex
  browser captures of the new static states. Checked one visible state per link,
  selected/unresolved navigation, Back/save context and disabled pending action.
  Mobile viewport 390×844; no persistence or actual retry was exercised.

Selected direction: normal Plan → Routine first; optional refinement shows the
prefilled selections. No migration screen or extra product-identity confirmation.
Nick accepted this conceptual direction and the initial Plan being quiz-only.
Visual evidence review and final whole-journey sign-off were confirmed by Nick
on 2026-08-28, with explicit authorization to start implementation.

The planning captures above are visual only; no persisted import, source
admission, real-user flow or provider behavior is proved by those captures.
All files here are durable planning artifacts to commit with the eventual PR.

To reopen standalone: serve this directory only and open `prefill.html`.

## Implemented capture screen — 2026-08-28

Base `870fc4fbbc95d03e2662b379782be8a7e5c0bc11`, local task port 3752,
`/labs/personal-plan/stage-3?scenario=legacy-prefill`, in-memory fixture only.

- `implemented-prefill-mobile.jpg`: actual imported-product card, saved-name
  search prefill, source label and ordinary enabled Weiter at 390×844.
- `implemented-prefill-fit-mobile.jpg`: Weiter reaches existing fit review;
  ownership is not silently treated as suitability or acceptance.
- Browser interaction also checked Back retains selection and source label;
  removing the selected product leaves the normal search and disables Weiter.

The fixture gateway was extended to support a persisted initial draft and the
same product-ID recapture used by the production UI. Its regression test first
failed, then passed. These captures do not prove hosted persistence, authentication,
provider handling, or the not-yet-integrated optional module host.

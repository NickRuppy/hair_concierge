# Planning preview verification

Verified locally on 2026-08-28 against task base `2ae521b5` and the proposed CSS-only overlay in `motion-preview.tsx`. This is fixture/visual evidence, not production implementation readiness or customer persistence proof.

- Existing production `RefinementFlow` rendered through `Stage2PreviewClient` with in-memory `module-products` fixture.
- Chromium: preview's forward/back controls work; current/proposed switch works; no page errors in this check.
- Chromium and WebKit, widths 375/390/1280, height 844: sampled animation frames used actual `personalPlanScreenEnterForward` and `personalPlanScreenExitForward` keyframes; document width never exceeded viewport width. WebKit's scrollbar reduced client content width by 6px.
- Exactly one portal action on mobile; no mobile portal action on desktop, where the action is inline.
- System reduced motion via browser emulation: no animation on the transition layers when returning to the product question in all six browser/viewport cases.
- Stage-entry replay: a second six-case Chromium/WebKit run at the same widths verified the proposed quiz entry keyframe and no intermediate horizontal overflow after adding the stationary-boundary overlay. This is replay evidence; actual route/local-stage integration remains an implementation check.
- Prototype typecheck and scoped ESLint passed. Production ready-check and regression suite have not run because implementation is not started.

## Finding incorporated during planning

The first overlay removed the transition root's clipping. Settled width looked correct, but a frame sample measured 398px document width inside a 390px viewport. The revised overlay retains the existing `overflow-x: clip` boundary and uses only the small fading movement. All six viewport/browser checks above passed after that correction. This changes no navigation or data behavior.

Stage entry exposed the same 398px width through a different cause: the entire clip-bearing element was translated. The proposal now places a stationary boundary outside the animated element. The stage replay and plan were updated, and all six stage-entry viewport/browser checks passed.

## Limits and artifact notes

- The proposed visual motion is 200ms in / 160ms out. The prototype intentionally retains the existing 360ms JS focus/removal timer; production must change and test it as described in the plan.
- This preview demonstrates refinement question motion and a stage-entry replay on its actual content region; Plan/Anwendung and route-arrival implementation checks remain required.
- `motion-demo.webm` records current forward/back followed by the proposed forward/back on the same fixture. It predates the added stage-entry replay control but reflects the final question-transition proposal.
- `current-mobile.png` and `current-frequency-mobile.png` capture the unmodified Labs surface. `comparison.png` captures the proposal with its top-right comparison selector. Static captures do not prove motion timing.
- The app intentionally disallows iframe embedding. The preview uses a single directly rendered surface with a style switcher; no security headers were changed.
- Temporary browser scripts ran through the repository Playwright dependency with external requests blocked in the main verification passes. No test purchase, dev login, seeded customer, or production write was used.

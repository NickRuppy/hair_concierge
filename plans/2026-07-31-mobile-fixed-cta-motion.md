# Mobile fixed CTA motion containment

## Outcome and source context

Restore the intended mobile quiz behavior shown in Nick's 2026-07-31 iPhone Safari screenshot: the existing `Haaranalyse fortsetzen` action remains attached to the usable visual viewport instead of the bottom of the animated analysis card. Preserve the restrained quiz motion added by PR #280 while preventing that motion from changing fixed-position containment.

Live production and local source diagnosis established a red-capable oracle at 390 × 844:

- settled analysis screen: footer bottom `594.22`, visual viewport bottom `827` in WebKit;
- the transformed analysis section also ends at `594.22`;
- suppressing only the section animation changes its computed transform from an identity matrix to `none` and moves the footer to `827`;
- during an ordinary early-proof → goals transition, the active transition layer also temporarily transforms and moves the new fixed footer below the viewport (`927.22` versus WebKit visual bottom `827`).

## Chosen direction

Render the fixed mobile action outside the animated quiz subtree using the repository's established `createPortal(..., document.body)` overlay pattern, while keeping a separate inline-only desktop action in its existing layout position. Mobile and short-height layouts show only the portaled action; regular desktop layouts show only the inline action.

`MobileBottomAction` owns both copies internally so all five call sites stay unchanged:

- the inline copy receives the existing `className` and is visible only for `min-width: 640px AND min-height: 701px`, preserving each screen's grid/order placement;
- the portaled copy is visible for the exact inverse (`max-width: 639px OR max-height: 700px`) and is hidden otherwise with `display: none`, keeping it out of the accessibility tree and tab order;
- a hydration-safe client snapshot gates `createPortal` without threading quiz state through every call site. A restored mobile screen may omit the action for the first client frame, after which the portaled action appears in its final viewport position without a wrong-position flash.

This fixes both confirmed manifestations of the same containing-block defect:

1. the persistent identity transform retained by `personal-plan-analysis-settle`;
2. the 200 ms transform on the shared active screen-transition layer, which can temporarily move any fixed quiz action below or into the content.

Do not remove the approved content motion or special-case Safari. A portal makes fixed positioning independent of present and future transforms in the screen content.

## Scope and non-goals

In scope:

- `MobileBottomAction` ownership and mobile/desktop rendering containment;
- stable identification of the mobile action for browser geometry checks;
- WebKit and Chromium regression coverage for the settled analysis screen and an in-flight transition;
- a brief repository-wide audit of fixed/sticky surfaces against transform-retaining ancestors.

Non-goals:

- changing button copy, size, color, safe-area spacing, z-index, or click behavior;
- changing quiz order, answers, draft behavior, analytics, or browser-history behavior;
- redesigning the motion system or removing the analysis/transition animations;
- opportunistically portaling unrelated fixed components without a reproduced defect.

## Target map

- `src/components/personal-plan-quiz/personal-plan-quiz.tsx`
  - keep regular desktop action placement inline;
  - portal the fixed mobile/short-height action to `document.body` after client readiness;
  - expose a stable action-container attribute for the browser oracle.
- `tests/mobile-ux.spec.ts`
  - keep the existing shared motion/overlap assertions as surrounding regression coverage.
- `tests/personal-plan-mobile-action.spec.ts`
  - add direct-draft geometry tests without the Supabase imports or user setup in `mobile-ux.spec.ts`;
  - cover settled and transition-in-progress positioning at the existing mobile viewport matrix.
- `playwright.config.ts`
  - retain the existing Chromium project;
  - add a WebKit project scoped only to `personal-plan-mobile-action.spec.ts`, avoiding a second-engine run of the entire browser suite.
- `plans/mockups/2026-07-31-mobile-fixed-cta-motion.html`
  - durable current/target comparison using live WebKit captures.
- `plans/mockups/2026-07-31-mobile-fixed-cta-before.webp`
- `plans/mockups/2026-07-31-mobile-fixed-cta-target.webp`

## Designed user journey

1. A visitor reaches any personal-plan quiz screen with a bottom action on an iPhone or another mobile/short-height viewport.
2. The action is visible at the bottom of the usable browser viewport, above the safe-area/browser controls, with the current label and styling.
3. When the visitor advances or returns, the question content keeps the approved directional motion while the bottom action stays in the same viewport position; it does not jump into the card or disappear below the viewport.
4. On the analysis bridge, the portrait/content keeps its one-time settle animation and `Haaranalyse fortsetzen` remains fixed at the viewport bottom throughout and after that animation.
5. Tapping the action performs the current transition exactly once. Back navigation and reduced-motion behavior remain unchanged.
6. On a regular desktop viewport, the action stays in its existing inline card/layout position rather than becoming a viewport overlay.

There are no new loading, empty, error, consent, or recovery states. The existing safe-area fallback remains the browser-level recovery for variable mobile browser chrome.

User-journey sign-off: **confirmed by Nick on 2026-07-31**. Nick confirmed the target and asked that this simple restoration not require another confirmation.

## Mockup evidence

- Selected current/target comparison: `plans/mockups/2026-07-31-mobile-fixed-cta-motion.html`
- Production WebKit source captures: `plans/mockups/2026-07-31-mobile-fixed-cta-before.webp` and `plans/mockups/2026-07-31-mobile-fixed-cta-target.webp`
- Selected direction: existing CTA fixed to the usable mobile viewport; no visual or copy redesign.
- Mockup review: **confirmed by Nick on 2026-07-31** with no requested visual changes.

## Same-pattern product audit

The audit separates confirmed defects from structurally safe surfaces:

- **Confirmed, same PR #280:** every `MobileBottomAction` is nested under `PersonalPlanScreenTransition`; during its 200 ms transform the action can be re-contained and move out of the viewport. The proposed portal fixes all of these actions, not only the analysis bridge.
- **Confirmed, same PR #280:** `personal-plan-analysis-settle` retains an identity transform around the analysis bridge and its action. The portal fixes the stable screenshot defect without removing the motion.
- **No matching fixed-descendant defect found in the other PR #280 motion targets:** option checks, progress dots, profile rows, pricing cards/content, sticky-offer CTA content, and FAQ items do not contain fixed descendants.
- **Existing fixed overlays reviewed:** shared dialog, sheet, bottom-sheet, chat product popover, and toast surfaces already portal to `document.body`; cookie consent and offer headers are top-level fixed/sticky surfaces without a transform-retaining ancestor in their rendered ownership path.
- **Separate bounded candidate:** `CommitmentOverlay` is fixed inside the quiz transition subtree, but its normal timed appearance happens after the 200 ms screen transition has completed. Keep it unchanged unless the browser guard or a direct repro shows an overlap state.

## Ordered tasks

1. Add a failing settled-screen browser oracle for the analysis bridge.
   - Put it in a standalone spec with no Supabase import or user setup.
   - Assert the mobile action container is outside the transition root and its lower edge equals `visualViewport.offsetTop + visualViewport.height` after the 440 ms content settle; do not freeze engine-specific pixel values.
   - Run in Chromium and a WebKit project scoped to this spec at 375 × 667 and 390 × 844.
   - Complete when the test fails on untouched `origin/main` with the measured containment mismatch.
2. Add a failing in-transition browser oracle.
   - Enter a multi-select screen with an action from an earlier screen and capture geometry while the outgoing layer exists.
   - Complete when untouched `origin/main` proves the action is outside the visual viewport or inside the transformed transition subtree.
3. Portal the mobile action and retain the desktop inline action.
   - Reuse a local hydration-safe client snapshot and `createPortal(..., document.body)`.
   - Render both copies inside `MobileBottomAction`: the inline copy keeps the supplied call-site `className`, while the portal copy uses the exact inverse breakpoint and does not inherit grid/order placement.
   - Use `display: none` for the off-mode copy so only one action is visible, actionable, and exposed to accessibility APIs.
   - Complete when both focused browser oracles pass without changing action copy or event ownership.
4. Re-run the same-pattern audit against the final tree.
   - Confirm the portal breaks both confirmed containing-block paths and that no unrelated fixed surface changed.
   - Complete when findings above remain accurate or the plan is updated with evidence.
5. Run repository readiness and review gates.
   - Use `ready-check`, then `request-code-review`, including the required read-only counterpart whole-branch review.
   - Complete when no supported blocking finding remains and receipts share the same fingerprint.

## Verification

Automated:

- focused Playwright Chromium and WebKit geometry tests;
- existing `@ci personal-plan quiz motion` overlap test;
- relevant Node/static personal-plan quiz tests;
- `npm run test:node` if focused verification passes;
- `npm run ci:verify`.

Manual/browser:

- 375 × 667 and 390 × 844 analysis bridge after motion settles;
- the same view during forward transition;
- reduced motion;
- regular desktop inline action placement;
- no horizontal overflow, duplicate accessible action, or console error.

Live state:

- no production write or deployment is authorized;
- production was used only as the read-only failing reference.

Final local verification:

- the pre-fix Chromium/WebKit browser oracle failed because the visible mobile action remained inside the animated transition root;
- focused mobile action geometry: 10/10 passed in Chromium and WebKit at 375 × 667 and 390 × 844, including the settled analysis screen, an in-flight transition, regular desktop placement, and single-visible-action checks;
- existing personal-plan motion browser coverage: 1/1 passed;
- relevant personal-plan Node/static coverage: 28/28 passed;
- full `npm run test:node`: passed;
- full `npm run ci:verify`: passed (typecheck, lint with four pre-existing warnings, and production build);
- `git diff --check` and focused Prettier checks: passed.

## Review and handoff

- Branch: `codex/mobile-fixed-cta-motion`
- Worktree: `.worktrees/mobile-fixed-cta-motion`
- Mockup review: confirmed
- Designed-journey sign-off: confirmed
- Counterpart plan review: complete; accepted/rejected findings are recorded below.
- Artifacts: plan and three mockup files are intended to commit; transient screenshots and review output are discarded.
- Stop point: verified local review-ready branch before commit, push, PR, deployment, or production writes.

## Counterpart review findings

| ID  | Type           | Evidence                                                                                                                                   | Decision                              | Plan change                                                                                                                     | Revalidation                                        |
| --- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| C1  | scope tradeoff | Ending the analysis keyframe at `transform: none` fixes only the settled screenshot; the measured 200 ms shared-transition defect remains. | rejected CSS-only; retain full portal | Chosen direction explicitly covers both confirmed manifestations.                                                               | Settled and in-transition browser oracles.          |
| C2  | defect         | The current Playwright config has no WebKit project, so a persisted WebKit oracle cannot run as planned.                                   | accepted                              | Add a WebKit project scoped only to the new spec.                                                                               | List/run both focused projects.                     |
| C3  | defect         | Six call sites have different desktop grid/order contracts, including a supplied `className`.                                              | accepted                              | Two copies stay internal to `MobileBottomAction`; the inline copy preserves call-site classes.                                  | Desktop layout and single-accessible-action checks. |
| C4  | defect         | `mobile-ux.spec.ts` throws at import without Supabase credentials although the geometry oracle needs no database.                          | accepted                              | Use a standalone spec without Supabase imports.                                                                                 | Focused test runs without service-role setup.       |
| C5  | defect         | "After client readiness" did not name a mechanism.                                                                                         | accepted                              | Use the repository's hydration-safe client snapshot pattern and record the possible one-frame absence on restored mobile state. | Reload/restored-draft browser check.                |
| C6  | process        | Reviewer suggested replacing `ready-check`/`request-code-review` because they are not npm scripts.                                         | rejected                              | Repo `AGENTS.md` and available personal skills explicitly require these workflow gates; they are skills, not package scripts.   | Run the mandated gates on the final tree.           |

Counterpart plan review: **complete**. No retained repository review artifact; the transient report stays outside the worktree.

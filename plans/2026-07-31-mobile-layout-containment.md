# Mobile layout containment for QuizFlow, offer checkout, and public headings

## Outcome and source context

Eliminate the three reproducible horizontal-clipping failures from the 2026-07-30/31 mobile audit across the supported 320-390 px mobile matrix while keeping the current journey, German copy, checkout behavior, analytics, and established layouts at 375 px and above unchanged.

Source evidence:

- Nick's iPhone screenshot showing the QuizFlow header label `Ergebnis` cut off at the right edge.
- Browser audit against production and fresh `origin/main` at 320, 360, 375, and 390 CSS px.
- Reproduced failures:
  - QuizFlow final-section header label at 320 and 390 px.
  - Full offer payment stack at 320 px and slight clipping at 360 px.
  - Long headings on `/agb`, `/datenschutz`, and `/methodik` at 320 px.

## Chosen direction

Use narrow, component-local containment:

1. Give the QuizFlow header symmetric 72 px side rails around a flexible centered logo and prevent the current-section label from wrapping or clipping. `Ergebnis` is the widest fixed section label; 72 px leaves visible slack beyond its measured width while the remaining 144 px center column still fits the wordmark at the 320 px viewport with the existing 16 px page insets.
2. Allow the offer payment scroll surface, payment grid, and card to shrink below their content's intrinsic width; allow the legally required submit-label text to wrap within the button at very narrow widths.
3. Add an explicit under-360-px title size and `break-words` wrapping on the three affected editorial pages, returning to the existing title sizes from 360 px upward. This avoids inserted mid-word hyphens in legal headings.

This is preferred over a global overflow rule because hiding overflow would mask defects, and over a broad typography refactor because the audit found only three isolated heading failures.

## Scope and non-goals

In scope:

- QuizFlow sticky header at all quiz stages, including loading and result-email states.
- Offer checkout bottom sheet with Apple Pay, PayPal, card/payment element, dividers, error/loading states, and submit CTA.
- `/agb`, `/datenschutz`, and `/methodik` page headings below 360 px.
- Automated layout-contract coverage and browser verification at 320, 360, 375, and 390 px.
- 320 px is a supported target, not best-effort.

Non-goals:

- No navigation, copy, pricing, payment-provider, analytics, auth, persistence, or checkout-state changes.
- No global `overflow-x: hidden` or global heading rule.
- No signed-in app audit or redesign.
- No change to desktop, tablet, or established 375/390-px visual hierarchy beyond the QuizFlow label becoming fully visible.

## Target map

- `src/components/personal-plan-quiz/personal-plan-quiz.tsx`
  - Replace the mobile flex row's 40 px label slot with symmetric 72 px side rails. The defect is the label content exceeding its fixed slot; the desktop-only `sm:` rail sizes are not the mobile cause.
- `src/components/checkout/offer-payment-overlay.tsx`
  - Make the scroll surface an explicit shrinkable width boundary.
- `src/components/checkout/stripe-offer-elements-checkout.tsx`
  - Make the root/payment card grids shrinkable and the CTA label safely wrap.
- `src/app/agb/page.tsx`
- `src/app/datenschutz/page.tsx`
- `src/app/methodik/page.tsx`
  - Add a narrow-viewport title step and `break-words` wrapping.
- `tests/mobile-ux.spec.ts`
  - Add CI-gated real `/lp/haarplan`, `/agb`, `/datenschutz`, and `/methodik` 320/360/375/390 px containment measurements.
- `tests/offer-payment-overlay.spec.ts`
  - Extend the existing `/labs/offer-page?variant=payment-overlay` fixture with 320/360/375/390 px containment measurements for payment states.
- `.github/workflows/ci.yml`
  - Enable the personal-plan QuizFlow during the existing Playwright smoke job so the CI-tagged completion-header regression can execute.
- Existing `tests/personal-plan-quiz.test.ts`, `tests/offer-payment-overlay.test.tsx`, `tests/stripe-offer-elements-checkout.test.tsx`, and `tests/editorial-pages.test.tsx`
  - Re-run as behavior/copy guards only; they do not have a layout engine and will not be used as overflow oracles.

## Designed user journey

Actor: a mobile visitor on a 320-390 px CSS viewport.

Entry and visible flow:

1. The visitor moves through the personal-plan quiz.
2. On every quiz stage, the back button stays fully tappable, the `chaarlie` wordmark remains geometrically centered, and the current section label remains entirely visible inside the right padding.
3. On the loading and email/result states, the same header geometry persists; there is no jump when the label changes to `Ergebnis`.
4. The visitor opens the offer payment sheet.
5. Apple Pay, PayPal, the `oder` divider, card/payment element, errors, and the payment CTA each stay within the sheet's horizontal padding.
6. At 320 px only, the payment CTA may use two centered lines rather than extending beyond the viewport. Its wording, enabled/disabled state, and action do not change.
7. The visitor can close/reopen the sheet or recover from payment loading/errors exactly as before; the layout stays contained throughout.
8. If the visitor opens `/agb`, `/datenschutz`, or `/methodik` at 320 px, every heading wraps inside the content column. At 360 px and above, the current heading sizes return.
9. Completion is unchanged: the quiz reaches its current result/offer state, successful payment follows the current provider flow, and informational pages remain read-only.

Meaningful variants and recovery:

- Back button hidden on the first quiz screen still reserves its symmetric rail, so the centered logo does not move.
- Wallet available, pending, failed, or unavailable states all share the same width boundary.
- Payment errors and retry controls remain within the same contained grid.
- Dynamic Type/zoom is not redefined by this change; ordinary text wrapping remains available rather than being clipped.

## Mockup evidence

- Selected direction: [annotated current/proposed mobile mockup](./mockups/2026-07-31-mobile-layout-containment.html)
- The artifact covers the reproduced 320-px QuizFlow header, full offer payment stack, and long public-page headings.
- Feedback incorporated: the audit request prioritizes anything cut off or overlapping, especially QuizFlow and offer; the solution keeps existing styling and changes only containment.
- Mockup review: **confirmed by Nick on 2026-07-31**.
- User-journey sign-off: **confirmed by Nick on 2026-07-31**.

## Ordered tasks

1. Extend the two existing Playwright seams with focused `scrollWidth <= clientWidth`, element-box, and viewport-matrix checks; seed the personal-plan quiz's existing draft storage to reach completion/loading states without changing application code.
   - Complete when the browser assertions fail against the current implementation for the identified defects at 320/360 px. Do not add circular class-string tests for the CSS fix.
2. Implement symmetric QuizFlow header rails without changing section/progress semantics.
   - Complete when the label, logo, and back control fit at 320 px and existing quiz tests pass.
3. Implement shrinkable offer-checkout width boundaries and override the shared Button base's `whitespace-nowrap` locally with `whitespace-normal` on this CTA.
   - Complete when every payment variant has `scrollWidth <= clientWidth` at 320/360/375/390 px and checkout behavior tests pass.
4. Implement narrow-only editorial title sizing/wrapping on `/agb`, `/datenschutz`, and `/methodik`.
   - Complete when headings remain inside their content boxes at 320 px and retain current computed sizes from 360 px.
5. Run the scoped responsive/browser audit and repository gates.
   - Complete when the acceptance matrix is captured for `/lp/haarplan`, the offer lab payment sheet, `/agb`, `/datenschutz`, and `/methodik`, and the required review gates return no unresolved blocker.

## Verification

Automated:

- Existing unit/component behavior tests for QuizFlow and offer-payment overlay.
- Existing editorial-page rendering/copy assertions.
- Lint/typecheck for changed files or repository equivalents.
- Real-browser layout regressions in `tests/mobile-ux.spec.ts` and `tests/offer-payment-overlay.spec.ts`.
- Required setup and exact focused command:
  - terminal 1: `PERSONAL_PLAN_QUIZ_V1_ENABLED=true npm run dev -- --hostname 127.0.0.1 --port 3107`
  - terminal 2: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npx playwright test tests/mobile-ux.spec.ts tests/offer-payment-overlay.spec.ts --grep "personal-plan completion header|headings are contained|payment content stays contained"`
  - prerequisite: the worktree's copied `.env.local` must contain the Supabase values required by the existing Playwright configuration.

Manual/browser:

- Viewports: 320x568, 360x800, 375x812, and 390x844.
- QuizFlow: first screen, representative middle screen, `daily_time`, loading, and result-email states.
- Offer via `/labs/offer-page?variant=payment-overlay`: wallet pending, Apple Pay ready/unavailable, PayPal visible, card visible, validation error, retry/error, confirmation, and CTA.
- Pages: `/agb`, `/datenschutz`, `/methodik`.
- For each state, confirm:
  - document and relevant container `scrollWidth <= clientWidth`;
  - no visible clipping at either horizontal edge;
  - controls remain tappable and focus-visible;
  - no 375/390-px regression versus the reviewed design.

Live-state/migration:

- No migration or production write.
- Provider behavior is exercised only through local fixtures/mocks; no real payment is submitted.

Evidence-sensitive review:

- Verify legal CTA wording remains byte-for-byte unchanged.
- Verify existing German page copy remains unchanged.

## Review and handoff

- Planning/implementation worktree: `.worktrees/mobile-layout-containment`
- Branch: `codex/mobile-layout-containment`; publication target is current `origin/main` (`fbc0c69c`), with the final receipt verifying the byte-identical rebase before push.
- Required gates after implementation: `implementation-loop` invokes `ready-check` and `request-code-review`; one read-only Claude whole-branch review is required before any push if the change remains meaningful.
- Rollout risk: CSS containment can differ inside Stripe-rendered cross-origin content; outer-grid verification must use the existing offer lab's rendered wallet/payment-element fixtures, not only static class assertions.
- Mockup-review status: **confirmed on 2026-07-31**.
- User-journey sign-off status: **confirmed on 2026-07-31**.
- Authorized stop point: commit, push, and draft PR only. No merge, deployment, production payment, or worktree cleanup.

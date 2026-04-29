# Mobile UX Optimization Plan

Date: 2026-04-28
Branch: `codex/mobile-ux-optimization`
Scope: mobile UX audit and implementation plan for the current Hair Concierge app, based on source review plus Playwright mobile checks at 375x667 and 390x844.

## Audit Summary

The app is not starting from zero on mobile. The quiz and onboarding use mobile-first cards, `100dvh`, touch-sized primary actions, mobile-only navigation, and safe-area padding in the chat input. The biggest mobile risks are inconsistent behavior across flows and dense desktop-derived surfaces rather than a missing responsive baseline.

Observed journeys:

- Public unauthenticated routes `/`, `/chat`, `/profile`, and `/onboarding` redirect to `/quiz`.
- Full quiz journey through result was tested on iPhone SE and iPhone 13 viewports with quiz lead/analyze APIs intercepted.
- Authenticated `/chat` and `/profile` were tested with a temporary Supabase user, seeded active subscription/profile data, mocked chat stream, and cleanup after the run.

Top issues:

1. Quiz step transitions preserve the old inner scroll-pane position. After selecting lower concern cards, the goals step opens mid-page with the heading and progress above the viewport. The fix must target the quiz layout scroll containers, not only `window`.
2. Chat content can be cut off because flex children keep their default `min-width: auto`. The page may not show document-level horizontal overflow because the message pane clips it, but the visible symptom is a pushed-offscreen send button or clipped product cards after long prompts.
3. Profile is technically responsive but too long and heavy for mobile. The measured 4,828px seeded complete profile is on top of the just-merged Profile Editorial v3 refactor (`588126f`, PR #51), so any profile work must preserve v3 intent and should not be bundled into the first mobile bugfix slice.
4. The empty chat screen underuses the first viewport on small phones. Only one starter prompt is visible above the input on iPhone SE.
5. Several secondary tap targets are under 44px high, especially feedback icons, consent secondary action, footer links, and small text links.
6. Some authenticated UI copy still uses ASCII fallbacks (`zurueck`, `ungueltig`, `moeglich`). These are real German-correctness bugs, but they are not mobile-specific and should be split into a tiny separate PR.

## Branch Hygiene

Before implementation or push:

1. Run `git fetch origin`.
2. Rebase or recreate the worktree from `origin/main`.
3. Confirm `git diff --stat origin/main...HEAD` only contains the intended mobile UX files.
4. Keep the root checkout's unrelated backend work untouched.

Current note: this planning worktree is based on `origin/main` and currently only adds this plan file. The hygiene step remains mandatory before converting the plan into an implementation branch.

## Options

| Approach | Complexity | Effort | Tradeoffs | Best when... |
|----------|------------|--------|-----------|--------------|
| A: Bugfix Pass | Low | 0.5-1 day | Fixes observed breakage quickly; does not improve first-viewport polish or profile density. | We need fast stabilization before continuing backend work. |
| B: Flow Polish Sprint | Medium | 2-3 days | Fixes quiz/chat bugs, improves quiz/chat first-viewport quality, and adds mobile regression coverage. Profile v3 density is deferred. | We want visible mobile improvement without pausing product logic work. |
| C: Mobile-First Redesign Pass | High | 1-2 weeks | Best long-term UX, but high review risk across quiz, chat, profile, auth, and result. | We are ready to treat mobile as the primary product surface before launch. |

Recommended path: Approach B. It fixes the real blockers first, gives mobile users a much better first impression, and avoids colliding with the very recent Profile Editorial v3 work.

## Implementation Plan

### Phase 1: Mobile Correctness And Viewport Stability

Goal: eliminate observed mobile breakage before visual redesign.

- Add a centralized quiz step-change reset that targets the actual scroll containers.
  - Current trigger points: `src/lib/quiz/store.ts` uses `STEP_ORDER` and `goNext`/`goBack`; quiz screens call those directly.
  - Current scroll container: `src/app/quiz/layout.tsx` uses an inner pane (`w-full overflow-y-auto md:w-1/2`) for steps 1-10/12/14 and a separate result wrapper for step 11.
  - Required implementation shape: give both quiz layout branches a scroll-container ref, listen to `step`, and call `containerRef.current?.scrollTo({ top: 0 })` after step changes. Keep `window.scrollTo({ top: 0 })` only as a fallback.
  - Accessibility requirement: after the scroll reset, move focus to the new step heading with `preventScroll: true`. Add `tabIndex={-1}` to step headings through the shared shell or temporary programmatic focus handling. Do not leave screen-reader context on the previous step's `Weiter` button.
  - Verify specifically: concerns selected near bottom -> Weiter -> goals step starts at progress/header, and the heading is visible in the first 200px of the scroll container.

- Fix chat input flex clipping.
  - Current source: `src/components/chat/chat-input.tsx`.
  - Add `min-w-0` to the input row and textarea, keep the send button visible, and cap textarea height without forcing min-content width.
  - Verification must include a long unbreakable token, not only normal German prose.

- Constrain chat message/product card widths.
  - Current source: `src/components/chat/chat-message.tsx`, `src/components/chat/product-card.tsx`, and the message wrapper in `src/components/chat/chat-container.tsx`.
  - Add `min-w-0`/`w-full` constraints where message content and product cards nest; ensure product cards do not clip price or reason text.
  - Increase feedback tap targets to at least 44x44 while keeping the icons visually quiet.

- Do not spend Phase 1 on decorative radial overflow unless a failing measurement proves it is user-visible.
  - `chat-container.tsx` already clips the message pane with `overflow-x-hidden`; the decorative `w-[120%]` layer should not drive scope.

Verification for Phase 1:

- Playwright mobile scripted journey at 375x667 and 390x844.
- After the quiz reset, assert the scroll container is at top and the active step heading is within the first 200px of the visible pane.
- For chat, assert the send button is visible and fully inside the viewport after typing a long unbreakable token.
- Assert product cards and assistant text are not clipped inside the visible message area.
- Assert key touch targets are at least 44px high except intentionally inline text links.

### Phase 2: Quiz And Result Mobile Polish

Goal: make the quiz feel intentionally mobile-first rather than just responsive. This phase starts only after Phase 1 chooses and implements the scroll-container strategy, because sticky actions depend on that container behavior.

- Keep progress labels user-facing, not raw store-step-facing.
  - Resolved decision: never expose raw `STEP_ORDER` numbers to users. The internal order (`1,2,3,4,5,7,6,8,12,9,10,11,14`) may remain internal.
  - Question screens should continue to show question position over `QUIZ_TOTAL_QUESTIONS`. Non-question states should either show completion/full progress or no progress, never raw step numbers that appear to jump backward.

- Make quiz step headers more compact on small phones.
  - Current source: shared pattern in `src/components/quiz/quiz-question.tsx`, `quiz-scalp-question.tsx`, `quiz-concerns-question.tsx`, and `quiz-goals.tsx`.
  - Extract a light shared question shell only if it reduces repeated progress/back/title/focus/scroll behavior. Do not create a broad design-system abstraction.

- Stabilize primary actions on long quiz steps.
  - Concern and goals steps can exceed one viewport.
  - If sticky bottom actions are used, attach them to the chosen scroll pane and add bottom padding so content is not hidden under the action area.

- Rework the goals step for small phones.
  - Current two-column cards are large.
  - Keep two columns if labels remain readable, but reduce vertical card height and remove redundant `Ziel` labels on every card. Selected state can use icon/check treatment instead.

- Reduce landing-page vertical pressure.
  - Current source: `src/components/quiz/quiz-landing.tsx`.
  - On 375x667, the H1 and bullet stack push the login link to the bottom edge. Shorten the H1 line-height/size slightly on small phones or reduce bullet spacing so CTA, reassurance, and returning-user link breathe.

- Check result cards for mobile scanability.
  - Current source: `src/components/quiz/quiz-results-view.tsx`.
  - The result is visually strong, but each spectrum card is dense. Prefer small spacing and text-density adjustments before introducing expand/collapse behavior.

Verification for Phase 2:

- Complete quiz on iPhone SE without hidden first content, clipped buttons, or inherited scroll.
- Confirm progress copy never exposes raw store-step jumps.
- Confirm result CTA remains visible after a reasonable first scroll and all result labels fit without overlap.

### Phase 3: Chat Mobile Experience

Goal: improve the mobile chat's first-use usefulness and keep conversation reading comfortable.

- Compact the empty chat state.
  - Current source: `src/components/chat/chat-container.tsx`.
  - Reduce top hero height on small screens so at least 2-3 starter prompts are visible above the input on iPhone SE.
  - Consider horizontal prompt chips or a two-row compact prompt list on mobile.

- Make the mobile chat header do more work.
  - Current source: app `Header` plus chat's own mobile header.
  - The app header and chat subheader consume significant vertical space together. Evaluate whether `/chat` should use a more compact combined mobile header.

- Improve product recommendations in chat.
  - Current product cards must fit fully inside the assistant column.
  - If product recommendations are core on mobile, consider a full-width recommendation stack below assistant text rather than inside the 80% bubble column.

- Preserve input ergonomics.
  - Keep safe-area padding.
  - Do not drop mobile input/textarea font size below 16px; `text-base md:text-sm` prevents iOS focus zoom.
  - Ensure send button remains visible for long typed messages and after sending.
  - Confirm textarea does not occlude the latest assistant response.

- Add live-state accessibility where chat updates are asynchronous.
  - Ensure streaming/loading indicators use an appropriate `aria-live`/status pattern so mobile screen-reader users know a response is in progress.

Verification for Phase 3:

- Mobile chat with empty state, long user prompt, assistant paragraph, two product cards, feedback controls, and sidebar.
- Manual visual review at 375x667 and 390x844.
- Automated send-button bounds and card-clipping assertions, not only document `scrollWidth`.

### Phase 4: Profile Editorial v3 Mobile Density Follow-Up

Status: defer from Approach B unless separately approved after Tom Review.

Goal: make `/profile` more usable on mobile without undoing the just-shipped Profile Editorial v3 hierarchy.

Context:

- Profile Editorial v3 was just merged in `588126f` / PR #51.
- `src/app/profile/page.tsx` is large and sensitive; a restructure is not a 2-3 day mobile polish add-on.
- Existing visual reference: `docs/mockups/profile-editorial-v3-applied.html`.

Recommended direction for the follow-up:

- Treat this as a v3 mobile-density pass, not a redesign.
- Preserve v3 typography, section hierarchy, and editorial intent.
- Use a compact dashboard of section status rows at the top, then keep v3 detail sections behind mobile accordions. Avoid bottom-sheet editing as the first version unless Tom Review specifically wants it.
- Keep direct editing, but place edit controls inside the relevant expanded section.

Required decision before implementation:

- Confirm the profile pattern: compact dashboard plus mobile accordions is the recommended default. If Tom Review chooses detail pages or bottom-sheet editing instead, write a separate profile-specific plan and effort estimate.

Verification for the follow-up:

- Capture baseline heights for both a seeded complete profile and a partial/new-user profile before changing anything.
- Seeded complete profile at iPhone SE should show profile title plus multiple section statuses in the first viewport.
- Full profile height should drop materially from the current roughly 4,828px seeded complete-profile run without losing access to v3 details.
- Editing routes from product, goals, and quiz fields still land on the correct screens and return to profile.

### Phase 5: Shared Mobile QA Harness

Goal: keep the mobile work from regressing while backend logic evolves.

- Add a focused Playwright mobile smoke spec.
  - Existing `playwright.config.ts` currently uses a single chromium desktop-like project and `trace: "on-first-retry"`; add explicit mobile viewports/devices for this focused spec rather than assuming screenshots are already configured.
  - Public path: quiz landing -> several steps -> long concern selection -> goals transition.
  - Authenticated path: seeded ready user -> chat empty -> mocked chat response -> profile first viewport.

- Add utility assertions:
  - Quiz active scroll container resets and heading lands within the first 200px.
  - Chat send button remains fully in viewport after a long unbreakable token.
  - Product recommendation cards are not clipped.
  - Visible action buttons are at least 44px high where they are standalone controls.

- Save screenshots on failure or targeted local audit runs; do not add noisy always-on screenshot artifacts to CI.

## File Map

- Quiz shell and flow: `src/app/quiz/layout.tsx`, `src/lib/quiz/store.ts`, `src/components/quiz/*`
- Quiz result: `src/components/quiz/quiz-results-view.tsx`
- Chat layout: `src/components/chat/chat-container.tsx`
- Chat input: `src/components/chat/chat-input.tsx`
- Chat messages and recommendations: `src/components/chat/chat-message.tsx`, `src/components/chat/product-card.tsx`, `src/components/chat/product-detail-drawer.tsx`
- Profile v3 follow-up: `src/app/profile/page.tsx`, `docs/mockups/profile-editorial-v3-applied.html`
- Header/auth polish: `src/components/layout/header.tsx`, `src/app/auth/page.tsx`, `src/components/auth/auth-form.tsx`
- Tests: new focused mobile Playwright spec under `tests/`

## Non-Goals

- Do not redesign backend recommendation logic in this mobile UX pass.
- Do not change product recommendation rules unless a mobile UI issue exposes missing metadata.
- Do not rebuild the whole design system. Use local patterns and only extract shared shells where they reduce duplication across quiz screens.
- Do not add external UI libraries for mobile behavior.
- Do not bundle ASCII-fallback German copy cleanup into the mobile branch; handle it as a separate small PR.
- Do not restructure Profile Editorial v3 in Approach B; keep that as a follow-up after Tom Review.

## Resolved Decisions

- First implementation path: Approach B without Profile Phase 4.
- Quiz scroll reset must target the inner quiz scroll containers and manage heading focus.
- Chat clipping is a flex shrink/min-width bug; document-level horizontal overflow assertions are insufficient.
- Progress labels must represent user-facing question position, not raw internal store steps.
- Profile work defaults to a v3 mobile-density follow-up using compact dashboard plus accordions, pending Tom Review.

## Recommended First Implementation Slice

Implement Phases 1, 2, 3, and 5. Keep Phase 4 as a separately reviewed v3 follow-up.

1. Add quiz step scroll reset on the actual layout scroll containers, plus heading focus management.
2. Fix chat input and message/product-card flex clipping.
3. Increase feedback and secondary standalone touch targets where they are currently under 44px.
4. Add focused Playwright mobile regression coverage for the exact observed bugs.
5. Make modest quiz/chat first-viewport polish only after the correctness fixes are green.

This is the smallest slice that removes observed broken states and gives us reliable test coverage before larger profile/result design work.

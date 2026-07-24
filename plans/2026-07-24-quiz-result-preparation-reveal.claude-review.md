I have enough grounding. Memory pre-check: skimmed `MEMORY.md`; the relevant entries (`project_offer_page_redesign`, `project_landing_conversion_followups`) don't conflict with this plan — offer-page tracking is explicitly out of scope here. Here is the review.

---

**Verdict:** Approve with revisions — and **do not hand to subagents yet**. Two test-breaking defects and one behavior regression must be resolved, and the plan's own gates (updated mockup review, user-journey sign-off) are still marked _pending_ (plan lines 142, 227–228), so per CLAUDE.md `executing-plans`/`subagent-driven-development` cannot be invoked regardless of the code fixes.

**Lean shape**

- **Irreducible goal:** After consent, keep the user on one stable step-10 surface (no shell switch), do the real prep work there, reveal a single user-clicked button once the destination is known/prefetched, and navigate straight to `/result/[leadId]` — eliminating the step-10→11 shell flicker.
- **Premise verified as real:** `QuizShell` renders step 11 as a full-width `max-w-[960px]` layout with no brand panel (`quiz-shell.tsx:53-61`) versus the two-panel `max-w-[540px]` + `QuizBrandPanel` layout for step 10 (`quiz-shell.tsx:63-82`). The first implementation's `goNext()`→step 11 (`quiz-analysis.tsx:101-106`) therefore does swap the shell. The mockup names this exactly ("Der Quiz-Shell-Wechsel entfällt vollständig"). The shape is right.
- **Cut / narrow:**
  - **Cut the guided-story _preview_ derivation from the preparation screen** (plan line 32, task 2 line 155). Nothing in the loading/ready UI consumes it — only the portrait, three fixed rows, and the CTA render. The result _route_ recomputes the preview server-side from DB answers (`result/[leadId]/page.tsx:120`, `result-client.tsx`), so a client-side derivation cannot be handed off and is discarded. Worse, `buildQuizGuidedStoryPreview` **throws** on unexpected answers (`guided-story-preview.ts:37-42`), so deriving-and-discarding adds a crash surface on the funnel's terminal screen for zero display value. Keep only the portrait derivation (`derivePortraitConfig` → `resolveHairPortraitAsset`).
- **Hard tradeoff the plan is avoiding:** the retake/`returnTo` path. The plan asserts "the result route remains responsible for … the entitled result" (lines 44-45, 119-121) but the result route carries neither `mode=retake` nor `returnTo` (see Blocker 3).

**Prior art**

- **App-Router prefetch** (task 2 line 158): canonical shape is `router.prefetch(href)` / `<Link prefetch>`; both return no completion signal. The plan correctly refuses "a private Next.js completion API" and records the residual risk (lines 231-233). `QuizResultsView` already renders `<Link href>` for its primary action (`quiz-results-view.tsx:42`) — reuse that shape (a `<Link href={resultUrl} prefetch>` button) to get viewport prefetch for free. OK.
- **Funnel-step consolidation** (`quiz_completed`): relocating to one guarded, leadId-keyed effect matches "single idempotent emission." Must reuse a ref guard like the existing `checkoutAnalyticsCapturedRef` (`quiz-results.tsx:76,103-105`) so it fires exactly once. OK.
- **Portrait reuse:** matches `derivePortraitConfig`→`resolveHairPortraitAsset` (`hair-portrait.tsx:191-221`) — but Chapter 1 _composites_ a shared SVG body behind non-`ownBody` assets. The plan's "reuse the asset only" deviates without stating it (see Blocker 4).

**Blockers** (will fail or regress as written)

1. **`editorial-pages.test.tsx:105` breaks and is not in the target map.** It reads `quiz-analysis.tsx` as a string and asserts `assert.match(analysisSource, /Deine Pflegebedürfnisse werden eingeordnet/)` — the current `QUIZ_ANALYSIS_STEPS[1]` copy (`quiz-analysis.tsx:10`). The plan replaces those three rows with new copy (`Deine wichtigsten Haar-Themen werden priorisiert`, etc., plan lines 106-108, mockup 432-440). This unit test then fails and `npm run ci:verify` fails. The target map (lines 68-93) lists no test files by name. **Fix:** add `editorial-pages.test.tsx` to the target map and update line 105's expected string (this is a repeat of the counterpart plan's Blocker #1 — now certain, because the copy definitively changes).

2. **Five E2E test blocks assert the old loading copy _and_ automatic navigation; the plan changes both.** `DEIN PROFIL WIRD ERSTELLT` + no-click auto-nav is asserted in `quiz-result-routing.e2e.spec.ts:58,73`, `stripe-subscription-e2e.spec.ts:43,47`, `auth-intake-routing.e2e.spec.ts:180`, and `quiz-onboarding-e2e.spec.ts:234,252` and `:535,541`. The new design shows `…wir stellen deine Haaranalyse zusammen` / `…deine Haaranalyse ist bereit` and **requires a click** on `Meine Haaranalyse ansehen` (plan journey step 6). Every one of these blocks must be rewritten for the new copy and the reintroduced click. The target map enumerates none of them and task 6 ("ordinary/entitled Playwright flows pass," line 189) is too vague for a subagent to find them. **Fix:** enumerate all six affected specs (these five + `quiz-analysis.test.tsx`) and specify the copy/interaction changes, as the counterpart plan did (its lines 67-72).

3. **Entitled-retake users silently lose their `/profile` return.** Today the client `handleStart` threads `mode=retake`→`returnTo=/profile` onto the onboarding URL (`quiz-results.tsx:80-81,190-206`). The plan navigates directly to `/result/[leadId]?entry=quiz_completion` (dropping `mode`/`returnTo`), and the result route's entitled branch links to `/onboarding?lead=…` with **no** `returnTo` (`result-client.tsx:47-59`; the route only reads `entry`/`focus`, `page.tsx:29`). So an entitled subscriber retaking from `/profile` (`profile/page.tsx:154`) lands on `/chat` after onboarding instead of returning to `/profile`. **This is a real regression the plan does not mention.** Decision for the owner: (a) thread `mode=retake`/`returnTo` through to `/result` and into `result-client`'s onboarding href, or (b) explicitly accept that entitled-retake users no longer return to `/profile`. (Note: the _non-entitled_ retake path is safe — that test already lands on the canonical `/result` route as a pricing/offer view, `quiz-onboarding-e2e.spec.ts:541-548`.)

**High-confidence issues** (correctness, not preference)

4. **Portrait won't "match Chapter 1" for most lengths if only the bare asset is rendered.** Chapter 1 draws `PORTRAIT_SHARED_BODY_PATHS` behind every non-`ownBody` asset (`hair-portrait.tsx:286-302`); only the five `*-very-short` assets embed their own body (`hair-portrait-assets.ts:40-44,65-69,90-94,115`). The plan's "reuse the selected portrait asset only" (task 3 line 164) + the mockup's plain `<img>` (mockup 424-427) will render bodiless hair for all short/medium/long/very-long assets — contradicting the verification "confirm the portrait matches Chapter 1 for … short/long lengths" (lines 207-208). Decide: include the shared SVG body in the preparation portrait, or accept a simplified silhouette and reword the verification.

5. **Missing-lead recovery must gate _before_ the name-dependent copy, and handle empty name.** `restoreDraft` resets both `leadId → null` and `lead → { name: "" }` while keeping `answers` (`store.ts:82-91`). On a reload at step 10 the portrait still resolves (answers survive), but `leadId` is null and `lead.name` is empty. The plan promises recovery for missing lead ID (task 5 line 181, journey step 8) but does not state that the `!leadId` recovery branch must be evaluated _before_ rendering `{Name}, wir stellen…`, nor the empty-name guard the counterpart plan already had to add (`quiz-analysis.tsx:50-51`, tested at `quiz-analysis.test.tsx:79-86`). Without both, a restored state renders a leading-comma heading over an endless animation. Make the ordering + empty-name handling explicit.

**Product / scope decisions for the owner** (not defects)

- **Preview derivation (Lean, above):** confirm no consumer I'm missing; if none, cut it from task 2/journey step 4.
- **Retake `returnTo` (Blocker 3):** thread it through, or accept the drop.
- **Portrait body composition (Issue 4):** composite the body, or simplify + reword.
- **Rollback:** the plan implies revert-only with no kill switch (consistent with the counterpart's C10). Confirm revert-only is acceptable for this terminal funnel step.
- **Copy still un-pinned:** the mockup's loading subtitle ("Wir verbinden deine Angaben zu Haar, Zielen und Problemen", mockup 416-418) is absent from the plan's journey (lines 103-104), and mockup review is "pending Nick's review of the incorporated changes" (line 142). Pin the exact loading/ready copy before implementation.

**Smaller / nice-to-haves**

- Reuse the existing canonical URL shape `/result/${encodeURIComponent(leadId)}?entry=quiz_completion` (`quiz-results.tsx:50`, `result-client.tsx:54`) rather than re-deriving it, to avoid an unencoded-leadId drift.
- The "screenshots match the approved mockup at 320/375/desktop" criterion (task 3 line 169) is misleading: the mockup is a phone frame, but on desktop the preparation screen renders inside the two-panel shell (brand panel + `max-w-[540px]`). State that the desktop target is the real shell, not the mockup's phone chrome.
- Reuse the proven timer scaffolding (`getQuizAnalysisTimeline`/`scheduleQuizAnalysis`, `quiz-analysis.tsx:17-39`) and its fake-timer test style (`quiz-analysis.test.tsx:12-62`) for the minimum-visual-sequence gate, rather than inventing new timing.
- This plan's own `.claude-review.md` sidecar is empty; not load-bearing (the counterpart's review lives in its own table), just noting it.

**Bottom line**
The shape is correct and genuinely lean — keeping the user on step 10 and doing a single user-initiated route navigation is the right way to kill the shell flicker, and the plan reuses the right resolvers. But it will not execute cleanly as written: fix **Blocker 1** (CI fails immediately) and **Blocker 2** (six test files change copy + interaction; target map names none), and get an explicit owner call on **Blocker 3** (entitled-retake `returnTo` regression), **Issue 4** (portrait body), and **Issue 5** (recovery ordering). Cut the unused preview derivation. Then clear the plan's own pending mockup-review and journey sign-off gates before any subagent touches it.

Want me to spec the leaner preparation-screen surface (portrait-only derivation, empty-name/`!leadId` recovery ordering, and the exact test-file change list) so the executor lands it without re-breaking CI?

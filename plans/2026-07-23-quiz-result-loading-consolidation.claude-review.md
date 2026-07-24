I have enough grounding. Here is my review.

---

**Verdict:** Approve with revisions (and not ready to hand to subagents yet — mockup/journey gates are still pending per the plan itself)

## Lean shape

- **Irreducible goal:** After lead capture, show one personalized analysis/loading moment, then open the result automatically — no intermediate CTA and no visibly distinct second spinner.
- **Cut or defer:** Nothing material to cut — the plan is already disciplined. It reuses `resultRedirectRef`/the cancelled access-check effect (`quiz-results.tsx:77,127-159,182-187`), keeps the `analysis` funnel event (C2), rejects new copy (C5), and explicitly refuses a parallel state machine, new flags, and backend jobs. This is the leanest coherent shape.
- **Hard tradeoff the plan is avoiding:** One — see issue #4 (entitled returning user briefly sees "DEIN PROFIL WIRD ERSTELLT" during their access check). The plan folds three loaders into the analysis visual without stating this side effect for the signed-in-entitled path.

## Prior art

- **Auto-advance timer** (Task 1): canonical shape = fire-once guard + cleanup on unmount. Plan names both ("guarded one-shot `goNext`", "clean up timers on unmount") — OK. Note the existing animation already uses a timer array with `clearTimeout` cleanup (`quiz-analysis.tsx:21-27`), so the pattern is proven in-file.
- **Funnel-step consolidation** (C2): matches the canonical "keep the centralised step + its event, change only the visible surface." The `analysis` `quiz_step_viewed` event fires on step-10 view in `page.tsx:57-76`, independent of the CTA — auto-advancing preserves it. OK.
- **No migration / no rollout flag:** acceptable deviation for a pure client-side UI consolidation with no data change. Stated in non-goals. OK.

## Blockers (will fail as written)

1. **Hidden test consumer not in the target map — `tests/editorial-pages.test.tsx:104`.** This test reads `quiz-analysis.tsx` as a string and asserts `assert.match(analysisSource, /Deine Pflegebedürfnisse werden eingeordnet/)`. Task 2 extracts the presentational child (which owns the `steps` array at `quiz-analysis.tsx:7-11`) into a new `QuizAnalysisView` file. If the step copy moves out of `quiz-analysis.tsx`, this content-path assertion breaks and `npm run ci:verify` fails. The plan's target map (lines 65-71) lists four E2E specs but not this unit test. **Fix:** either keep the `steps` constant exported from `quiz-analysis.tsx`, or update the test to read the new file's path.

## High-confidence issues (correctness, not preference)

2. **The "screen remains continuous" claim is not guaranteed by the described mechanism.** Steps 10 and 11 are distinct components in a `switch` (`page.tsx:130-140`); `goNext` unmounts `QuizAnalysis` and mounts `QuizResults`. The shared `QuizAnalysisView` rendered inside `QuizResults` is therefore a **fresh mount** — and the analysis root carries `animate-fade-in-up` (`quiz-analysis.tsx:30`). As written, the user sees the completed analysis re-fade-in (a flash) at exactly the boundary the plan is trying to smooth, before `router.replace` navigates away. The plan trades a distinct spinner for a re-animation flash. **The plan must specify** how continuity is achieved across the remount — e.g. render `QuizAnalysisView` in a completed, no-entry-animation mode when mounted by `QuizResults`. Task 2's completion criterion ("exactly one visual loading surface") does not capture this.

3. **`QuizAnalysisView` needs `lead.name`, which is empty in reload/restore windows.** The analysis heading is `{lead.name.toUpperCase()}, DEIN PROFIL WIRD ERSTELLT` (`quiz-analysis.tsx:32`). `QuizResults` reads `lead` from the store (`quiz-results.tsx:70`); `restoreDraft` resets `lead` to `{ name: "" }` (`store.ts:82-91`). The two spinners being replaced ("Wir prüfen deinen Zugang" / "Dein Ergebnis wird geöffnet") carry no name, so they never had this problem. In the brief `loading` window on a reloaded step-11, the folded analysis view could render a leading-comma `", DEIN PROFIL WIRD ERSTELLT"`. (The `!leadId` recovery branch catches most reload cases first, but the auth-`loading` branch is evaluated before it at `quiz-results.tsx:207-224`.) Handle the empty-name case in the shared view.

## Product / scope decisions for the owner (not defects)

4. **Entitled signed-in returning user sees "DEIN PROFIL WIRD ERSTELLT" during their access check.** Folding the `loading || isCheckingSignedInSubscription` branch (`quiz-results.tsx:208-224`) into the analysis visual means an already-subscribed user re-entering the quiz sees a "your profile is being created" screen while `/api/billing/access` resolves. Journey step 5 says entitled users land on the result + `MEINE ROUTINE STARTEN`, but is silent on the interstitial. **Decision:** is the analysis visual acceptable for the entitled access-check window, or should that path keep a neutral loader? The plan silently chose "show analysis view for everyone."

5. **Auto-advance removes the only user-controlled pause, with no kill switch.** The plan (correctly, per CLAUDE.md's no-speculative-abstractions rule) rejects a feature flag. That's a reasonable call for a pure UI change, but it means the only rollback is a revert. **Decision to confirm:** owner accepts revert-only rollback for this production funnel step.

## Smaller / nice-to-haves

- **"short final-frame dwell" is a fuzzy value** (line 116). Give it a concrete ms so a subagent doesn't invent one; tie it to the existing `STEP_DELAY = 1200` rhythm (`quiz-analysis.tsx:13`) for consistency.
- **Task 1 completion criterion** ("focused tests prove one automatic advance and no update after unmount") requires fake timers over a store-driven component; state that so the executor uses `vi`/`node:test` timer mocking rather than real 3.6s waits. Existing pure-helper tests live in `tests/quiz-result-routing.test.ts` and `tests/quiz-result-artifact-trigger.test.ts` — reuse those files rather than adding new ones for the routing/email gates.
- **`.claude-review.md` sidecar is empty** — the counterpart-review content lives in the plan's own table (lines 172-181), so the empty file is just an unused placeholder, not a missing artifact.

## Bottom line

The shape is right and genuinely lean — it reuses the existing redirect/cancellation guards instead of building a new state machine, and it correctly preserves the `analysis` funnel event. Fix **#1** (or the branch fails CI immediately) and pin down **#2** (the core continuity mechanism, currently asserted but not designed) before any subagent touches it. Resolve **#3** and get an explicit owner call on **#4/#5**. Independently, the plan's own gates (mockup review, user-journey sign-off) are marked _pending_ — per CLAUDE.md, `executing-plans`/`subagent-driven-development` cannot be invoked until those clear, so this is not shippable to subagents today regardless of the code fixes.

Want me to spec the leaner `QuizAnalysisView` extraction (completed/no-re-animate mode + empty-name guard) so Task 2 lands without the continuity flash?

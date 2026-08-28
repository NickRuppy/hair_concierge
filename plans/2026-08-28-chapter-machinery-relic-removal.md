# Old-Flow Chapter Machinery — Audit Result & Gated Removal (2026-08-28)

Follow-up to the 2026-08-27 relic audit, executed after the relic-fix wave (#477) merged.

## Audit verdict: "no production consumer" does NOT fully hold

The hypothesis was that after the escape-hatch fix (`?refine=1` → `?refine=products` for
`PLAN_ACCEPT_REFINE_HREF`) and the Modul-1 Stage-3 resume fix, no production journey renders
`PersonalPlanChapterTransition`, the 5-stage bar, `PersonalPlanJourneyOverview`, or
`PERSONAL_PLAN_JOURNEY_STAGES`. Verified render-site by render-site:

| Piece | Verdict | Evidence |
| --- | --- | --- |
| Chapter 1 („Wir haben deinen Plan erstellt.") | **Dead** | No `currentStage={1}` render anywhere except the labs page's stage whitelist. The `/plan-bereit` arrival screen replaced it. |
| Chapter 2 / `InvitationShell` | **Dead** | Only renderer is `mode === "invitation"`, which requires `directEntry=false` at entry (`deriveStage2EntryMode`) or on Back with 0 completed answers. The sole production `RefinementFlow` caller (`plan-start-flow.tsx`) passes `directEntry` unconditionally. |
| Chapter 3 (`RefinementBridge` chapter presentation) | **LIVE** | (a) Legacy linear cohort: bare `/plan-start` with an existing draft falls through to `{stage:"stage2"}` **without** `refineModule` (page.tsx fall-through) — linear completion shows the chapter bridge; a complete draft with frontier ≠ stage3 shows it during auto-handoff. Bare `/plan-start` is reachable via `/result/[leadId]` active-redirect, checkout-success redirect, `/plan-bereit` CTA, and the Routine „Produkte prüfen" fallback. (b) `stage2BridgePresentation` returns `"chapter"` on `handoffStatus === "error"` for EVERY entry — the chapter screen is the handoff error/retry surface, explicit module entries included. |
| Chapter 4 (Stage-3 completion) | **LIVE** | `completion && !directRoutineHandoff` — renders for every journey without explicit module scope: `?repairRoutineVersionId` repair, the ordinary complete-draft Stage-3 resume, and linear journeys riding into Stage 3 in-session. |
| 5-stage bar (`journey-header` stage path) | **Live via chapters only** | Every other header caller passes `showStageProgress={false}`; `chapter-transition.tsx` omits it (default `true`). Lives exactly as long as chapter screens 3+4 live. |
| `PersonalPlanJourneyOverview` | **Live via chapters only** | Rendered inside `PersonalPlanChapterTransition`; no other production consumer. |
| `PERSONAL_PLAN_JOURNEY_STAGES` | **Live via chapters only** | Consumed by the stage bar and the overview. |
| `ResumeShell` | **LIVE** (not chapter machinery) | Legacy linear resume (bare `/plan-start`, partial draft, Back off the first question with completed answers). Stays. |

## Shipped in this change

1. **`first_open` behaves like an explicit first-open-module entry end to end** (the ruled
   direction, founder ruling 27.08.2026):
   - `resolveStage2EntryModule("first_open")` falls back to the first module (`products`) when no
     module is open, so a complete/all-answered draft gets the same edit visit an explicit deep
     link gets.
   - `Stage2ModuleScope` loses `"first_open"` — a resolved `first_open` request IS an explicit
     module scope: question-mode entry (no invitation/resume ceremony), quiet pending bridge,
     bridge auto-continue, Back-off-first-question exits, `/routine` exit for the accepted cohort
     (origin gating via `planAccepted` unchanged), module meter loaded for `?refine=1` too.
2. **Chapter 1+2 deleted** from `PERSONAL_PLAN_CHAPTERS`; `PersonalPlanChapterStage` narrows to
   `3 | 4`. `InvitationShell`, the `"invitation"` mode, and the entire `directEntry` plumbing
   (now meaningless) removed from `RefinementFlow`, `module-scope`, `plan-start-flow`, and labs.
3. **Labs**: `/labs/personal-plan-chapters` restricted to stages 3+4; `/labs/personal-plan-stage-2`
   drops `directEntry`. `/labs/personal-plan-stage-1-2` needed no change (it drives the production
   journey client and does not touch the removed API).

## Gated (kept, documented — genuine consumers remain)

- `PersonalPlanChapterTransition` + chapters 3/4 + 5-stage bar + `PersonalPlanJourneyOverview` +
  `PERSONAL_PLAN_JOURNEY_STAGES`: still the linear cohort's bridge/completion surfaces and the
  bridge's universal handoff-error surface (see table). Deleting them requires first ruling what
  the linear cohort (bare `/plan-start` with an existing draft) and the bridge error state should
  show instead — a user-facing design decision, not a mechanical cleanup.
- **Customer.io C6 (legacy quiz-result email template) — deferred.** The audit called
  `docs/customerio/quiz-result-artifact-*` + `scripts/customerio-quiz-result-email.ts` dead
  weight, but: the organic quiz at `/quiz` still creates `quiz_kind: "legacy"` leads, step 10
  (`QuizPreparation`) still fires `POST /api/quiz/result-artifact`, and
  `handleResultArtifactEmail` sends for exactly those leads (gated only on
  `CUSTOMERIO_APP_API_KEY`). Moderator tests were just routed through this quiz (#474/#476).
  Additionally `scripts/customerio-personal-plan-result-email.ts` (live tooling) imports shared
  helpers from the quiz script. Deleting the template sources would orphan a plausibly-live
  remote template and requires a helper extraction. Needs an explicit ruling that the legacy
  result email is off in production before deletion.

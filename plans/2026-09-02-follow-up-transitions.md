# Follow-up Transitions A & B (after the two-state opening, #503)

**Status:** Approved 02.09.2026. Nick reviewed the interactive today-vs-proposed
mockups (`plans/evidence/2026-09-02-follow-up-transitions/anschluss-choreografien.html`)
and signed off all five decisions with the stated recommendations ("go with your
recommendation"). Follow-up A ships first; Follow-up B is its own later PR.

## Decisions (all approved as recommended)

1. **One loading layout for /plan-start** — the route loading shell and the
   in-flow `PlanStartLoading` render the identical opening shell (stage header,
   opening ring, "Dein persönlicher Plan" / "Dein Plan wird geöffnet.").
2. **No fake progress bar** — the determinate bar stuck at 50 % ("Plan wird
   vorbereitet") is retired. The Basis/Optional pages' own "Plan-Fortschritt"
   indicator (real 50/100 semantics) stays.
3. **Same bridge for the /welcome → /plan-start cohort** — activation-ready
   buyers redirected past the arrival get the opening loading frame on /welcome
   too, so both cohorts share one choreography.
4. **Reveal → offer (Follow-up B):** "Deine Auswertung wird geöffnet …" becomes
   a held state (animated ellipsis, minimum ~1 s, longer while the offer route
   renders) and `/result/[leadId]` gets a loading shell on the same cream so
   the offer crossfades in instead of popping after a white gap.
5. **Skeleton dialect: static grey app-wide** — the pulsing skeletons (Routine,
   Anwendung) convert to the neutral static contract; animated loading stays
   reserved for the journey opening frames.

## Follow-up A — scope of this branch

- `src/components/personal-plan-start/plan-start-opening.tsx` (new): the shared
  opening shell; reuses `PlanOpeningRing` and the `plan-opening-*` CSS from #503.
- `src/components/personal-plan-start/plan-start-flow.tsx`: `PlanStartLoading`
  renders the shared shell (decision 1+2). Retry/unavailable StateShell screens
  unchanged.
- `src/app/plan-start/loading.tsx`: same shell with the route's a11y shell
  attributes; leaves the neutral-shell family like plan-bereit did.
- `src/app/welcome/welcome-client.tsx`: `redirectTo === "/plan-start"` also gets
  the opening frame + beat marker (decision 3).
- Entrance into the ready plan keeps the existing `PersonalPlanStageEntrance` /
  `PersonalPlanViewTransition` machinery — no new animation system; the mockup's
  staggered rise maps onto the existing 200 ms stage-entrance.
- Stage-3 preparation/recovery panels and their copy are out of scope.

## Follow-up B — scope of the second PR

- `src/lib/quiz/personal-plan-result-reveal.ts`: `PERSONAL_PLAN_RESULT_REVEAL_EXIT_HOLD_MS`
  (1 s) — the exit line is held as a real state; the offer route is prefetched
  during the hold so the wait approaches max(beat, latency).
- `src/app/result/[leadId]/reveal/personal-plan-result-reveal.tsx`: held exit
  beat with the shared animated ellipsis; step timers stop tracking after
  completion; the Überspringen button leaves with the reveal.
- `src/app/result/[leadId]/loading.tsx` (new): the identical exit line on the
  identical cream ground — covers reveal→offer, quiz→reveal, and the other
  /result entries (pricing, quiz_return email links) with one journey screen.
- `src/components/quiz/reveal-opening-dots.tsx` (new): wall-clock-anchored
  ellipsis shared by the reveal, the shell, and the legacy quiz overlay.
- `src/components/quiz/quiz-results.tsx`: the legacy overlay's copy aligned to
  "…deine Auswertung wird geöffnet …", so the overlay and the shell read as one
  continuing state instead of two different transition screens.
- `src/app/result/[leadId]/page.tsx`: the offer crossfades in
  (`personal-plan-result-enter`).
- Decision 5: `src/app/routine/loading.tsx` and `src/app/anwendung/loading.tsx`
  converted to the neutral static dialect and added to the phase-3 shell
  contract with full a11y attributes.

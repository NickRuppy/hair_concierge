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

## Follow-up B — queued (separate PR)

Reveal exit state + `/result/[leadId]` loading shell (decision 4), plus the
skeleton dialect unification (decision 5). Same evidence file governs.

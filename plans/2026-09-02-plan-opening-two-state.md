# Two-State Post-Payment Opening (payment → /plan-bereit)

**Status:** Approved and implemented. Evidence review + user-journey sign-off: Nick, 02.09.2026
(interactive mockup: `plans/evidence/2026-09-02-plan-opening/plan-bereit-choreography.html`).

## Problem

After payment, a buyer passed four visually unrelated full-screen layouts in under two
seconds: `/welcome` "Zahlung erfolgreich / Weiterleitung…", the `/plan-bereit` grey
skeleton, a split-second flash of the "Wir bereiten deinen Haarplan vor." checking
screen, then the "Dein Plan ist fertig." arrival. Three hard cuts read as flicker.

## Approved design: exactly two perceived states

1. **Loading** — cream shell, wordmark header, spinning plum ring, "Zahlung bestätigt",
   "Dein Plan wird geöffnet." Rendered pixel-identically by the `/welcome` redirect
   branch, `plan-bereit/loading.tsx`, and the `checking`/`source_pending` states, so the
   route change and streaming gap are invisible. Minimum beat **1.2 s**, measured from
   the first paint on `/welcome` (sessionStorage marker, TTL 15 s). Slow link: the frame
   holds and "Wir verbinden deinen Plan mit deinem Konto – einen Moment." fades in after
   2.5 s.
2. **Ready** — the same mounted frame morphs in place: the arc closes into a full ring
   (450 ms, plum → green), the checkmark draws itself (SVG stroke, 300 ms, 200 ms
   offset), the headline crossfades to "Dein Plan ist fertig." in the same grid cell,
   and sub-line / list / CTA rise in staggered (250/350/450 ms delays,
   `cubic-bezier(.16,1,.3,1)`). No layout shift: every ready element's space is reserved
   from the start.

Grounding: delayed-indicator + minimum-display (Pencil & Paper, OpenReplay), morph-not-swap
(Villar, NN/g), choreography easing + stagger (Carbon, Material), 250–500 ms view
transitions (NN/g). Sources linked in the evidence mockup.

## Unchanged (deliberately)

- Replay-safe design: read-only first render; the client `POST /plan-bereit/status`
  still performs source binding/projection. No backend, routing, or polling changes.
- Error / retry / missing-fact / support / timeout screens keep their layouts and copy.
  Server-first they render directly (stable single screens, reachable without JS);
  mid-poll they can only appear after ≥1 poll interval (1.5 s), which outlasts the beat.
- The password / magic-link setup path for unauthenticated buyers.
- `/welcome` redirect targets other than `/plan-bereit` (onboarding, reactivation) keep
  the generic confirmation screen.

## Implementation map

- `src/app/plan-bereit/plan-ready-arrival.tsx` — `PlanBereitArrival` is now the
  persistent two-state frame (`phase`, `interactive`, `slowHint`, `loadingShellId`,
  `noscriptFallback`). No-JS: a server-known-ready frame ships a `<noscript>` style
  forcing the final state; waiting states keep the reload/support links.
- `src/app/plan-bereit/opening-beat.ts` (+ `tests/plan-bereit-opening-beat.test.ts`) —
  beat constants and the cross-route start marker.
- `src/app/plan-bereit/personal-plan-ready-client.tsx` — beat/slow-hint timers; ready
  and waiting states route through the frame.
- `src/app/plan-bereit/loading.tsx` — renders the identical loading frame (deliberately
  left the neutral-shell family; see `tests/phase3-loading-shells.test.tsx`).
- `src/app/welcome/welcome-client.tsx` — the `/plan-bereit` redirect branch paints the
  loading frame and stamps the beat marker.
- `src/app/globals.css` — `plan-opening-*` choreography + reduced-motion overrides
  (instant switches after the same beat).
- `src/app/labs/plan-bereit-ankunft/` — replay harness for the full morph.

## Follow-ups (own branches, not this PR)

- **A — plan → app handoff:** unify `/plan-start`'s two loading layouts with the arrival
  frame; extend `PersonalPlanStageEntrance` / `PersonalPlanViewTransition`.
- **B — quiz reveal → offer:** hold the "Deine Auswertung wird geöffnet…" state properly,
  give `/result/[leadId]` a matching loading shell; unify the pulsing vs. static
  skeleton dialects.

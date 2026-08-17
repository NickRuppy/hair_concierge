# Mobile typography for plan transition pages + plan fork

**Status:** evidence review confirmed (mockup artifact "Übergangsseiten mobil",
https://claude.ai/code/artifact/394094da-a9e1-4090-9e33-fe9523d5770b, 2026-08-17) and user journey
signed off by Nick ("ok worksss do it"). Chosen design: **Variante D** — Variant C's scrollable
layout with the current stage as a large focus card and minimal auto-scroll.

**Implemented 2026-08-17.** Verified: computed-size audit matches the table below on 375×667 and
375×812 for stages 1–5 + fork; auto-scroll fires only when the current card is below the fold
(stage 4: 40px, stage 5: 95px on 375×667, zero elsewhere); footer clearance driven by the measured
`--landing-sticky-cta-offset` after internal review flagged the static padding; `ci:verify` green.

## Problem

All five Personal-Plan transition pages (shared `PersonalPlanChapterTransition`) lock the page to
`h-dvh` + `overflow-hidden`, crushing type to fit: subtitle 10–12px, stage-card descriptions 9px,
stepper labels 8px. `PlanForkScreen` has the same scale (lead 11.5px, microcopy 9.5px) plus a large
dead void above its fixed footer. Best-practice floors: ~16px body, 12–13px secondary.

## Design (signed off)

Screens scroll naturally; the CTA dock stays fixed. Type scale:

| Role | Size |
| --- | --- |
| H1 | `clamp(28px, 8vw, 32px)`, leading 1.15 |
| Subtitle / lead | 16px, leading 1.5 |
| Current-stage focus card | title 20px, desc 14px, number chip 46px |
| Other stage cards | title 17px, desc 13px, number chip 40px |
| Completed stages | ✓ instead of number (white chip, plum glyph) |
| Stepper labels (flow-wide) | 8px → 10px |
| Notices, footnotes, errors, microcopy | 12–13px |
| Plan-fork assumptions | label 11px, items 14px, note 12.5px |

Auto-focus: on load, scroll the current stage card into view with **minimal** scroll
(`scrollIntoView({ block: "nearest", behavior: "instant" })` + scroll margins for the sticky header
and CTA dock) so the headline stays visible as much as the viewport allows. No animation.

## Tasks

1. `src/components/personal-plan-journey/chapter-transition.tsx` — unlock scrolling
   (`min-h-dvh`, drop `overflow-hidden` and `[@media(min-height:731px)]` compression), sticky
   header, new H1/subtitle/error sizes, keep the CTA dock + resize-observer offset logic.
2. `src/components/personal-plan-journey/journey-overview.tsx` — natural card heights (no
   `grid-rows` squeeze), focus-card treatment for the current stage, ✓ for completed, new type
   scale, auto-scroll effect, banner 13px.
3. `src/components/personal-plan-journey/journey-header.tsx` — stepper labels 10px.
4. `src/components/personal-plan-journey/plan-fork-screen.tsx` — same type scale; footer clearance
   matches the taller dock; no behavior changes.
5. `src/app/labs/personal-plan-chapters/` — dev-only lab page rendering the transition at
   `?stage=1..5` and the fork screen at `?screen=fork` for verification.

No copy, routing, or behavior changes anywhere. Verification: lab screenshots at 375×667 and
375×812 for stages 1–5 + fork, computed-font-size audit, `npm run ci:verify`.

# Idealplan ready-page content refresh

## 1. Outcome and source context

Replace only the successful `/plan-bereit` page content with the approved five-stage journey overview. Preserve the complete transition and animation system merged in [PR #415](https://github.com/NickRuppy/hair_concierge/pull/415) at merge `893d3b48`, including navigation timing, hold states, route prefetching, focus, scroll restoration, reduced motion, and recovery behavior.

Also align active customer-facing Personal Plan terminology:

- Stage 1 artifact: `Idealplan`, not `Bedarfsplan`
- Stage 2 label: `Feinschliff`, not `Verfeinerung`

Internal types, persistence, routes, analytics IDs, and authority contracts retain their existing names.

Source evidence:

- Selected ready-page mockup: [selected-ready-page.html](./evidence/personal-plan-chapter-transitions/selected-ready-page.html)
- Existing motion authority: [2026-08-14-personal-plan-transition-system.md](./2026-08-14-personal-plan-transition-system.md)
- PR #415 verification: 17/17 focused Chromium journeys, 1,596/1,596 Personal Plan tests, and `npm run ci:verify` passed at the reviewed head.

Planning contract:

- **Outcome:** the customer understands the complete five-stage value chain before opening Stage 1.
- **Constraints:** content-only integration on the ready page; all PR #415 interaction and motion contracts remain live.
- **Non-goals:** no new interstitials, no new chapter-transition state machine, no changed handoff timing, no recommendation/data changes, and no migration or release flag.
- **Done when:** the ready page matches the selected design at mobile sizes, terminology is consistent, and the existing transition regression suite proves the choreography is unchanged.

## 2. Chosen direction

The five-card journey is an orientation overview on the successful `/plan-bereit` page. It is not a replacement transition framework and is not replayed between later stages.

Implementation adds a small presentational `PersonalPlanJourneyOverview` plus a shared display configuration used by both the overview and `PersonalPlanJourneyHeader`. The existing successful ready-page branch supplies Stage 1 as current and retains its current Link behavior:

```text
Link /plan-start
  -> markPersonalPlanStageNavigation('/plan-start')
  -> destination mounts real Stage 1 content
  -> PersonalPlanStageEntrance consumes the intent
  -> existing 220ms quiet entrance runs
```

No PR #415 transition primitive, animation CSS, navigation-intent helper, persistence call, or router handoff is redesigned.

### Authoritative ready-page copy

- Heading: `Wir haben deinen Idealplan erstellt.`
- Supporting copy: `Jetzt machen wir ihn mit deinem Alltag und deinen Produkten wirklich zu deinem.`
- Goal: `Für schönes, gesundes Haar.`
- CTA: `Idealplan ansehen`

| Stage | Card title               | Card description                   | Header label |
| ----- | ------------------------ | ---------------------------------- | ------------ |
| 1     | Dein Idealplan           | Aus deinem Quiz erstellt.          | Idealplan    |
| 2     | Persönlicher Feinschliff | An deinen Alltag angepasst.        | Feinschliff  |
| 3     | Dein Produkt-Check       | Mit deinen Produkten abgeglichen.  | Produkte     |
| 4     | Deine Routine            | Konkrete Produkte für deine Ziele. | Routine      |
| 5     | Anwendung                | So setzt du alles richtig um.      | Anwendung    |

### Visual contract

- Existing centered Chaarlie header and five-segment progress stay fixed.
- Stage 1 is the only highlighted journey card; Stages 2–5 use one identical warm-neutral treatment.
- Plum is used for Stage 1/current progress, coral for the CTA, and warm sand for the goal.
- No decorative green is introduced.
- No eyebrow, readiness card, top-right card badge, or redundant subheading appears in the successful state.
- Heading stays centered and within two visual lines for the approved copy.
- At 320 × 700 and 390 × 844, header, hero, five cards, goal, and CTA are visible without page scrolling; no copy is clipped.
- CTA remains at the bottom with safe-area and cookie-banner clearance.

## 3. Scope and non-goals

### In scope

- Replace the `canContinue` content in `personal-plan-ready-client.tsx`.
- Centralize the five user-facing stage labels/descriptions for the header and overview.
- Apply `Idealplan` and `Feinschliff` consistently to active customer-visible Personal Plan copy and accessibility labels.
- Update copy assertions and add ready-page responsive/accessibility coverage.
- Preserve and rerun PR #415 motion/navigation tests.

### Explicitly unchanged from PR #415

- `PersonalPlanStageEntrance` implementation and 220ms target entrance.
- `PersonalPlanViewTransition` depth motion, retained inert outgoing layer, focus timing, scroll memory, and reduced-motion swap.
- `stage-navigation-intent.ts` destination-bound, single-use, time-bounded marker.
- `/plan-bereit` default partial prefetch and explicit `/plan-start` navigation mark.
- Stage 1 Basis/Optional depth transition and its bottom action portal.
- Stage 1 → 2 hold-until-ready behavior and retry on the still-visible Stage 1 surface.
- Stage 2 question depth transitions and optimistic-save rollback.
- Stage 2 → 3 bridge hold during Stage 3 bootstrap.
- Stage 3 completion receipt, `performPersonalPlanRoutineHandoff`, and App Router replacement to `/routine`.
- Routine eligibility, `/anwendung` full prefetch, intentional navigation mark, and direct CTA.
- Anwendung local overview/day navigation, canonical URLs, browser history, no-refetch behavior, and animations.

### Other non-goals

- No journey overview on Stage 1 → 2, Stage 2 → 3, Stage 3 → Routine, or Routine → Anwendung.
- No additional user click, waiting screen, or route.
- No change to readiness waiting, missing-fact, timeout, forbidden, support, or retry states.
- No internal rename of `NeedPlan`, `needPlan`, refinement code/types/events, stage IDs, APIs, database fields, fingerprints, analytics IDs, migrations, or historical plans.
- Generic German phrases such as `bei Bedarf` and verbs such as `verfeinern` remain when they are not the stage/artifact name.

## 4. Target map

| Surface                                                                       | Planned change                                                                                                                                                                                                                                                                |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/personal-plan-journey/journey-content.ts` (new)               | Typed authoritative display configuration for five stage labels, card titles, and descriptions.                                                                                                                                                                               |
| `src/components/personal-plan-journey/journey-overview.tsx` (new), `index.ts` | Static semantic five-card overview used only by the successful ready page.                                                                                                                                                                                                    |
| `src/components/personal-plan-journey/journey-header.tsx`                     | Consume shared labels (`Idealplan`, `Feinschliff`) without changing progress or layout behavior.                                                                                                                                                                              |
| `src/app/plan-bereit/personal-plan-ready-client.tsx`                          | Replace only `canContinue` hero/check/readiness-card content with hero, journey overview, goal, and existing marked Link CTA.                                                                                                                                                 |
| Active Personal Plan copy surfaces                                            | Customer-visible artifact/stage terminology only; no flow or persistence edits. Likely files include Stage 1 screens/loading/errors, Stage 2 invitation/resume/bridge copy, Stage 3 plan references/recovery copy, Routine descriptions/cards, and active Labs comments/copy. |
| Tests                                                                         | Add overview semantics/responsive contract and update exact visible-copy assertions; preserve PR #415 transition tests.                                                                                                                                                       |

Files that should not require behavioral edits include `stage-entrance.tsx`, `view-transition.tsx`, `stage-navigation-intent.ts`, Stage 3 completion logic, Routine navigation logic, and Anwendung navigation logic.

## 5. Designed user journey

1. An entitled customer reaches `/plan-bereit`.
2. Existing waiting, missing-data, retry, and support states behave exactly as they do at merge `893d3b48`.
3. When readiness is successful, the customer sees the selected five-stage overview with Stage 1 highlighted, the promise `Wir haben deinen Idealplan erstellt.`, and the bottom CTA `Idealplan ansehen`.
4. Activating the CTA uses the existing `/plan-start` Link and records the existing navigation intent. It does not add an intermediate page or extra click.
5. The real Stage 1 content mounts and receives PR #415’s existing quiet entrance. Basis/Optional then retain their existing depth push.
6. Stage 1 → 2 holds Stage 1 during the Stage 2 request; success enters the first Feinschliff question and failure leaves Stage 1 readable with retry.
7. Stage 2 questions, Stage 2 → 3 bridge hold, Stage 3 completion → Routine replacement, Routine → Anwendung prefetch/entrance, and Anwendung overview/day motion all continue unchanged.

### Error, resume, and direct-entry behavior

- A failed readiness check never renders the journey overview.
- A direct `/plan-start`, `/routine`, or `/anwendung` visit does not falsely receive an intentional stage entrance.
- Resume behavior is still derived from persisted journey access; the overview is not replayed during later-stage resume.
- Loading or recovery targets never animate as successful progression.

### Accessibility and mobile behavior

- The overview is an ordered list with Stage 1 marked current; the distinction is not color-only.
- The page has one `h1`, one primary CTA, and no duplicated success/readiness announcements.
- Touch target is at least 44px, focus styling remains visible, and CTA/navigation semantics remain a real Link.
- The complete page fits without scroll at 320 × 700 and 390 × 844, including safe-area/cookie clearance.
- Reduced-motion behavior remains owned by the unchanged destination entrance.

## 6. Planning evidence

- **Selected content artifact:** [selected-ready-page.html](./evidence/personal-plan-chapter-transitions/selected-ready-page.html)
- **Implemented browser evidence:** [320 × 700](./evidence/personal-plan-chapter-transitions/implemented-ready-320x700.png), [390 × 844](./evidence/personal-plan-chapter-transitions/implemented-ready-390x844.png), [desktop](./evidence/personal-plan-chapter-transitions/implemented-ready-desktop.png), and [320 × 700 with cookie clearance](./evidence/personal-plan-chapter-transitions/implemented-ready-320x700-cookie.png).
- **Question answered:** How should the successful ready page explain the five stages without adding copy clutter or another interaction step?
- **Selected direction:** one compact overview at entry; Stage 1 active; future stages visually uniform; two-line hero; goal above the fixed CTA.
- **Feedback incorporated:** larger and clearer stages, shorter causal copy, `Idealplan`, no redundant eyebrow/status card, goal line, no green, uniform future cards, centered quiz-aligned spacing, fixed CTA, and all content visible on mobile.
- **Evidence review:** confirmed by Nick before the implementation-plan request.
- **Architecture correction:** PR #415 is now the transition authority. The earlier proposal to create a separate chapter-transition component/state at every boundary is rejected.
- **Designed-user-journey sign-off:** confirmed by Nick on 2026-08-15 with `Very good, you can start the implementation then.` This confirms the corrected content-only journey and preservation of PR #415 transitions.

## 7. Ordered tasks

### Task 1 — Add the static ready-page journey content

**Consumes:** approved copy/visual contract and existing Journey header structure.

**Produces:** shared display config and `PersonalPlanJourneyOverview` with Stage 1 current.

Implementation details:

- Keep the component purely presentational: no routing, persistence, animation, handoff, analytics, or readiness state.
- Render semantic ordered-list/current-stage text, the vertical connector, five compact cards, and the goal.
- Reuse existing CI tokens where possible; add only narrowly named presentation values if a warm-neutral/sand value is not already available.
- Keep the complete layout inside the existing ready-page mobile shell and CTA clearance.

**Tests:** add `tests/personal-plan-journey-overview.test.tsx` for exact copy, ordered/current semantics, all five stages, one future-stage style, absence of green/success-card copy, and no interactive controls inside the overview.

**Complete when:** the overview renders the selected content with no behavior of its own.

### Task 2 — Replace only the successful ready-page branch

**Consumes:** Task 1 overview and the existing `canContinue`, `nextHref`, and marked `/plan-start` Link.

**Produces:** selected page content with the original navigation path intact.

Implementation details:

- Remove the successful-state check circle, `Deine Angaben sind gespeichert`, `Haaranalyse verbunden / Bereit` card, and old hero copy.
- Insert the approved hero, overview, goal, and `Idealplan ansehen` CTA.
- Retain `href={nextHref}` and `markPersonalPlanStageNavigation('/plan-start')` unchanged.
- Leave every non-success branch byte-for-byte unchanged unless a shared wrapper must be adjusted for the successful layout.

**Tests:** update `personal-plan-ready-server-first.test.tsx` and `personal-plan-ready-transition.test.ts` for exact content, absence of removed copy, unchanged link target/intent mark, and unchanged waiting/error/support behavior.

**Complete when:** the visual content changes but the request/navigation timing and target entrance contract do not.

### Task 3 — Align customer-facing terminology without touching flow behavior

**Consumes:** shared display labels and the scoped active-UI terminology inventory.

**Produces:** consistent `Idealplan` and `Feinschliff` naming across active Personal Plan UI.

Implementation details:

- Update visible headings, descriptions, CTA labels, accessibility labels, and non-historical source comments that describe visible behavior.
- Include active Labs because they render production components for verification.
- Do not rename symbols, routes, contracts, schema, events, fixtures representing domain values, migrations, or historical plans.
- Do not replace German idioms (`bei Bedarf`) or ordinary verbs (`verfeinern`) that are not stage names.

**Tests/checks:** update exact-copy assertions in Stage 1/2/3/Routine tests and run a reviewed scoped `rg` inventory for semantic `Bedarfsplan` / stage-name `Verfeinerung` remnants.

**Complete when:** active rendered UI consistently uses the approved names and the diff contains no behavioral changes outside Task 2.

### Task 4 — Prove PR #415 transition behavior remains intact

**Consumes:** Tasks 1–3 and merged PR #415 contracts.

**Produces:** automated and browser evidence that this is a content-only change.

Implementation details:

- Keep `tests/personal-plan-transition-motion.test.tsx` behavior assertions intact, changing only exact customer-copy selectors when required.
- Rerun Stage 1, Stage 2, Stage 1–3, and Anwendung transition browser suites.
- Add ready-page screenshots at 320 × 700, 390 × 844, and desktop; compare against selected evidence.
- Inspect the final diff to confirm no changed navigation intent, router call, prefetch value, transition duration/class, persistence call, recovery branch, or history behavior.

**Checks:** affected Node/React suites; PR #415 transition suite; `npm run typecheck`; scoped lint; `git diff --check`; implementation-loop `ready-check`; fresh browser captures.

**Complete when:** selected content fits at both mobile sizes and every existing motion/navigation regression remains green.

## 8. Verification

### Automated

- New journey-overview component tests.
- Ready-page server-first and transition tests.
- Affected terminology/copy suites.
- `tests/personal-plan-transition-motion.test.tsx`.
- Existing Stage 1, Stage 2, Stage 1–3, Routine, and Anwendung transition browser tests.
- `npm run typecheck`, scoped lint, and `git diff --check`.

### Manual/browser

- Capture successful `/plan-bereit` at 320 × 700, 390 × 844, and desktop.
- Confirm one h1, two-line maximum heading, centered/padded content, five readable cards, warm-sand goal, uniform future-stage color, and visible bottom CTA without scrolling.
- Activate `Idealplan ansehen`; confirm the same quiet destination entrance shipped in PR #415.
- Continue through Basis/Optional and at least the fixture-backed Stage 1 → 2 → 3 path; confirm depth/hold/quiet transitions remain.
- Verify reduced motion and keyboard focus.

### Live state and rollout

- No Supabase migration, live write, new flag, deployment, or activation is planned.
- Fixture/Labs proof remains distinct from authenticated owner-scoped runtime proof.
- Existing Personal Plan release/access gates remain the rollback boundary; code rollback is revert/redeploy.

## 9. Review and handoff

- **Planning worktree:** `/Users/nick/AI_work/hair_conscierge/.worktrees/personal-plan-chapter-transitions`
- **Branch:** `codex/personal-plan-chapter-transitions`, fast-forwarded to PR #415 merge `893d3b48` before revising this plan.
- **Evidence review:** confirmed for the selected ready-page content.
- **Counterpart plan review:** explicitly waived by Nick on 2026-08-15 because the required Claude reviewer was unavailable after reaching its session limit. Nick authorized implementation to start without waiting for that review. The normal final verification and code-review gates remain required.
- **Designed-user-journey sign-off:** confirmed on 2026-08-15; no correction remained after the PR #415 scope walkthrough.
- **Implementation gate:** implementation started after sign-off under `implementation-loop`; the unavailable Claude plan review was waived explicitly, while final readiness and code-review gates remain required.
- **Stop point:** no commit, push, PR, merge, deployment, migration, activation, or production write is authorized by this planning request.

### Artifact disposition

- **Commit if implemented:** this plan and `selected-ready-page.html`.
- **Discard:** superseded multi-interstitial evidence and transient Claude output.
- **Archive with eventual PR:** fresh implementation screenshots and verification receipts.

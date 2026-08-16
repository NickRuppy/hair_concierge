# Selected is Ready — remove the provisional/vorläufig presentation for planned products

**Decision (Nick, 2026-08-16):** A catalog product chosen in the Produkte step is instantly a full
member of the routine. No "vorläufig", no "Teilweise bereit" caused by unpurchased products, no
purchase-confirmation step. Implementation depth = option C (presentation-layer remap): the
owned/planned data model, contracts, and the acquire API stay intact and dormant so a proper
"not yet bought" state can be reintroduced later.

**Evidence:** `plans/2026-08-16-selected-is-ready/mockup-before-after.html` — reviewed and
approved by Nick together with the user journey (chat, 2026-08-16). No visual fork: every target
state is an existing confirmed style.

## Stays unchanged (deliberate)

- Portfolio/routine contracts, schema versions, persisted payloads, acquire API route
  (`src/app/api/personal-plan/routine/planned-items/[itemKey]/acquire/route.ts`) and
  acquisition service — dormant, no user-visible entry point.
- `pending_review` (user submissions): "Noch in Prüfung" badge, unresolved/open slot treatment.
- `availability: "none"` states: "Offen", "Basis-Lücke", "Details offen", "Nicht verfügbar".
- Quiz/offer funnel copy ("vorläufiges Beispiel") — different concept, out of scope.

## Task 1 — Anwendung compiler treats planned items as confirmed (TDD)

`src/lib/routines/personal-plan/application/compiler.ts` (lines ~527–530 and ~553–559):
product blocks currently become `provisional` when `item.availability === "planned"` or
`!item.executable`. Only planned items can reach these branches non-executable (owned catalog
products are always executable; pending_review/none never become blocks — see
`application-adapter.ts` candidate filter). Change: product blocks are always
`status: "confirmed"`, `provisionalReason: null`. Keep the contract fields; do not touch
`unresolvedBlocks`, which still drive `isPartial`/"Details offen".

Tests first: `tests/personal-plan-stage5-compiler.test.ts` (and stage5 view-adapter/german-copy
tests where they assert provisional) — planned input items must now compile to confirmed blocks;
days with only planned products must report `isPartial: false`, `provisionalProductCount: 0`;
days with unresolved slots keep `isPartial: true`.

## Task 2 — Anwendung components drop unreachable provisional rendering

- `src/components/application/product-application-block.tsx`: remove the provisional branch
  (amber card, VORLÄUFIG badge, both provisional note strings).
- `src/components/application/application-day-card.tsx`: remove `ProvisionalMark`, dashed
  provisional borders, the "(vorläufig)"/"bestätigt" wording in `shelfStatusSummary` (name the
  product plainly), and the "N Produkte vorläufig" part of `formatPartialFact`. Keep
  "Teilweise bereit" + "N Details offen" for genuinely unresolved days.
- `src/components/application/application-overview.tsx`: drop the provisional count from the
  status banner; banner only renders for unresolved details.
- View types: keep `status`/`provisionalReason` fields in the view contracts (compiler still
  emits them); only the rendering branches go.

## Task 3 — Routine tab: planned = Aktiv, no purchase button (TDD)

- `src/components/routine/personal-plan/routine-status.tsx`: planned items with a concrete
  `productId` report "Aktiv" (green). Planned with `productId: null` (no exact product picked)
  reports "Offen" like `availability: "none"`. Adjust the `!item.executable` fallback so planned
  items with productId don't fall into "Noch nicht einsatzbereit".
- `src/components/routine/personal-plan/routine-item-card.tsx` (`statusClassName` ~line 323):
  align tinting with the new statuses.
- `src/components/routine/personal-plan/routine-product-detail.tsx`: remove the
  "Ich habe es schon gekauft" button and `onMarkPurchased` prop.
- `src/components/routine/personal-plan/personal-plan-routine-client.tsx`: remove the acquire
  handler (fetch to `/acquire`, success/error copy) and its wiring.

Tests: adjust `tests/personal-plan-stage4-ui.test.tsx` and any stage5 route/view tests
asserting "Geplant"/provisional.

## Task 4 — Verification

1. `npm run ci:verify` (typecheck + lint + build) in the worktree.
2. Targeted vitest runs for the touched test files.
3. Drive the flow with the dev server (`npm run dev:worktree`): /routine and /anwendung with a
   test account whose products are planned — expect all-confirmed presentation; day detail
   cards plum; no purchase button; unresolved/pending states unchanged.
4. Codex whole-branch review (read-only) per repo workflow, then /ship.

## Addendum — adversarial review outcomes (2026-08-16, decided with Nick)

Fixed on this branch beyond the original tasks:
- /profile Produkte rows no longer render a state badge at all (was "Noch kaufen"/"Vorhanden" — contradicted /routine, and a never-varying badge carries no information).
- Application adapter demotes planned products whose catalog row has `is_chaarlie_recommended = false` (catalog-health axis that previously rode on the provisional flag). Owned products are unaffected by curation.
- `isBlockingBasisGap` also counts a planned ref without a chosen product (API-reachable edge), keeping status, banner, and Anwendung gate coherent.
- Product detail sheet stays quiet when availability is unknown ("Aktuelle Verfügbarkeit nicht bestätigt"/"Noch keine Shopdaten verfügbar" removed); only definite availability renders.
- Test fixtures aligned with real payload shapes (planned items always carry productId + executable:false); v3 replacement path now asserted as "Aktiv".

Decided and deliberately NOT changed:
- Acquisition-triggered routine proposals may present a no-visible-delta "Änderungen verfügbar" (planned→owned flip renders identically). Kept as a data-level backdoor; no visible product behavior defined for it yet.
- Dormant purchase plumbing stays: acquire API route + acquisition service + `plannedLabelFor` + their tests, and the always-"confirmed" status fields in the application contracts. Reconnect point for a future proper "not yet bought" state.
- `personal_plan_stage4_item_interacted { interaction: "acquisition_declared" }` is no longer emitted anywhere — check PostHog dashboards/funnels before relying on it.

# Hair Tools Phase 1 — verification & review receipt

Supersedes the 2026-08-21 draft receipt, which was invalidated by the volume-rule
change and by the Codex review findings (Codex finding 12).

## Identity

- Worktree: `.worktrees/personal-plan-hair-tools-current-shape`
- Branch: `codex/personal-plan-hair-tools-current-shape` (no commits; working tree only)
- Base: `2efd080afe9af98fb4b41d54c3d26a5446b6bd95` (== `origin/main` at implementation time)
- Canonical content fingerprint of the verified tree, this receipt excluded:
  `30be90779b8a5cb7955407d2428f47a24f4cc3a6a045aff81c6513acf75440a2` — SHA-256
  over a sorted manifest of **137 unique in-scope paths** (46 tracked
  modifications + 91 untracked task-owned files), each with its content hash.
- Fingerprint including this receipt: `db77c954eacfc32475f00489d3b53ee731d1b4a0e90893dd419ffb54ea1b8966`.
  Adding the receipt changes no reviewed source, so the gate results below stand.
- Scope reviewed: uncommitted changes plus every task-owned untracked file.

## Gates on this exact tree

| Command                                        | Result                                      |
| ---------------------------------------------- | ------------------------------------------- |
| `npm run test:personal-plan`                   | 1977 passed, 0 failed                       |
| `npm run test:personal-plan:nested`            | 582 passed, 0 failed                        |
| `npm run test:playwright:personal-plan-stage3` | lab 6 passed, journey 22 passed (exit 0)    |
| `npm run ci:verify`                            | exit 0; 5 pre-existing lint warnings, 0 new |

## Product decisions taken during implementation

1. **Volume direction is inferred, not asked.** The released quiz aliases both
   "mehr Volumen" and "weniger Volumen" onto one `volume_balance` goal. Nick
   confirmed reusing the texture/thickness split Conditioner already applies.
   Extracted to `src/lib/personal-plan/volume-direction.ts` as the single source
   of truth, with a parity test over all 24 texture/thickness/definition
   combinations. Every inferred route carries
   `tools.styling.volume_direction_inferred` in its rule IDs.
2. **Drying textiles are a neutral group.** A fresh `hair-care-expert` pass on
   2026-08-21 found microfiber-vs-terry has only a plausible mechanism plus one
   weak study, and microfiber-vs-smooth-cotton-jersey is **unmeasured at every
   evidence tier**. AAD treats towel and T-shirt as interchangeable and ranks
   technique. Nick chose the neutral group: all three forms are named together and
   technique carries the guidance. `docs/personal-plan/categories/tools/evidence.md`
   now states that consensus and derives the deterministic rules from it, and
   records that circulating friction coefficients attributed to "AATCC TM222" are
   fabricated.
3. **Stage 3 has no selection state in Phase 1.** With no approved exact content,
   every route is either owned or an honest catalog gap, so there is nothing to
   commit. One full-width sticky action, no inline micro-CTA.
4. **The Tool trip is ordered but not required for completion**, so direct
   acceptance can finish while every Tool answer stays `unknown`. Once the
   overview _has_ been submitted, its product-form pages become required.

## Counterpart review — Codex, high effort

Verdict on the reviewed tree: **fixes required**, 12 findings. Eleven addressed,
one deliberately deferred.

| #   | Finding                                                                             | Resolution                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Direct-accept assumptions became Tool ownership                                     | Fixed. `ToolCareFacts` carries `provenance`; `assumed` projects to no inventory. Direct accept also now produces Tool routes at `unknown` instead of no Tools at all                                        |
| 2   | Overview persisted presentation keys; unchecked families never became `[]`          | Fixed. The answer is family-keyed (`toolFamiliesWithSomething`); submitting materializes every unchecked family as explicit `[]`; section keys are never persisted                                          |
| 3a  | Shared volume fulfilment did not suppress the peer                                  | Fixed. An owned viable route makes the peer a referenceable alternative, not a second basis need or a phantom card                                                                                          |
| 3b  | Cross-family physical asset identity                                                | **Deferred to Phase 2** — see below                                                                                                                                                                         |
| 4   | Tool steps ran after the finishing product; styling dropped on three wash-day types | Fixed. Non-nightly Tools are spliced before the first `finish` product; `STYLING_DAYS` now covers intensive-care, bond-repair and clarifying days                                                           |
| 5   | `Nichts davon` on page 2 wiped page-1 selections                                    | Fixed. The button is page-local and preserves forms from other pages                                                                                                                                        |
| 6   | Brush router violated B02, B04 and B05                                              | Fixed. B02's texture map drives the lead form; any reported brush suppresses another purchase (B04) without granting an unverified capability; B05 no longer treats rough _towel_ rubbing as a brush signal |
| 7   | Rollout-off deleted stored Tool answers                                             | Fixed. Off hides the trip; it never prunes stored facts                                                                                                                                                     |
| 8   | Required-only completion was not restricted to direct acceptance                    | Fixed. Once the overview is submitted, its pages are required                                                                                                                                               |
| 9   | Stage 3 rendered `unknown` as "Konkretes Produkt folgt"                             | Fixed. Each card renders its own state label                                                                                                                                                                |
| 10  | Tools-off view model was not byte-identical                                         | Fixed, and my earlier claim was wrong. Tool-only properties are now absent when off, not present-and-falsy                                                                                                  |
| 11  | Conditioner/Tool volume predicates could drift                                      | Fixed. One shared predicate plus an exhaustive parity test                                                                                                                                                  |
| 12  | The previous receipt was stale and internally inconsistent                          | This document replaces it                                                                                                                                                                                   |

Codex also confirmed the load-bearing invariants held: the closed care-product
enums are untouched, no `routinePayloadV1Schema.parse` consumer remains, durable
assets carry no cadence or commerce fields, the browser cannot self-enable Tools,
and no English or repair/growth claim appears in the German copy.

### Deliberately deferred: 3b, cross-family asset identity

Codex proposed a physical-identity layer able to consolidate one device across two
Tool families. In Phase 1 every recognizable form belongs to exactly one family,
and the multi-capability case that actually occurs — an air multi-styler serving
both `drying_standard` and `air_shaping_volume` — already resolves to one asset
because both routes are in `airflow`. Building a cross-family identity layer now
would be speculative abstraction for exact products that do not yet exist.
Recorded here as a Phase 2 prerequisite rather than silently dropped.

## Browser evidence

Driven against the worktree dev server via the dev-only `/labs/personal-plan-tools`
harness (404s outside `NODE_ENV=development`), at 320×700, 375×667, 390×844 and
1440×900:

- Zero horizontal overflow, zero broken images, zero missing alt text, zero
  console errors on all seven Tool surfaces at all four viewports.
- Stage 1: tier-local `Deine Tools` after the care-product cards; no price,
  cadence, availability or catalog disclaimer on a Tool card; no third page.
- Feinschliff: four large image sections, known answers preselected, `Nichts davon`
  explicit, at most four options per product-form page, brand and model never asked.
- Produkte: owned Tools lead with `Nutze deins`; unknown reads
  "Bestand im Feinschliff prüfen"; missing routes read "Konkretes Produkt folgt";
  towels render as one neutral group with the technique note; one sticky action.
- Routine: `Deine Tools` after every product section, one row per physical Tool,
  no depletion or reorder wording.
- Anwendung: Tools on the existing shelf, one image-led section per use in day
  order, unverified steps fail closed locally.
- Keyboard: every overview option plus `Nichts davon` reachable by Tab; Enter
  toggles `aria-pressed`. Reduced motion renders correctly. Safe-area padding present.
- Tools-off parity re-verified after the shape fix.

## Artifact disposition

**Commit:** the plan, handoff, mockup, this receipt, the six category-policy docs
(with the updated `evidence.md`), all `src/**` and `tests/**` Tool changes,
`public/images/personal-plan/tools/**` plus its README,
`scripts/generate-tool-placeholder-illustrations.mjs`, and the dev-only
`src/app/labs/personal-plan-tools/**` harness.

**Discarded:** scratchpad verification scripts and a temporary `.claude/launch.json`.

**Unresolved task-owned files:** none.

## Residual risk

- **Production art is not approved.** 50 labelled placeholder SVGs are in place
  with final slots and alt text. 14 approved photos already exist on branch
  `c1e04df3` at `public/images/tools/`, 11 of which map directly onto Phase-1
  product types; the archived style block and prompt set are in that branch's
  `plans/tool-bildkarten.md`. Roughly 31 images remain to be generated.
- **Rollout proven at `off` and `internal` only.** `all` was never activated, no
  migration applied, no catalog content published, no production state written.
- **Codex finding 3b** is an open Phase 2 prerequisite.
- **B05's "friction-heavy reported brush pattern" has no canonical input yet.**
  Only explicit `tangling` triggers the correction today; this is recorded in
  `routes.ts` where the missing input belongs.

## Review status of the fixes — OUTSTANDING

Codex reviewed the tree **before** the eleven fixes were written. Its manifest was
`0fdeddf084fe2e16eafad07678b9c0195f078da0f1440ad3d8e76a62b8ac8212`; the current
verified tree is `30be90779b8a5cb7955407d2428f47a24f4cc3a6a045aff81c6513acf75440a2`.

The fix delta is therefore **unreviewed by any counterpart**. It is not a small
delta, and it touches load-bearing seams:

- `ToolCareFacts.provenance` and the direct-acceptance path (finding 1)
- the family-keyed overview and its explicit-none materialization (finding 2)
- shared-volume peer suppression (finding 3a)
- Anwendung step splicing around the finishing product (finding 4)
- the B02/B04/B05 brush rules and the new `capabilityVerified` flag (finding 6)
- the required-question rule that gates Stage-2 completion (finding 8)

Per `request-code-review`, a fix that changes reviewed content stales the receipt
and requires a delta review of the changed content, its callers and its tests.
That pass has not been run.

## Bottom line

**Fixes required → applied, but not re-reviewed.** Every automated gate on
fingerprint `30be90779b8a5cb7955407d2428f47a24f4cc3a6a045aff81c6513acf75440a2` is
green and all twelve counterpart findings are resolved or explicitly deferred.
A counterpart delta review over the fix set remains outstanding before this branch
should be treated as ready to ship.

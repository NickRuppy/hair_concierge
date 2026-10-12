# Hair Tools Phase 1 — verification & review receipt

Supersedes the 2026-08-21 draft receipt, which was invalidated by the volume-rule
change and by the Codex review findings (Codex finding 12).

## Identity

- Worktree: `.worktrees/personal-plan-hair-tools-current-shape`
- Branch: `codex/personal-plan-hair-tools-current-shape`
- Commit under review: `c5da10580ccb6786ee22967e87fca82839f4f55e` (the only commit
  on this branch; nothing pushed)
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

**Three review lanes were dispatched over commit `c5da1058` on 2026-08-21:**

1. Codex counterpart delta review at `xhigh`, briefed on each of the twelve fixes
   and told to reuse its earlier conclusions on untouched code.
2. An adversarial lane scoped to the ownership-truth invariant alone, briefed to
   assume a sixth violation exists and hunt for it.
3. An adversarial lane scoped to deterministic-rule fidelity against
   `decision.md` and `conditional-guidance-matrix.md`, plus Anwendung step
   sequencing.

Both adversarial lanes were told explicitly that the implementation and its tests
share one author, so agreeing tests are not evidence.

Deliberate deviation, recorded rather than silent: `AGENTS.md` says to use exactly
one counterpart lane per review pass and not to stack Codex with other review
agents. Nick asked for both after the same author fixed five instances of one
invariant violation. Stacking here is his explicit call.

### Results — all three lanes reported 2026-08-21. Verdict: NOT MERGE-READY.

Every lane returned "fixes required". Findings below are consolidated and
deduplicated; the lane column shows independent confirmation. `codex` = counterpart
delta lane, `own` = ownership-truth adversarial lane, `rules` = rule-fidelity
adversarial lane, `self` = found by me while verifying a lane's claim.

#### Blocking — false ownership or a false need in front of the user

| #   | Defect                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Lanes              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| C1  | `assetFormsFor` re-sorts recommended forms into canonical family order, discarding the lead form the rules computed. Cascades into B02, W02, C02 and B09 violations — straight hair renders `Grobzinkiger Kamm` where B02 mandates `Detangling-Bürste`; the heated volume route renders `Lockenstab`, which H01 does not grant `create_volume`/`set_style`                                                                                                                                   | codex, rules, self |
| C2  | The overview materializes `[]` for un-ticked families, and that synthesized `explicit_none` **overrides genuinely reported care answers**. A user who reported blow-drying is told „Dafür fehlt dir noch ein passendes Tool". Root cause: `defaultToolSectionsFromCare`/`defaultToolFormsFromCare` have **no production call sites**, so nothing is preselected. Aggravated by `stage2.ts` copy promising „Was du auslässt, bleibt offen — wir behaupten nichts", which the code contradicts | codex, own, rules  |
| C3  | B04's purchase-suppression verdict is written onto an asset whose lead form the plan invented, producing „Nutze deins" for a form the user explicitly denied — persisted into the refined snapshot and the Routine V2 payload                                                                                                                                                                                                                                                                | codex, own         |
| C4  | With nothing reported, heated **and** heatless both emit `basis`: two Basis cards for one goal. `tools.styling.volume_basis` requires one shared choice counted once. `alternativeRouteKey` is written but no presentation layer reads it                                                                                                                                                                                                                                                    | codex, rules       |
| C5  | A user who reports owning Flexi-Rods gets `explicit_none` → „Konkretes Produkt folgt", because the recommend branch discards their reported form before the ownership match                                                                                                                                                                                                                                                                                                                  | rules              |

C4 and C5 are regressions introduced by the finding-3a fix in this same commit.

#### Blocking — availability and compatibility

| #   | Defect                                                                                                                                                                                                                                                                                                                                                                                 | Lanes |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| C6  | A **completed** Stage-2 draft can become unloadable after a rollout toggle. `createStage2RefinementSession` re-validates `isComplete` on every load; the finding-8 rule grows `requiredQuestionIds` once the overview was submitted, so a draft completed while Tools were off throws `incomplete_refinement` when they are switched on. `/plan-start` collapses that to "unavailable" | codex |
| C7  | No compatibility decoder for drafts persisted with the old `toolSections` key. They resume at a blank overview and can then be overwritten with materialized empty families                                                                                                                                                                                                            | codex |

#### High

- Reported `dryingRoutes` become a _verified_ `diffuse_airflow` capability — a behaviour answer laundered into a capability proof; the word „Diffusor" never reaches the user (rules)
- Recommended heated/heatless steps render with **zero instructions** and no heat-protection ordering; `capabilities[0]` is `create_volume`, which has no German copy. Safety-adjacent (rules)
- Night Protection always leads `pillowcase`; N02's reason-based form map is unimplemented (rules)
- A reported night soft-tie produces the duplicate Clips/Ties card fixture 74 forbids, at the wrong placement (rules)

#### Medium and below

Towel step lands after leave-in and heat protection, and `ToolPlacement` has no slot
between `condition` and `leave_in` (contract gap); B12 texture-aware detangle
placement unimplemented; plopping (fixtures 108-113), night continue-yours, refresh
spray bottle, root-volume clip, definition brush, pick and Stielkamm never
implemented; reported styling routes show no opposite-family alternative; a plain
Föhn counts as verified `air_shape`; „Nichts davon" renders as pressed on unseen
page 2 of a multi-page family; `conditionalReason` puts capability ahead of
ownership; `behavior_only` persists a false `explicit_none`; three invariant guards
(`isToolOwnershipResolved`, `normalizeToolInventory`, the preselect helpers) are
dead code; two divergent German label maps; `careProvenance` is a call parameter,
never a stored fact.

#### Open product decision — needed before the rules can be corrected

The volume-direction inference (texture/thickness) was Nick's explicit instruction,
but `conditional-guidance-matrix.md` H08 states: "Do not infer it from density,
thickness, texture, frizz, shine, `less_volume`." A **third** disambiguator already
ships in `src/lib/quiz/normalization.ts`, reads density as well, and disagrees — so
a wavy/normal-thickness profile is `less_volume` for the profile projection and
"wants more volume" for Tools. `volume-direction.ts`'s docstring claims this cannot
happen; that claim is false app-wide. Both lanes rate it high. Settle this first:
it determines what the styling rules should be before they are rewritten.

Related: `diffuser_or_airflow_shaping` merges two distinct spec triggers and the
code commits to the diffuser reading. Structurally the same question — one decision
should cover both.

#### What the lanes confirmed as correct

Direct-accept provenance holds — assumed facts project to no ownership, and
accepted plans keep every Tool state `unknown`. The page-2 „Nichts davon" fix,
rollout-off preservation, the Stage-3 state label and the Tools-off shape fix all
hold. `withToolSteps` index arithmetic is correct for no-finish, multiple-finish,
zero-product and Tool-only days; heat protection always precedes heated Tool use;
nightly is always last; styling day coverage is right. The closed care-product
enums, the Routine V1/V2 union and its readers, the durable-asset boundary and the
fail-closed rollout are all sound. The Phase-2 3b deferral was accepted. Codex
reviewed 136 changed paths at committed-delta fingerprint
`13df88951cd7336724d81994433077f75efd3d80e007801c27fcf1bfd86d139d`.

#### Why the test suite did not catch any of it

77/77 focused tests passed against every defect above. The lanes diagnosed why: the
"preselect" test asserts only the helpers' return values and never that the product
calls them; the volume parity test encodes the lossy inference rather than checking
it against the spec; B02 is tested at the route layer, before `assetFormsFor`
reorders it; `alternativeRouteKey` is asserted but never rendered; the B04 card test
uses a _matching_ reported form, so the substitution branch never executes. One
author wrote both the code and the tests, and the tests inherited the same
assumptions. Rule-by-rule fixtures keyed to the documented rule IDs would have
caught C1, C4, C5 and most of the High tier.

#### Also corrected by this pass

Codex flagged that `evidence.md` describes the Carvalho comparator as "terry
(looped bath towel)" when the paper says only "cotton towel" — my over-specification
of the single study. To be corrected with the other fixes.

## Bottom line

**NOT MERGE-READY.** Three independent review lanes over commit `c5da1058` each
returned "fixes required": seven blocking defects, four high, and a product decision
that must be settled before the styling rules can be corrected. Two of the blocking
defects were introduced by the fixes in this commit; two more (C6, C7) are
availability and compatibility problems that no automated gate can see.

The architecture held. The deterministic rule fidelity did not, and the test suite
blessed every defect. Next session: settle the volume-inference decision, then land
C1/C4/C5 (three small independent edits that clear five of the top eight), then C2/C3
together with the preselection wiring, then C6/C7, then re-review.

The paragraph below records the state as of the fixes, before those lanes reported.

**Fixes required → applied, but not re-reviewed.** Every automated gate on
fingerprint `30be90779b8a5cb7955407d2428f47a24f4cc3a6a045aff81c6513acf75440a2` is
green and all twelve counterpart findings are resolved or explicitly deferred.
A counterpart delta review over the fix set remains outstanding before this branch
should be treated as ready to ship.

---

## Addendum 2026-08-25 — remediation complete; this receipt is historical

Everything above describes commit `c5da1058` and its three-lane review. The
branch was subsequently remediated end-to-end and this receipt's "NOT
MERGE-READY" bottom line **no longer describes the tree**. The record of the
remediation — rulings D1–D9/R1–R4, workstreams WS0–WS7, two adversarial rounds
on the rule fidelity plus one on the remediation itself, the WS4 gate
clearances, the ready-check rulings, and the whole-branch Codex review with its
fix set — lives in `plans/2026-08-24-hair-tools-d1-d9-rulings.md`, which is the
authoritative status document for this branch. All seven blocking findings
above (C1–C7) are fixed and guarded by rendered-output tests; the fixture
oracle (`docs/personal-plan/categories/tools/fixtures.md` v3) is enforced by a
table-driven harness that parses the oracle at test time. Current suite state
at the time of this addendum: `test:personal-plan` 2139, `test:personal-plan:nested`
582, `ci:verify` clean.

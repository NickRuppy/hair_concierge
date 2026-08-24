# Hair Tools — spec hardening and remediation handoff

Status: **blocked on eight spec decisions.** Do not resume implementation before
the Decisions section is settled with Nick.

Branch `codex/personal-plan-hair-tools-current-shape`, commits `c5da1058`
(implementation) and `aa457023` (review verdict). Nothing pushed. Phase 1 is
feature-complete and **not merge-ready**: three independent review lanes returned
seven blocking defects, four high and a product decision. The full finding list
lives in `plans/2026-08-21-personal-plan-hair-tools-phase1-verification-receipt.md`
— this document is about _why_ they happened and what to fix first.

## Why this document exists

The findings are not mostly coding slips. Roughly two thirds trace to places where
the written spec did not actually decide something, so the implementer decided it
silently — and inconsistently across files. Fixing the code without fixing the spec
would reproduce the same class of defect.

Nick's read on 2026-08-21: the specs were hurried. Agreed.

## Root causes

**R1 — The spec is written against a quiz vocabulary that no longer ships.**
`decision.md` and the guidance matrix use `volume`, `less_volume`, `curl_definition`,
`blow_dry`, `blow_dry_diffuser`, `brush_type`, `styling_tools`. Production has
`volume_balance`, `shape_definition`, `dryingRoutes: [air_dry | ordinary_blow_dry |
diffuser_or_airflow_shaping]`, `additionalHeatTools`, `nightProtection`. There is no
authoritative mapping between them, so every single rule required the implementer to
invent a translation. Two of those inventions became blocking defects. This is the
largest single cause.

**R2 — 123 fixtures exist as prose; none is executable.** Rule IDs appear in the
spec and in `route.ruleIds`, but nothing asserts "this profile produces this rule ID
at this tier with this lead form". Every rule-fidelity defect survived a green suite.

**R3 — The spec names lead forms but never says where the lead is decided.** B02,
N02, W02 and C02 all specify which form leads. The implementation computed that in
`routes.ts` and then destroyed it in `assets.ts` by re-sorting into canonical family
order. No spec sentence was violated, because none existed.

**R4 — "One shared choice" has no representation.** `tools.styling.volume_basis`
requires one shared air/heated/heatless choice counted once. The contract only has
independent routes plus an `alternativeRouteKey` that no presentation layer reads, so
one need renders as two Basis cards.

**R5 — The spec uses one word for ownership and for coverage.** B04 says any
reported brush "suppresses another foundational recommendation" — that is _coverage_
(do we recommend acquiring?). The implementation expressed it as `owned_generic` —
that is _ownership_ (what did the user tell us?). Conflating them produced
„Nutze deins" for a form the user explicitly denied.

**R6 — Occurrence anchors do not match the real day sequence.** `ToolPlacement` has
five slots; a real wash day has roughly eight ordered positions. There is no slot
between `condition` and `leave_in`, so the towel step lands after leave-in and heat
protection. B12's texture-aware detangle timing has nowhere to live.

**R7 — Persisted-field and completion-semantics changes had no versioning
discipline.** A refinement answer key was renamed with no decoder, and the
completion predicate changed meaning for already-stored completed drafts. Result: a
completed journey can become unloadable after a rollout toggle.

## Decisions needed before any code (the gate)

Each needs an explicit ruling recorded in `decision.md` or the guidance matrix.

**D1 — Volume direction.** The quiz aliases both "mehr Volumen" and "weniger
Volumen" onto `volume_balance`. Nick instructed inferring direction from texture and
thickness. But H08 states: "Do not infer it from density, thickness, texture, frizz,
shine, `less_volume`." And a third disambiguator already ships in
`src/lib/quiz/normalization.ts` which also reads _density_ and disagrees — a
wavy/normal-thickness profile is `less_volume` there and "wants more volume" in
Tools. Options: (a) recommend nothing on the merged token, matching H08;
(b) keep the inference and amend H08, adopting `normalization.ts` as the single
predicate so all three agree; (c) restore directional intent at the quiz boundary.
This decision determines what the styling rules are, so it blocks WS2.

**D2 — `diffuser_or_airflow_shaping`.** One Feinschliff option covers two distinct
spec triggers (diffuser drying, and formender Luftstrom for volume). The code commits
to the diffuser reading unconditionally. Same shape as D1; decide both together.

**D3 — Feinschliff capture semantics.** Three things disagree today: `decision.md`
says the overview preserves all eight family names; the approved plan uses four
presentation sections; the on-screen copy promises „Was du auslässt, bleibt offen —
wir behaupten nichts" while the code writes explicit `[]` for un-ticked families.
Decide: section granularity, whether omission means unknown or none, and whether
known care answers preselect. The preselect helpers exist and are called by nothing.

**D4 — Split ownership from coverage.** Ratify two independent fields: what the user
reported, and whether the plan recommends acquiring anything. B04 sets coverage only.

**D5 — Shared choice groups.** Give "one shared choice counted once" a first-class
representation, and state how a group renders and how fulfilment is counted.

**D6 — Lead-form authority.** State that the route's form ordering is authoritative
and that every downstream dedup or projection must be order-stable.

**D7 — Canonical day anchor graph.** Define the wash-day position list once, shared
with the Application compiler, and place Tool occurrences into it.

**D8 — Versioning rule.** Any change to persisted refinement answers or to
completion semantics requires a path-version bump plus a decoder, and completed rows
must validate against their completion-time contract rather than today's.

## New spec artefacts to produce

1. **`docs/personal-plan/categories/tools/input-mapping.md`** — spec token →
   production field → exact allowed values → what information the production
   vocabulary loses, and the ruling for each loss. Closes R1.
2. **`docs/personal-plan/categories/tools/fixtures.md`** — one row per rule ID:
   concrete profile, expected tier, expected lead form, expected rule IDs. Becomes a
   table-driven test. Closes R2.
3. Amendments to `decision.md` and `conditional-guidance-matrix.md` recording D1-D8.

## Workstreams

Ordered by dependency. WS5 is independent and can start immediately.

| WS      | Scope                                                                                                                      | Depends on       |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| **WS0** | Spec hardening: D1-D8, the three artefacts above                                                                           | Nick             |
| **WS1** | Contract: coverage/ownership split, choice groups, order-stable dedup                                                      | WS0 D4-D6        |
| **WS2** | Rule fidelity: rewrite `routes.ts` + `assets.ts` against the fixture table                                                 | WS0, WS1         |
| **WS3** | Missing routes: plopping, night continue-yours, refresh spray bottle, root-volume clip, definition brush, pick, Stielkamm  | WS0              |
| **WS4** | Feinschliff capture: preselection wiring, `[]` semantics, page-2 „Nichts davon"                                            | WS0 D3           |
| **WS5** | Availability and compatibility: completed-draft loadability, old-key decoder, path versioning                              | none — start now |
| **WS6** | Anwendung sequencing: day anchor graph, towel placement, B12 timing, heated-tool instructions and heat-protection ordering | WS0 D7           |
| **WS7** | Hygiene: dead guards, duplicate label maps, persist `careProvenance`, `evidence.md` terry correction, regenerate receipt   | none             |

## Finding → workstream map

Nothing from the review may be dropped silently.

- C1 lead-form re-sort → WS1 (D6) + WS2
- C2 synthesized `[]` overrides reported answers; preselect dead → WS4 (D3)
- C3 B04 coverage laundered into ownership → WS1 (D4) + WS2
- C4 heated and heatless both Basis → WS1 (D5) + WS2
- C5 owned heatless reported as missing → WS2
- C6 completed draft unloadable after rollout toggle → **WS5**
- C7 no decoder for old `toolSections` key → **WS5**
- Diffuser capability unverified from a behaviour answer → WS2 (D2)
- Heated/heatless steps render no instructions; no heat-protection ordering → WS6
- Night Protection N02 form map absent → WS2
- Night soft-tie duplicate Clips/Ties card → WS2
- Towel step after leave-in; B12 timing → WS6 (D7)
- Reported styling route shows no opposite-family alternative → WS2
- Plain Föhn counted as verified `air_shape` → WS2
- Missing routes → WS3
- „Nichts davon" pressed on unseen page 2 → WS4
- `conditionalReason` precedence; `behavior_only` false `explicit_none` → WS1
- Dead guards, duplicate label maps, `careProvenance` not persisted → WS7
- `evidence.md` terry over-claim; stale receipt → WS7

## Test discipline change (non-negotiable for WS2)

77/77 focused tests passed against every defect above. Required changes:

- **Table-driven rule-ID fixtures** from the new `fixtures.md`. A rule is not
  implemented until its fixture row passes.
- **Assert the rendered output, not only the route.** C1 survived because B02 was
  tested at the route layer, before the projection reordered it.
- **A test that asserts call sites, not return values.** The preselect test proved
  the helpers compute correctly while the product never called them.
- **Never let one author's test be the only check on that author's rule.** Every
  rule-fidelity change goes through an adversarial lane briefed that agreeing tests
  are not evidence.

## Do not change — confirmed sound by all three lanes

Closed care-product enums untouched; Routine V1/V2 discriminated union and every
reader; durable-asset boundary (no cadence, reorder, commerce, acquisition);
fail-closed rollout gate; direct-accept provenance (`assumed` never becomes
ownership); `withToolSteps` index arithmetic; heat protection always precedes heated
Tool use; nightly always last; styling day coverage; the Phase-2 cross-family
identity deferral. Treat these as regression surface, not as work.

## Entry instructions for the next session

1. Read this document, then the verification receipt for the finding detail.
2. Run `branch-gate`. Reuse this worktree; the branch already carries both commits.
3. Enter `plan-hardening-loop` for WS0 — this is spec work, not implementation.
   Present D1-D8 as decisions with options and consequences; do not choose for Nick.
   `$wayfinder` is available if the decision map turns out to be more tangled than
   D1-D8 suggests.
4. WS5 may proceed in parallel: it is a correctness and data-availability fix that
   no spec decision blocks.
5. Only after WS0 is ratified: WS1 → WS2 → WS3/WS4/WS6 → WS7, each ending in
   `ready-check` plus one adversarial lane.
6. Images remain outstanding and orthogonal: ~31 to generate, 11 of 42 already exist
   on branch `c1e04df3` with the style block in its `plans/tool-bildkarten.md`.

## Standing stop contract

No push, no PR, no merge, no migration, no catalog publication, no rollout
activation without separate explicit authorization from Nick.

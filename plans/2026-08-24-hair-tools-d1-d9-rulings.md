# Hair Tools — D1–D9 rulings (2026-08-24)

Nick ruled on every gate decision from
`plans/2026-08-22-personal-plan-hair-tools-spec-hardening-handoff.md` in the
plan-hardening session of 2026-08-24. This ledger is the record of record until
the amendments land in `decision.md` and `conditional-guidance-matrix.md`; on
conflict, this file wins over both until those amendments are merged.

## D1 — Volume direction: option (b), ratified as-is

- `volume_balance` stays merged; direction is **inferred** in-plan. The shipped
  `src/lib/personal-plan/volume-direction.ts` predicate is the app-wide single
  source of truth, ratified exactly as implemented (curly/coily/coarse/
  definition-wavy → control; everything else → volume_up; no abstain state).
- `H08` is **amended** (recorded as a formal reversal of a confirmed decision):
  direction IS inferred from texture and thickness via this predicate and from
  nothing else. Every inferred route carries
  `tools.styling.volume_direction_inferred` and says so in its reason payload.
- The concern `low_volume_or_weighed_down` **triggers the volume routes on its
  own AND overrides the inference**: when present, direction is
  lighter/volume_up regardless of texture — explicit signal beats inference.
- Predicates 2 and 3 (`quiz/normalization.ts`, `offer-adapter.ts`) live
  upstream of the plan, read `density`, and are documented as a separate
  non-plan concern; aligning them is out of scope for Phase 1.
- Quiz-boundary split (option c) is queued as a separate later feature.

## D2 — `diffuser_or_airflow_shaping` and `dryingRoutes`

- **D2a (legacy reading): diffuser drying.** Few affected users; ruled
  explicitly. Consequences to reconcile in the matrix: `A11`'s diffuser tier
  (heat protection `not_needed`) applies to this source, so
  `heat-events.ts`'s Stage-2 heat-protection question for
  `diffuser_airflow_shaping` must align with the diffuser tier (reconcile with
  D9a; the A06 fix stands regardless — the answer never proves diffuser
  capability, `capabilityVerified` must NOT be set from it).
- **D2b (restructure): queued post-Phase-1.** Target design per research lane:
  option becomes „Mit Diffusor" (Untertitel „Aufsatz für Locken/Wellen");
  „Gewöhnlich föhnen" gets Untertitel „auch mit Rundbürste"; a follow-up
  question „Welche Temperaturstufe nutzt du meistens?" (Kalt / Mittel / Heiß)
  maps to heat-protection tiers not-needed / optional / empfohlen. Rides the D8
  versioning discipline. Warmluftbürste/Airstyler users remain captured by
  `additional_heat_tools`.
- **Mixed sets: every ticked route counts.** Each member triggers its own
  guidance; heat rules fire if any member carries heat. The "dominant drying
  method" concept is retired from the spec.
- **Empty set: remove „Nichts davon" from the drying question**, require ≥1
  selection (small UI change, goes through the WS4 mockup pass). Legacy stored
  `[]` is treated as unanswered — no drying-based assumptions.
- Evidence-honesty rule from the research lane: heat-protectant copy stays at
  „empfohlen/sinnvoll", never „nötig, sonst Schaden" (measured benefit exists
  only at flat-iron temperatures).

## D3 — Feinschliff capture semantics

- **D3a: unticked overview card = „hat nichts"** for every family behind it.
  No unknowns after submit. Made fair by wiring the existing preselect helpers
  (`defaultToolSectionsFromCare` / `defaultToolFormsFromCare`): everything the
  user's care answers imply comes pre-ticked. The lead copy is rewritten to
  say this honestly (current promise „Was du auslässt, bleibt offen — wir
  behaupten nichts" is replaced; copy goes through the WS4 mockup pass).
- **D3b: keep the four section cards.** `decision.md`'s eight-name overview
  description is corrected to match the approved four-card design.
- **D3c: merge per form, never replace per family.** An answered Tool page
  adds/confirms forms; care-derived facts survive unless explicitly
  contradicted. This precedence rule applies to all eight families, not just
  drying. Synthesized emptiness must never overwrite reported care answers.

## D4 — Ownership vs coverage: option (a) + derived marking

- Two independent facts on `PlanToolRoute`: `reportedOwnership` (written only
  from an actual user answer, or marked `derived` when projected from a care
  behaviour) and `coverage` (does the plan still recommend acquiring?).
- `B04` sets coverage only. „Nutze deins" is gated on reported/derived
  ownership of the actual form.
- **Card copy names THEIR tool**: Paddle-Bürste owner with Detangling-Bürste
  ideal sees „Nutze deine Paddle-Bürste" with guidance adapted to it; the ideal
  form may appear as an optional note, never as a purchase push while covered.
- Care-derived facts are kept (no new unknowns) but presentation may phrase
  them behaviourally („Du föhnst — nutze deinen Föhn"); terry-towel and
  `loose_tied` reports are stored as what the user actually said.

## D5 — Choice groups: first-class `ToolChoiceGroup`

- One card per need; members listed neutrally („Eine davon reicht: …");
  fulfilled when ANY member is covered; a reported member always leads (D4).
  Subsumes the ad-hoc neutral drying-textile group. Groups render with the
  lead member's ownership state; no partial fulfilment — one covered member
  fulfils the group.

## D6 — Lead-form authority: route order is binding

- The route's `recommendedProductTypes` order is authoritative; no downstream
  dedup, merge, or projection may reorder it. `assetFormsFor` preserves route
  order. Enforced by rendered-output tests per lead-form rule (fixtures 57,
  59b, 14, 81, 95, 96) plus an order-stability assertion in `buildToolPlan`.

## D7 — Day anchors: adopt `APPLICATION_SEQUENCE_ANCHORS`

- Tool occurrences anchor onto the shared nine-position wash-day graph;
  `ToolPlacement` is derived from it. Towel lands at `post_rinse_towel_dry`;
  `B12` detangle timing: conditioned wet/damp phase → `post_cleanse_rinse_off`,
  after partial drying → `post_rinse_towel_dry`; `A09` uses `dry_pre_heat` →
  `heat_tool`. `nightly` and `styling_session` are added as explicit members of
  the shared graph (kept ordered after `dry_finish`).

## D8 — Versioning rule: option (a), standing rule

- Any change to a persisted refinement answer key or to the meaning of the
  completion predicate requires a path-version bump plus a decoder; completed
  rows validate against their completion-time contract (WS5 already encoded
  the load-time half). Enforcement: a schema-snapshot test that fails when a
  persisted key is added, renamed, or removed without a version bump.

## D9a — Heat-protection coverage

- Source of truth: `heatEvents[…].protectionConsistency`, judged **per heat
  event**. Only `always` counts as covered; `sometimes` gets a consistency
  nudge (copy „mach's konsequent", tier „empfohlen"), `no`/`unsure` get the
  recommendation. The legacy `uses_heat_protection` boolean stays unread.
  Fixtures 122 and 123 are retired as impossible. `H15` is rewritten against
  the per-event field.

## D9b — „Nur Finger"

- The Bürsten & Kämme page gets an explicit „Nur Finger" non-product option
  now, while the feature is unshipped (no migration cost; D8 discipline
  applies to the answer shape). „Nichts davon" stops doing double duty; the
  finger exceptions in B01/B03/B04 become expressible. Card goes through the
  WS4 mockup pass.

## D9c — Manageability

- `manageability_styling` joins the Night-Protection trigger set (treated as
  frizz-adjacent, consistent with the rest of the app).

## Also to correct (no decision needed, ruled in handoff)

- Delete the `hair.surface` / `hair.elasticity` / `chemicalTreatments` input
  claims from `decision.md` (no rule reads them).
- `decision.md` eight-checkbox overview description → four section cards (D3b).
- `H12` four heatless form groups → five (`foam_roller`).
- `evidence.md` Carvalho comparator „terry (looped bath towel)" → „cotton
  towel" (WS7).

## Second-round rulings R1–R4 (2026-08-24, post-amendment)

Ruled by Nick after the amendment pass surfaced them:

- **R1 — Drop the legacy heat question now.** The Stage-2 heat-protection
  question for the `diffuser_airflow_shaping` source is removed (it contradicts
  the D2a diffuser tier `not_needed`). `protectionConsistency` becomes forbidden
  for that source. Per D8: path-version bump + decode rule — stored values for
  the source are ignored on read; rows completed under the old contract stay
  complete. Implementation lands with WS4.
- **R2 — Texture gate for definition paths.** The definition-driven diffuser
  path (`A03`) and the Definitionsbürste (`B09`) activate only for
  `wavy | curly | coily`. Straight + `shape_definition` activates no tool route
  from the definition goal (fixture 4b is the negative assertion).
- **R3 — Wildschweinborsten-Bürste is included.** `boar_bristle` joins the
  `brushes_combs` product types and the Feinschliff Bürsten-page. It exists in
  the legacy onboarding enum (`BRUSH_TYPES` in
  `src/lib/vocabulary/onboarding-care.ts`) and was silently dropped when the
  Tools form list was rebuilt — Nick ruled its restoration. Needs card image +
  copy in WS4; fixture 60 keeps its boar-bristle expectation.
- **R4 — Strong Nachtschutz tier reachable again.** `tools.night.optional_strong`
  triggers on `breakage` **or `split_ends`**, restoring reachability for V2
  profiles (fixture 15 gains the V2 variant).

Also resolved by the orchestrator as entailed (no new decision): fixture 7
rewritten as the control-direction negative (D1 makes its premise expressible
again); the residual `less_volume` clauses in `decision.md`/fixture 43 restated
against a control-resolved direction; fixture 60(b) `capabilityVerified=false`
confirmed as entailed by D4 + B04's own text; the „Nur Finger" persisted token
name and the deferred-fact marker on `PlanToolRoute` (fixture 114) are
implementation choices assigned to WS4 and WS1 respectively.

## WS4 planning gates — cleared 2026-08-25

Evidence review **confirmed** and user-journey sign-off **obtained** (Nick,
2026-08-25). Mockup evidence: `plans/mockups/ws4-2026-08-25/` (real components,
mobile viewport, DOM-level mockups on the labs harness).

- **Final overview lead copy (ratified):** „Wähle die Bereiche, aus denen du
  schon Produkte hast. Nicht gewählt = hast du nicht."
- Drying question: „Nichts davon" removed, ≥1 selection required
  (`drying-question-current.png` → `drying-question-proposed.png`).
- Bürsten-page: „Wildschweinborsten-Bürste" + „Nur Finger" cards added
  (`brushes-page-new-cards-viewport.png`). Implementation notes: the long
  label collides with the selection circle in the current card layout — WS4
  must fix label wrapping; both cards need Bildkarten-pipeline images.
- Signed-off journey (6 steps): resume-safe entry; 3-option forced-pick drying
  question; heat question dropped for pure-diffuser users (R1), kept per event
  otherwise; overview with care-answer preselection + the ratified copy,
  unticked persisted as „hat nichts"; drilldowns merge-never-delete with the
  two new brush cards; plan renders per D4–D7.

## WS2 completion + flag dispositions (2026-08-25)

WS2 (rule fidelity) landed: table-driven fixture harness
(`tests/personal-plan-tools-fixtures.test.ts`) with a 128-row coverage guard;
2078 + 582 tests green. Orchestrator dispositions of WS2's flags:

- **Fixtures 35/47 (three volume members at once):** owner **WS4** — needs the
  group-aware one-card Stage-1 projection (part of the signed-off journey);
  until then air-shaping `basis` suppresses the peers to avoid three basis
  cards for one need.
- **Fixture 12:** contradiction resolved in the row (coverage of a set-parent
  unlocks securing support; ownership never bypasses the mechanism).
- **Fixture 49:** tier clarified to `basis` + `covered_by_report`.
- **Fixture 98 (N03 alternative):** rule specified (first functionally
  different form in route order renders as the „Alternative:" line); owner
  **WS3**.
- **Fixture 114 (deferredFacts Stage-1 card):** owner **WS4** (mockup gate).
- **`fingers` persistence half** (answers schema + question path): owner
  **WS4**, with the D8 path-version bump.
- **Securing set-parent reads heatless only** (C01 says heated/heatless):
  owner **WS3** — add the heated-set parent with its own fixture.
- API change accepted: `buildToolPlan` no longer takes `inventory`; routes'
  `reportedOwnership` is the single source of reported forms (fixes the
  Kissenbezug-lead defect, fixtures 74/102).
- Merge refinements recorded in `decision.md` D3c: behaviour stand-ins
  superseded by the user's own family answer; explicit family-wide „Nichts
  davon" beats projections.

## Adversarial lane verdict on WS1+WS2 (2026-08-25): REFUTED — remediation open

The independent adversarial lane refuted "the rules now match the spec".
Accepted findings and dispositions:

- **Process defect (orchestrator):** fixture dispositions for rows 12/49/98
  were committed inside WS2's implementation commit — an oracle edited beside
  the code it judges. Standing rule from now on: **oracle edits always land in
  their own docs-only commit, never mixed with implementation.** Row 12's
  self-contradictory tail is fixed.
- **Provenance per-source bug (blocker):** named care answers
  (`additionalHeatTools`, `nightProtection`, `towel.*`) were stamped `derived`.
  Clarified in `decision.md` D4: provenance follows what the answer is, not the
  store; only behaviour projections are derived. Remediation: fix
  `provenanceFor`, assert provenance on fixtures 15/19/42/45/95/96/97/100.
- **Volume group (blocker):** all three `volume_set` members must be emitted
  (air-shaping basis no longer deletes peers) — fixtures 35/36/47 at
  route+group layer are WS2-remediation scope; the one-card group-aware
  Stage-1 projection is pulled into remediation too (its journey is already
  signed off). New `fulfilledBy` rule in `decision.md` D5: requires
  `capabilityVerified` — an unvouched plain Föhn never fulfils the group.
- **C01 heated-set securing parent (should-fix):** implement heated+heatless;
  new fixture 127.
- **W02 scalp brush (should-fix):** must never lead or fulfil targeted
  application; new fixture 128.
- **Harness hardening (should-fix):** add the omitted assertions (34/36 group
  membership + per-member rule IDs, 49 coverage.state, A-x2 representability
  note, 31 block-exactness); replace the constant-expression coverage guard
  with one that parses live fixture ids from fixtures.md.
- **Nits accepted:** per-form reported-use rule IDs (multi-styler = both jobs,
  single-job forms = one); false `fingers` comment in facts.ts; routes.ts to
  call `volumeDirectionInputFor` instead of hand-rolling it.
- **Noted, not remediation:** N01-vs-B05 friction asymmetry (oracle-blessed;
  revisit in WS7); fixture 75 merge-of-one (WS3, together with restoring the
  C01 night parent without re-creating the fixture-74 duplicate);
  `normalizeToolInventory` uncalled (WS4 capture page).
- Vectors that held: Conditioner parity, contract invariants (40k-profile
  sample, 0 throws), regression surface, API changes.

## Workstream unblocking

- WS5 done and committed (`ca81dec0`), verified 1983/1983.
- All of WS1 (D4–D6), WS2 (D1/D2 + fixtures), WS3, WS4 (D3), WS6 (D7), WS7 are
  now unblocked, in the dependency order the handoff defines.
- User-facing gates still apply per workstream: WS4's copy/option changes and
  any Stage-1 card changes need mockup review + journey sign-off before
  implementation.

## Counterpart-review reconciliation — findings ledger (2026-08-25)

A counterpart review at content head `bec59a41` raised 37 findings against the
four spec documents. Each was verified by the orchestrator, dictated as a
disposition, and applied on 2026-08-25 to `decision.md`,
`conditional-guidance-matrix.md`, `fixtures.md` and `input-mapping.md`. No code
was changed. One row per finding:

| # | Disposition |
| --- | --- |
| 1 | accepted-fixed — `tools.airflow.optional_goal` carries the `R2` texture gate on its **definition disjunct** (the volume disjunct stays ungated, or fixture 48 would die); decision.md fixture 4 gains the gate and names 4b as the negative |
| 2 | accepted-fixed — decision.md fixture 66 (Definitionsbürste) gains the `R2` gate |
| 3 | accepted-fixed — decision.md fixture entries 6, 34, 47, 48, 55, 67, 73 restated as `volume_balance` + resolved direction (`D1` inference, `low_volume_or_weighed_down` trigger/override) |
| 4 | accepted-fixed — matrix rows `tools.heated.volume_set`, `tools.heatless.volume_set`, `tools.brush.manual_air_shape`, `tools.brush.pick_optional` restated; the Pick trigger is `low_volume_or_weighed_down` + curly/coily only |
| 5 | accepted-fixed — decision-log `H08` → `confirmed, reversed 2026-08-24`, pointing at the new `H08` text |
| 6 | accepted-fixed — decision-log `H12` → `confirmed, amended 2026-08-24`, five heatless groups named |
| 7 | accepted-fixed — decision-log `H15` → `confirmed, reversed 2026-08-24` (`D9a`), per-event `protectionConsistency`, only `always` covers |
| 8 | accepted-fixed — input-mapping heat-event schema and diffuser rows carry `R1`: `protectionConsistency` forbidden for `diffuser_airflow_shaping`, stored values ignored on read, path-version bump + decode rule, completed rows stay complete |
| 9 | accepted-fixed — fixture 40 rewritten: `protectionConsistency` only on non-diffuser sources; the diffuser source raises no question and legacy values are ignored |
| 10 | accepted-fixed — input-mapping `curl_definition` row records the `R2` gate; "must gain the gate or accept straight activation" language removed |
| 11 | accepted-fixed — fixture 4 premise gains `wavy \| curly \| coily`, 4b is the straight negative, post-ruling delta says RULED |
| 12 | accepted-fixed — input-mapping brush taxonomy and §S4 record `boar_bristle` as a shipped `brushes_combs` product type (`R3`) |
| 13 | accepted-fixed — decision.md V1 charter lists Wildschweinborsten-Bürste among the recognizable brush forms |
| 14 | accepted-fixed — fixtures.md post-ruling delta: `boar_bristle` now has a production form, so fixture 60 variant (c) is executable |
| 15 | accepted-fixed — input-mapping breakage row, divergence 6 and the status paragraph record `R4` (`optional_strong` extends to `split_ends`); the accept-or-extend status is gone |
| 16 | accepted-fixed — decision.md `D7` anchor table corrected: the towel/drying-textile occurrence anchors at `post_rinse_towel_dry`; `T05` plopping sits after `damp_leave_on` and before the drying occurrence, matching matrix `T05` and fixture 112 |
| 17 | **accepted-fixed, flagged** — fixture 4's ownership is no longer a plain `explicit_none`. The literal "derived marking convention" could not be applied: `contracts.ts` forbids a provenance on `unknown`, and the `D4` standing note forbids `explicit_none` for derivation 2. Recorded as `unknown` (`provenance: null`) with the air-dry answer stored as the behaviour it is and the consequence on `coverage`; the standing note was extended to say this explicitly. Needs a confirming look |
| 18 | accepted-fixed — fixture 32's ownership carries the `(derived)` marking |
| 19 | accepted-fixed — fixtures 22, 36, 49, 119 are executable as written; the required inputs moved into the Input cells and the Notes no longer instruct the implementer |
| 20 | accepted-fixed — fixtures 35, 36, 47, 48 carry exact per-member rule-ID sets (a `ToolChoiceGroup` has no rule-ID field, so the exact set is asserted per member route). Derived, not quoted: on fixture 48 the air-shaping member reaches only `optional`, so it carries `tools.airflow.optional_goal` + `tools.styling.volume_direction_inferred` and **not** `tools.styling.volume_basis` |
| 21 | accepted-fixed — new fixture **124** `tools-onboarding-merge-per-form`; decision.md's `D4` section states that provenance records the stronger `reported` and forms are the union |
| 22 | accepted-fixed — new fixture **125** (legacy diffuser `protectionConsistency` ignored, row still complete) plus §10 item 6, the `D8` schema-snapshot test that fails the build on an unbumped key change |
| 23 | accepted-fixed — token fixed as `fingers` in decision.md (`D9b`), input-mapping and fixtures 10, 11, 56, 64; placeholder language removed. Flagged: the ruling fixes the **token**, so the fixtures state the reported set and `forms: []` and do **not** assert a route-level `reportedOwnership.state` for a fingers-only answer — that state was not ruled |
| 24 | accepted-fixed — new fixture **126** `tools-night-manageability-trigger`: `optional` on `night_protection`, exact set `{tools.night.optional_other}`, `N02` lead `pillowcase` |
| 25 | accepted-fixed — decision.md `D4` carries the transcribed `reportedOwnership` / `coverage` shapes and the `behavior_only` invariant; fixture notation aligned to those domains (including fixtures 74/102, where `derived` was written as if it were a state) |
| 26 | accepted-fixed — the first-eligible-reported-form rule is written into `D4`. **Fixture 9 cross-check: consistent, no contradiction.** For a straight profile the foundation order is `detangling_brush, wide_tooth_comb, paddle_brush`; the reported `paddle_brush` is eligible and leads, the reported `round_brush` is not a foundation form and acts through coverage only |
| 27 | accepted-fixed — decision.md `D5` carries the transcribed `ToolChoiceGroup` contract, its member lists and the one-group-per-route invariant |
| 28 | accepted-fixed — `D5` lead rule written: `fulfilledBy` leads, `null` renders neutral with no ownership claim, report > derived > selection, ties by member order |
| 29 | accepted-fixed — `D5`/`D6` precedence written: group-level lead selection never reorders a route; inside a route reported forms lead by filtering, subsequence invariant preserved |
| 30 | accepted-fixed — `D6` merged-order rule written from `assets.ts`: merge only on identical family **and** lead form, first-emitted route's order is the base, first-occurrence dedup, fixed builder emission order |
| 31 | accepted-fixed — every `59b` reference now reads "fixture 59 variant (b)" (decision.md ×2, fixtures.md §10, input-mapping §3) |
| 32 | accepted-fixed — `C02`'s rendered-order fixture is the existing **fixture 75**; no row invented. It is named in the `D6` enforcement list, in input-mapping and in §10 item 3, and its row now demands the rendered `ToolAsset.productTypes[0]` |
| 33 | accepted-fixed — the graph is named the **extended 11-position graph** consistently (nine anchors + `styling_session` + `nightly`, nightly always last) |
| 34 | accepted-fixed — the anchor → `ToolPlacement` derivation table is in `D7` |
| 35 | accepted-fixed — `A09` session contract stated: one shared session key, one cadence, ordering from the graph, WS6 implements the key — and nothing beyond that |
| 36 | accepted-fixed — the ratified `D3a` copy („Wähle die Bereiche, aus denen du schon Produkte hast. Nicht gewählt = hast du nicht.") replaces the draft in decision.md (§`D3a` and the three status lines) and in input-mapping's mirror row; "pending WS4 review" removed, implementation-pending kept |
| 37 | accepted-fixed — matrix Current checkpoint records the WS4 mockup pass and journey sign-off as DONE (2026-08-25) with WS4 implementation outstanding |

Document versions after the pass: `decision.md` **v4**, `conditional-guidance-matrix.md`
**v3**, `fixtures.md` **v3**, `input-mapping.md` **v3**, all `last_updated 2026-08-25`.

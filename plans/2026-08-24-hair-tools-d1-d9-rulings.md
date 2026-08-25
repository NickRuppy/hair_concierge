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

## Workstream unblocking

- WS5 done and committed (`ca81dec0`), verified 1983/1983.
- All of WS1 (D4–D6), WS2 (D1/D2 + fixtures), WS3, WS4 (D3), WS6 (D7), WS7 are
  now unblocked, in the dependency order the handoff defines.
- User-facing gates still apply per workstream: WS4's copy/option changes and
  any Stage-1 card changes need mockup review + journey sign-off before
  implementation.

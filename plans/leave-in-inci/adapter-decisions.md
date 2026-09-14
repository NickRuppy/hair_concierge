# Leave-In Production Adapter — Ruled Decisions

Rulings by Nick, 2026-09-12 (chat). These resolve the two adapter decisions parked in the standard's §10.4 ("Boundary with the live catalog") and §17 item 17. They govern the future integration contract + production adapter (`projectLeaveInForProduction`), not the research standard itself — no classification rule changes.

## AD-1 — Format: one shared enum, no mapping layer

**Ruling:** "Can we harmonize this? Unless there's good reason, I don't want separate formats and unnecessary mapping."

**Resolution:** Already harmonized — no work needed beyond declaring it. Since T10/T11, the research `product_form` is the presentation form `spray | milk | lotion | cream | serum` (standard line 1142, §10.1), captured at identity. That is **identical** to the DB enum on `product_leave_in_specs.format`. The old gap ("DB lacks `two_phase`") was resolved on the research side by T10/T11: `two_phase` is an architecture *reading convention*, trace-only, never a format value. The adapter projects `product_form` → `format` 1:1 with no mapping table. The only research-side extra member is `unknown`, which AD-2 keeps out of the DB entirely.

**Consequence:** the integration contract declares `format` as a shared enum, and any future member added on either side must be added on both (single-enum invariant).

## AD-2 — No `unknown` reaches the catalog: unresolved products don't commit

**Ruling:** "I don't want unknown properties. I think we should commit clearly."

**Resolution:** conditioner parity. Research records keep `unknown` as an honest internal abstention (v0.2 DL defect register rationale stands — research uncertainty stays internal, per standing product philosophy). The **adapter refuses projection** for any product whose projected fields carry `unknown`: status `needs_research`, product stays in the research queue until the gap is resolved, exactly as `projectConditionerForProduction` does. No DB column ever receives `unknown`, no default is silently substituted, no partial row is written. A product commits clearly or not at all.

**Consequence:** the projection's `needs_research` reasons must name the exact unknown field(s) so the rework queue is actionable.

## AD-3 — `roles[]` derivation (ruled 2026-09-14: "go with your recommendations")

No new research fields. Derivation, deterministic:
- `replacement_conditioner` iff AD-4 yields `replacement_capable`; otherwise `extension_conditioner` (exactly one of the two, so min-1 always holds).
- `styling_prep` added when `hold_support ≠ none` OR `application_stage ∋ pre_heat`.
- `oil_replacement`: never emitted by this adapter (oil category's own domain).
- `heat_activation_required`: always `false` (no research source; DB CHECK satisfied since we never claim activation).

## AD-4 — `conditioner_relationship` (ruled 2026-09-14)

`replacement_capable` iff `conditioning_level ∈ {moderate, high}` AND `persistence ∈ {moderate, high}`; else `booster_only`. Deterministic from already-scored fields.

## AD-5 — eligibility emission (ruled 2026-09-14)

Shampoo rule: only `hair_thickness_fit = recommended` thicknesses produce `product_leave_in_eligibility` rows and enter `products.suitable_thicknesses`; `conditional`/`caution` fits are named in `field_rationales` and the projection summary, never written to the matcher. An empty recommended set → `needs_research` (conservative, AD-2 shape).

## AD-6 — `heat_protection_max_c` cutover (ruled 2026-09-14)

The adapter writes `heat_protection_max_c: null` always (§13.3). The degree-logic removal (selection.ts ≥220 bonus + German copy + catalog-facts/application readers + migration nulling legacy values) ships as its OWN small PR immediately after the adapter PR and MUST land before the first catalog apply of researched products — otherwise researched rows are outranked on heat by legacy heuristics.

## AD-3a — `care_benefits[]` derivation detail (implementation default under AD-3's authority)

specs.care_benefits ∪= focus routes (primary+secondary: smoothing→anti_frizz, detangling→detangling, curl_definition→curl_definition, repair→repair, shine→shine, heat_styling→(none — heat is not a care_benefit), volume_lightness→volume) + care_direction moisture→moisture / protein→protein (balanced adds none) + repair_support_level ≥ medium→repair + smoothing_route ∈ {silicone_film, cationic_alignment} present→anti_frizz. Empty after all rules → `needs_research` naming the gap. fit_specs.care_benefits (4-value vocab): provides_heat_protection→heat_protect, focus curl_definition→curl_definition, repair_support_level ≥ medium or focus repair→repair, focus detangling or smoothing→detangle_smooth. functional_benefits per the study's mapping (moisture_softness from care_direction=moisture or conditioning_level ≥ moderate).

## Context rulings (same session)

- 2026-09-12: the approved calibration set (11 in-category products) graduates to catalog data via the established intake flow (research envelope → production adapter → Product Intake → guarded RPC with Nick's explicit `--apply --confirm`). The §19 research-only wall is lifted **only** through that flow, only for Lab-approved records.
- Sequencing: adapter stack is built after the unseen-product test freezes v1.0 (no projection against a moving standard).

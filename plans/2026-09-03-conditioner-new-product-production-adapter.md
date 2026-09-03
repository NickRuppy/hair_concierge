# Conditioner new-product research and production adapter

Status: approved for implementation on 2026-09-03.

## Implementation contract

- **Outcome:** one previously unknown German/EU rinse-out Conditioner is researched once with the locked Conditioner Standard v1.6, the complete research record is retained, and a versioned adapter deterministically projects only the fields supported by today's Product Intake schema.
- **Constraints:** the full research profile remains the authority; the projection is derived and lossy; no current catalog value may influence the research result; application protocols remain source-derived rather than INCI-derived; uncertainty stays visible; Product Intake review and publish approval remain separate.
- **Non-goals:** production schema expansion, automatic publication, Supabase writes, catalog backfill, Personal Plan matching changes, or a redesign of the Product Intake review UI.
- **Done when:** the adapter validates the complete research envelope, projects the exact current Conditioner tables, preserves the research artifact and mapping warnings, the Product Intake worker requires and applies the adapter for Conditioner jobs, a local replay command exists, and focused tests plus repository checks pass.

## Chosen architecture

Use three explicit layers:

1. `conditioner-research-envelope-v1.6` owns exact identity/formula provenance and the complete nine-property research profile.
2. `conditioner-production-adapter-v1` is a pure, deterministic, one-way projection into today's Conditioner intake fields.
3. Product Intake stores the full envelope in a `property_synthesis` research artifact and shows the adapter output in the ordinary database-field review rows.

The adapter never reconstructs research truth from production rows. A later schema expansion consumes the retained envelope through a new adapter version instead of repeating the ingredient research.

## Current projection

| Research authority | Current output |
| --- | --- |
| `weight_potential` | `product_conditioner_rerank_specs.weight`: low/light, moderate/medium, high/rich |
| `repair_support_level` | `product_conditioner_rerank_specs.repair_level` |
| `care_direction` | `balance_direction` and the current compatibility value: moisture/snaps, balanced/stretches_bounces, protein/stretches_stays |
| `hair_thickness_fit` | `products.suitable_thicknesses` and one compatibility row per thickness; research `medium` normalizes to production `normal` |
| normalized INCI | deterministic `ingredient_flags` |
| authoritative use directions | existing `conditioner_rinse_out` protocol contract; not produced by the INCI adapter |

The adapter records `conditioning_level`, `primary_focus`, `secondary_focus`, `damage_fit`, and `texture_fit` as deliberately omitted from v1 production output. It retains them unchanged in the research envelope.

## Operator journey

1. A new Conditioner submission enters Product Intake and duplicate/identity research runs first.
2. The worker follows Conditioner Standard v1.6 and emits one complete research envelope in the `property_synthesis` artifact.
3. The worker validates the envelope, binds its research ID to the Product Intake submission, and applies the production adapter; handwritten Conditioner eligibility/rerank rows from the model are replaced by the adapter projection.
4. Product Intake retains the full research envelope and projection metadata while its existing property review shows the exact current database values and adapter-backed rationales.
5. Uncertainty in a currently mapped field is surfaced as a projection warning for review. Structural, identity, formula, or missing-envelope defects block the research job.
6. Exact manufacturer directions still supply the `conditioner_rinse_out` protocol. Research completion does not approve or publish the product.
7. Nick can approve or request rework using the existing Product Intake controls. Final database/image handoff remains separately guarded.

Operator-journey sign-off: confirmed by Nick on 2026-09-03 through the instruction to build the adapter after affirming the full-research-then-current-output process. No end-user surface changes.

## Ordered implementation

1. Add failing adapter contract and Product Intake integration tests.
2. Implement the strict research envelope and deterministic adapter.
3. Implement filesystem-only single-product replay output.
4. Require the v1.6 envelope in Conditioner Product Intake prompt packets and apply the adapter before payload validation.
5. Synchronize Conditioner integration/runbook guidance and Product Intake operations guidance.
6. Run focused tests, ready-check, and whole-branch review; stop before publication.

## Verification

- Red/green tests for all care-direction, thickness, weight, repair, ingredient-flag, uncertainty, excluded-boundary, malformed-envelope, raw-INCI hash, normalized-sequence, and formula-fingerprint branches.
- Integration test proving model-written Conditioner rows are replaced by the deterministic projection while the exact research envelope is retained.
- CLI test proving stable output and refusal to overwrite a non-empty directory without explicit opt-in.
- Product Intake worker/prompt contract tests.
- Typecheck, lint, and the relevant Product Intake/Conditioner suites.

## Planning evidence

- The already-reviewed Conditioner Lab is the evidence pattern for the full nine-property research reasoning.
- The existing Product Intake review surface and guarded handoff remain unchanged.
- The implementation adds a backend/operator contract and uses the existing artifact and property-row surfaces; therefore no new user-facing mockup is required for this slice.

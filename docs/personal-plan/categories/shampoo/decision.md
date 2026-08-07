---
category: shampoo
document_type: decision
status: confirmed
decision_version: 3
last_reviewed_at: 2026-08-07
current_runtime_revision_reviewed: 0007e10d852004a6fb18f86e76afd7591fba435d
evidence_file: docs/personal-plan/categories/shampoo/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/shampoo.ts
test_surface: tests/personal-plan/categories/shampoo.test.ts
---

# Personal Plan Shampoo decision

## Authority and checkpoint status

This document is the self-contained confirmed product specification for Shampoo. The shared computation specification may summarize Shampoo where it connects to portfolio-wide mechanics, but it does not replace this category authority.

External evidence remains in `evidence.md`. Existing CareBalance, recommendation, Routine, Chat, and lossy offer-projection behavior are prior art only. After implementation, the Personal Plan Shampoo module, deterministic tests, and verified catalog/protocol data become executable authority.

## Intended user decision

The Personal Plan must tell the user:

- why Shampoo is always `basis`;
- which everyday and, when applicable, dandruff-control jobs must be covered;
- the total wet-wash cadence without letting product allocation add wash events;
- whether each exact owned or pending Shampoo fits each required role;
- which verified exact product fills every uncovered role;
- how confirmed products divide the total cadence;
- how each exact product is applied, checked, maintained, or escalated safely.

## Charter and boundaries

Shampoo owns routine scalp/hair cleansing and the targeted cosmetic dandruff-control role when that role is explicitly triggered.

It does not own:

- Deep Cleansing, which substitutes for a normal Shampoo on a qualifying Reset wash;
- Dry Shampoo bridge use, which never counts as wet cleansing;
- scalp Peeling, leave-on scalp treatment, or hair-loss treatment;
- diagnosis of dandruff, dermatitis, eczema, psoriasis, allergy, or infection;
- Conditioner, Mask, Leave-in, Oil, Bondbuilder, or Styling jobs;
- a universal treatment frequency, duration, or contact time independent of an exact verified product protocol.

## Current-behavior treatment ledger

| Area | Current truth | Treatment | Gap/dependency |
|---|---|---|---|
| Paid quiz | Preserves `scalpOiliness`, multi-select `scalpConcerns[]`, profile, and goals, but not current Shampoo frequency | `reuse` for the initial plan | The initial plan may derive a scalp-led starting target; the page-level quiz framing explains its preliminary source once, while current behavior is collected afterward |
| Offer projection | Collapses scalp concerns into one legacy condition | `reject` as authority | Never discard a selected specific concern |
| Shampoo bucket derivation | Contains useful oily/balanced/dry/dandruff/irritation routes | `adapt` | Reconcile `dry_dandruff` as gentle dry-scalp care, not automatic targeted dandruff |
| Existing catalog specs | Provide category route, thickness suitability, lifecycle, and shared product facts | `reuse/adapt` | Exact targeted-product protocols remain incomplete |
| `schuppen` cohort | Current active rows have reviewed claim/active evidence | `reuse` as an evidence-gated invariant | Intake review owns ongoing formula/claim verification |
| Legacy cadence helpers | Contain useful scalp-led frequency bands | `adapt` into the plan-owned category module | Product ownership, goals, or category count cannot change the band |
| Existing exact-product selection | Supplies useful filters and stable ordering | `adapt` | Personal Plan must expose role-relative fit and honest no-match states |
| Routine/Chat guidance | Contains application and escalation prior art | `adapt` only where confirmed here | It cannot become a second plan authority |

## Inputs and missing-data behavior

Stage 1 consumes:

- canonical `scalpOiliness`;
- complete multi-select `scalpConcerns[]`;
- profile/treatment facts needed for gentleness and compatibility;
- current Shampoo ownership only for later reconciliation, never for need.

Post-plan onboarding additionally supplies current Shampoo frequency, including explicit `does_not_wash`. Stage 2 also consumes exact product identity/pending state, lifecycle, category route, verified thickness suitability, safety/exclusions, price/budget, availability, and verified application protocol.

An explicitly empty `scalpConcerns[]` is valid. Missing `scalpOiliness` or missing `scalpConcerns` returns a typed incomplete-source error rather than a guessed route. For the immediate paid result, missing current frequency is expected: emit the preferred scalp-led target as `quiz_starting_target`. The Stage-1 page lead states once that the initial plan comes from the quiz; the Shampoo card does not repeat a preliminary disclaimer. After post-plan onboarding, current frequency becomes mandatory for the refined comparison; if it is still absent, return a typed clarification requirement. Generic goals or concerns may improve explanation but never override a specific scalp answer, create a dandruff role, or change numerical cadence.

## Stage 1 — need, roles, target, and cadence

Shampoo is `basis` for every Personal Plan. Product ownership never changes that need.

### Role and concern rules

| Rule ID | Canonical condition | Output | Decisive reason fact |
|---|---|---|---|
| `shampoo.inclusion.basis` | Every valid Personal Plan | Include Shampoo as `basis` | regular wet cleansing is required |
| `shampoo.concern.specific_wins` | Generic and specific scalp signals coexist | Use all selected specific `scalpConcerns[]` | exact selected concern |
| `shampoo.role.everyday` | Every user | Create `shampoo_everyday` | scalp-led everyday cleansing route |
| `shampoo.role.dandruff` | `oily_dandruff` selected | Add `shampoo_dandruff` | targeted dandruff concern |
| `shampoo.role.dry_flakes` | `dry_dandruff` without targeted dandruff | Keep gentle, non-medicated dry-scalp-compatible everyday role | dry-flake answer |
| `shampoo.role.irritated` | `irritated` selected | Add the strictest irritation-compatible everyday constraints | irritation answer |
| `shampoo.role.product_reuse` | One verified product safely satisfies several roles | Reuse it across those roles | verified multi-role coverage |

Combination behavior is compositional:

- `oily_dandruff + irritated`: targeted dandruff role plus irritation-compatible product constraints;
- `dry_dandruff + irritated`: one stricter gentle everyday role may cover both;
- `oily_dandruff + dry_dandruff`: targeted role plus a gentle dry-scalp everyday role when one product cannot cover both;
- all three: retain the targeted role, dry-scalp constraint, and irritation safety constraint.

Dry flakes or irritation alone never create `shampoo_dandruff`. Ingredient presence alone never creates a treatment-capable role.

### Total wet-wash cadence

| Scalp route | Preferred target | Allowed range |
|---|---|---|
| oily | `weekly_3_4x` | `weekly_2x` to `weekly_5_6x` |
| balanced | `weekly_2x` | `weekly_1x` to `weekly_3_4x` |
| dry | `weekly_1x` | `biweekly_1x` to `weekly_1x` |

Cadence rules:

| Rule ID | Condition | Output |
|---|---|---|
| `shampoo.cadence.quiz_starting_target` | Initial paid result has valid scalp inputs and current frequency is not collected yet | Emit the scalp route's preferred target; preserve the internal mode for audit while the Stage-1 page lead supplies the one user-facing quiz label |
| `shampoo.cadence.retain_in_range` | Current frequency is inside the suitable range | Retain the exact current frequency |
| `shampoo.cadence.nearest_boundary` | Current frequency is outside the range | Recommend the nearest valid boundary, not automatically the midpoint |
| `shampoo.cadence.total_budget` | Cadence resolves | Treat it as the total wet-wash event budget |
| `shampoo.cadence.cover_total` | Products are assigned | Their planned uses must cover the total exactly |
| `shampoo.cadence.substitution` | Deep Cleansing or another confirmed special wash is due | Substitute inside the total rather than add a wash |
| `shampoo.cadence.product_protocol` | Exact product directions require a temporary phase | Present the cadence delta as a successor proposal; never mutate silently |

The initial starting target is a real recommendation, not a claim about the user's present behavior. Once current frequency is known, `retain_in_range` or `nearest_boundary` replaces the preliminary mode in the refined snapshot; any changed recommendation is shown to the user rather than silently mutating the initial result. Dry flakes and irritation change gentleness/technique rather than the scalp-led numeric band. Goals never change cadence. `does_not_wash` is valid current behavior but does not erase the recommended scalp-led target. Severe fragility may favor the lower edge only in a genuine tie without a scalp/treatment conflict.

Dry Shampoo remains a bridge. After two logged Dry Shampoo uses since the last wet wash, the next executable bridge is a wet wash. Persistent residue despite ordinary cleansing may substitute a cautious Deep Cleansing wash; it does not create another wash event.

## Product facts and catalog authority

Shared product/catalog facts own identity, lifecycle, availability, price, budget, exclusions, and nullable verified `suitable_thicknesses`.

Shampoo-specific authority uses the reviewed route/bucket and exact protocols:

- `dehydriert-fettig`, `normal`, `trocken`, `schuppen`, or `irritationen`;
- `schuppen` is treatment-capable only after exact claim and effective-active review;
- `suitable_thicknesses = null` is unverified, a non-empty array must contain the user's thickness, and legacy `[]` remains invalid/unreviewed rather than a wildcard;
- exact initial/maintenance frequency, duration, contact time, placement, rinse behavior, cautions, and source belong to the verified protocol authority.

Do not add a second editable `anti_dandruff_active` authority. A reviewed export may derive that fact from `schuppen`, but product intake/review owns the claim/formula evidence. Reformulation triggers product re-review.

## Stage 2 — role-relative fit and selection

Evaluate every owned product independently against every required Shampoo role.

| Verdict | Deterministic meaning |
|---|---|
| `ideal` / `passt sehr gut` | Identity, lifecycle, required route/role, thickness, exclusions, and critical protocol all pass |
| `supportive` / `passt mit Einschränkung` | Strict gates pass but one explicit gentleness, compatibility, or secondary coverage limitation remains |
| `mismatch` / `wechseln empfohlen` | Wrong required role/route, verified thickness exclusion, strong exclusion, safety conflict, or incompatible verified product behavior |
| `unknown` / `noch in Prüfung` | Identity is pending or a required strict/core/protocol fact is unverified |

Precedence is pending/unresolved identity, safety/red flags, strong exclusions, strict thickness, required role/route, critical protocol gap, supportive limitation, then ideal.

Selection order:

1. verified active Shampoo identity and required role/route;
2. safety, exclusions, and thickness gate;
3. irritation/dry-scalp compatibility where relevant;
4. preserve a valid owned product before proposing an unnecessary switch;
5. among valid new products, use fiber compatibility, budget, availability, and curated priority;
6. stable catalog order resolves an exact tie.

Select only `ideal` or explicitly limited `supportive` candidates. If no safe exact candidate survives, return `not_selected` with `Empfehlung wird geprüft`; never promote mismatch/unknown or send the user to Chat to assemble the answer.

## Multiple products, allocation, and lifecycle

- One verified product may fill everyday and dandruff roles without forcing another purchase.
- Two owned Shampoos do not automatically create a rotation; each needs an assigned role or an explicitly confirmed equal-fit rotation.
- Product-directed dandruff occurrences consume the total wash budget first; everyday Shampoo fills the remainder.
- Equal-fit products sharing one role alternate within the category total rather than each receiving the full frequency.
- After aggregation across roles, greatest planned use determines `primary`; other active assigned products are `secondary`. A stable confirmed tie-breaker resolves equality.
- A primary/secondary or allocation change creates a proposed successor and requires confirmation.
- Pending, shopping, declined, inactive, and unassigned products remain visible but do not enter executable steps.
- A mismatch may remain as an informed non-blocking override while the fitting alternative stays available.
- Opening an affiliate link never means acquisition. Confirmed acquisition reruns fit and previews the new assignment before plan confirmation.

## Stage 3 — occurrence and application

Every eligible wet-wash event contains exactly one Shampoo role occurrence unless a verified targeted protocol deliberately sequences otherwise. A Deep Cleansing occurrence replaces the regular Shampoo step.

Safe everyday fallback:

1. Wet hair and scalp thoroughly.
2. Apply primarily to scalp/roots.
3. Massage gently without aggressive scratching.
4. Let lather travel through lengths rather than scrubbing fragile lengths.
5. Rinse thoroughly.
6. Continue with the already-planned after-wash care.

Do not invent pumps, exact amount, temperature, contact time, double cleansing, treatment duration, or maintenance phase.

For `shampoo_dandruff`, a verified exact protocol must provide the material initial/maintenance schedule, duration, contact time, placement, rinse behavior, whether another Shampoo may be used, cautions, source URL, and verification date. Missing critical instructions keep the exact occurrence visibly unresolved with `Nach Produktangabe` rather than fabricated precision.

## Response check and safety

| Rule ID | Condition | Output |
|---|---|---|
| `shampoo.dandruff.review` | Cosmetic dandruff product becomes active | Schedule one 21-day response check |
| `shampoo.dandruff.keep` | Clearly improved | Keep current product/plan; propose maintenance change only from verified directions |
| `shampoo.dandruff.medicinal_proposal` | Unchanged | Keep current plan while proposing one reviewed stronger medicinal product with pharmacy/medical guidance |
| `shampoo.safety.escalation` | Worse, red flag, or appropriate use yields no clear improvement | Suppress automatic intensification and use professional/pharmacy guidance |

Red flags include severe or worsening itch, redness/swelling, blistering/oozing/sores, marked pain/burning, symptoms elsewhere, suspicious rash, or patchy hair loss. A suspected product reaction triggers stop/reassessment rather than stronger cleansing.

Do not diagnose scalp disease, promise a cure, claim every course ends at 21 days, or treat an ingredient as proof of finished-product efficacy. Opening a purchase link, proposing a medicinal product, or reporting unchanged symptoms never changes ownership or the active plan automatically.

## Structured reasoning payload

Preserve:

- `basis` inclusion and the exact everyday/dandruff roles;
- scalp oiliness, every selected specific scalp concern, precedence, and missing-input state;
- retained or changed cadence and the total wet-wash budget;
- target route, gentleness, treatment/fragility constraints, and Deep Cleansing substitution;
- every product's role-relative fit, limitations, mismatches, unknown facts, assignment, and lifecycle state;
- exact protocol source or visible protocol gap;
- dandruff check-in/escalation state and safety facts;
- proposed allocation/product changes and confirmation state.

Shared presentation chooses the final German templates and two decisive card facts. It may not change the deterministic outcome.

## Deterministic fixture matrix

1. `shampoo-balanced-retained`: balanced scalp, no concerns, `weekly_2x`, fitting owned product -> one everyday role, retained cadence, owned active.
2. `shampoo-oily-frequency-low`: oily scalp, `weekly_1x` -> nearest valid boundary proposed rather than preferred midpoint.
3. `shampoo-dandruff-owned`: targeted dandruff plus fitting owned `schuppen` product -> dandruff role, 21-day check, no unnecessary purchase.
4. `shampoo-dandruff-irritated`: targeted dandruff plus irritation, no fitting owned product -> sensitive treatment-capable recommendation when available.
5. `shampoo-irritation-only`: irritation without dandruff -> `irritationen` everyday route, no treatment role/check.
6. `shampoo-dry-flakes-only`: dry flakes -> gentle dry-scalp everyday route, no `schuppen` requirement.
7. `shampoo-one-product-two-roles`: one verified product fills everyday and dandruff roles.
8. `shampoo-two-products-allocation`: separate everyday/dandruff products partition total cadence and derive primary from planned use.
9. `shampoo-two-equal-products`: no confirmed rotation -> deterministic best assignment; other product remains unassigned.
10. `shampoo-pending-product`: visible pending, excluded from recipes; verified alternative covers or role remains unresolved.
11. `shampoo-no-valid-candidate`: all candidates unsafe/excluded -> `not_selected`, never promote mismatch/unknown.
12. `shampoo-response-unchanged`: 21-day result unchanged -> medicinal proposal; old plan stays active.
13. `shampoo-response-worse`: worse/red flags -> professional-care state, no automatic stronger recommendation.
14. `shampoo-link-nonmutation`: affiliate link opened -> no ownership, assignment, or plan mutation.
15. `shampoo-quiz-starting-target`: balanced scalp, current frequency not collected yet -> preliminary `weekly_2x` quiz starting target; after onboarding, missing current frequency becomes a typed clarification and explicit `does_not_wash` remains valid.
16. `shampoo-stable-recompute`: identical versioned inputs and catalog snapshot -> byte-stable result.
17. `shampoo-deep-cleansing-substitution`: Reset occurrence replaces regular Shampoo and total wet-wash cadence stays unchanged.
18. `shampoo-protocol-gap`: targeted product lacks critical instructions -> visible `unknown` protocol state with `Nach Produktangabe`; no precise executable product step.
19. `shampoo-acquired-confirmed`: acquired verified recommendation previews assignment and enters steps only after confirmation.
20. `shampoo-owned-override`: mismatch retained by explicit override remains visible with limitation and fitting alternative.

Every fixture must assert decisive rule IDs, Stage 1 tier/roles/cadence, Stage 2 product states, Stage 3 occurrence/protocol state, and unresolved/shared/data gates.

## Data, catalog, and launch gates

Before confident Shampoo recommendations and executable targeted protocols launch:

- Personal Plan must consume lossless `scalpConcerns[]` rather than the offer projection;
- legacy `dry_flakes` intake/category mappings must be reconciled with the confirmed gentle dry-scalp route;
- active launch products require reviewed route/bucket, nullable thickness suitability, safety/exclusions, lifecycle, availability, and critical exact protocol facts;
- `schuppen` approval must retain exact claim/formula provenance and never become ingredient-only inference;
- product-intake, generated types, validators, admin/review readers, selectors, and protocol loaders must preserve null/unverified semantics;
- no Basis role may silently receive a mismatch/unknown recommendation;
- category tests must cover every rule and fixture above, plus shared lifecycle and portfolio integration;
- privacy-safe aggregate telemetry may record category, role, tier, verdict, and unresolved reason, but never identity, free text, or exact owned-product identity.

An honest `not_selected` state remains valid for a rare excluded profile, but launch fixtures must prove adequate verified coverage for the normal everyday routes, targeted dandruff route, and combined irritation/dryness paths. Use the one shared Personal Plan flag for rollback; do not add a Shampoo-only flag or hide the category.

## Shared dependencies and handoff

- Shared portfolio allocation owns cross-category coverage and Deep Cleansing substitution while preserving Shampoo's total wash budget.
- Shared lifecycle owns pending, shopping, acquisition, proposal, confirmation, decline, and immutable active-plan transitions.
- Shared protocol infrastructure owns exact verified product rows; Shampoo owns their category interpretation.
- Shared presentation owns German templates and reason salience.
- Shared day compilation owns dated occurrence IDs and after-wash continuation.

The Shampoo product-policy stop gate is cleared. Catalog/protocol backfill and synchronized implementation remain explicit implementation/launch gates rather than open category decisions. This document change does not authorize runtime, database, shared-spec, activation, or catalog writes.

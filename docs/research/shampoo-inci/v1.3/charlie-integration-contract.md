# Charlie integration contract — Shampoo INCI v1.3

## Purpose

This contract translates the supplied v1.3 research material into Charlie's shadow-only Shampoo research engine. It is an intentional compatibility layer, not an edit to the source package and not a production recommendation contract.

## Product truth precedes profile fit

Product truth is formula-version-specific and contains exact identity, market/version source records, raw and normalized INCI, formula observations, direct product properties, evidence, conflicts, and review state. It does **not** declare a shampoo suitable for a person.

Profile fit is a separate, derived layer. It combines approved direct product properties with a de-identified profile and preserves its own evidence chain, guardrails, uncertainty, and ranking trace. It must not skip from an ingredient observation directly to a user recommendation.

## Intentional vocabulary translation

| Source-material term | Charlie research-engine contract | Reason |
| --- | --- | --- |
| Hair-thickness `medium` | `normal` | Charlie uses `normal` for hair diameter. `medium` is rejected only in this semantic path. |
| Scalp `normal` | `balanced` | Charlie uses `balanced` for this profile state. |
| `clarifying` as cleansing strength | `cleansingStrength: strong` plus `focusPrimary: clarifying` and `usageRole: occasional_reset` when independently supported | Clarifying is a role/focus conclusion, not a fourth cleansing-strength bucket. |
| `occasional-reset` | `occasional_reset` | Charlie uses snake case in persisted enum values. |
| `scalp-active` | `scalp_active` | Charlie uses snake case in persisted enum values. |

`moderate` remains valid for the research-only conditioning scale (`low | moderate | high`). This contract does not change unrelated legacy enums or prohibit the ordinary English word “medium” outside hair-thickness semantics.

## Evidence and medical boundaries

- Every direct property requires evidence, confidence, scope, rationale, supporting signals, and counter-signals (or an explicit evidence-backed absence record); derived profile fit additionally names its direct-property and profile-fact inputs.
- Formula-only signals are probabilistic. They do not justify exact concentration, final-pH, treatment-performance, or medical conclusions.
- Product truth records `scalpComfortTarget` (`targeted | not_targeted | unknown`) separately from `dandruffSupport` (`supported | not_supported | unknown`). `scalpComfortTarget` answers only whether the exact product deliberately targets cosmetic dry, tight, itchy, dry-flake or sensitive-scalp comfort through a coherent product/formula route. `not_targeted` means no specialist comfort route, not “unsuitable.” These direct properties and formula-derived exposure flags are evidence inputs, not standalone suitability verdicts.
- In the locked EU/German MVP cohort, `dandruffSupport: supported` requires a recognized conventional cosmetic anti-dandruff route in the exact formula (`Piroctone Olamine` or `Climbazole`). Its presence establishes formula support, not guaranteed finished-product efficacy; undisclosed concentration and missing product-specific endpoints cap confidence. A late INCI position cannot negate the route because ingredients at or below 1% may be listed in any order. A complete resolved formula without either accepted route is `not_supported`, including products that contain tea tree or make anti-flake claims; this means the accepted support route is absent, not that the product is proven ineffective. `unknown` is reserved for incomplete, conflicting or unresolved formula evidence. Marketing positioning alone never upgrades the property to `supported`.
- Profile fit keeps explicit dandruff separate from dry flakes. Explicit oily dandruff consumes `dandruffSupport`; the persisted `dry_dandruff` profile value is interpreted as dry flakes and consumes cleansing strength plus `scalpComfortTarget`. Anti-dandruff support must not make a product a primary dry-flake recommendation by itself.
- For mild-sensitive/itchy, `irritated`, and dry-flake contexts, the authoritative fit table combines `scalpComfortTarget`, cleansing strength and scalp oiliness. A targeted low/moderate cleanser is recommended; a targeted strong cleanser is recommended for oily, conditional for balanced and caution for dry scalp. `not_targeted` stays a conditional secondary option except strong cleansing on dry scalp, which is caution. `unknown` remains unknown.
- Fragrance, declared aromatic oils, mint and menthol remain visible exposure/preference heads-ups. They do not automatically reduce the scalp-fit tier; an explicit user avoidance preference may still exclude them. Fragrance-free lowers one exposure concern but never proves universal tolerance.
- Ordinary cosmetic flakes, anti-dandruff positioning and mild sensitivity/itch remain in scope. Persistent or severe symptoms, dermatitis, psoriasis, hair loss, infection and other medical conditions remain out of scope.
- Product `medicalBoundary` is required and distinguishes `clear`, `cosmetic_scalp_targeted` and `medical_claim`. The value records claim scope: a medical-adjacent product claim cannot create or upgrade medical support, but it does not by itself suppress otherwise supported ordinary cosmetic formula fit for a healthy-user profile. Medically out-of-scope user profiles still abstain.
- `scalp_active` is a direct product focus, not an automatic medical blocker. Profile fit separately combines it with the user's oiliness, concerns and irritation severity.
- Burning, painful or inflamed user symptoms always abstain from the cosmetic matching path.

## Approval and use boundary

Only approved, identity-resolved, non-conflicting product analyses may enter ordinary shadow shortlists. Provisional analyses may generate clearly labelled preview fits for review, while blocked, medically out-of-scope profile and reset-boundary records remain inspectable with their abstention reason. Legacy/Tom labels are comparison output only and never affect ranking.

This snapshot authorizes neither catalog writes nor live matching, Personal Plan, Agent V2, remote migration, deployment, or product publication.

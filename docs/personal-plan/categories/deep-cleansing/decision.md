---
category: deep_cleansing_shampoo
document_type: decision
status: confirmed
decision_version: 1
last_reviewed_at: 2026-08-06
evidence_file: docs/personal-plan/categories/deep-cleansing/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/deep-cleansing.ts
test_surface: tests/personal-plan/categories/deep-cleansing.test.ts
---

# Personal Plan Deep Cleansing decision

## Authority and current status

This document records the confirmed deterministic policy for the Deep Cleansing Shampoo category. It follows `docs/personal-plan/categories/category-design-framework.md`. Existing CareBalance, Reset-assessment, routine-page, and recommendation-runtime code are implementation inputs only; the new Personal Plan module owns this category after implementation.

The category decisions are complete. Current-product colour compatibility and the minimal product-spec backfill remain catalog-data work rather than open product logic.

## Category charter

Deep Cleansing provides an occasional Reset for accumulated product, sebum, mineral, or environmental residue. It is not:

- the user's regular Shampoo;
- dandruff treatment;
- dry-flake or irritation treatment;
- a scalp Peeling;
- conditioning, repair, or nutrition;
- an additional wash outside the resolved Shampoo cadence.

A scheduled Reset substitutes for the regular Shampoo step on that wash day.

## Canonical inputs

Stage 1 inclusion consumes only current versioned user/profile facts:

- `scalpType = oily` or the canonical oily-scalp concern;
- current Dry Shampoo frequency;
- current Leave-in frequency;
- current finishing-Oil role and frequency;
- current normal Shampoo frequency;
- `low_volume_or_weighed_down` concern.

Product ownership does not create need. Mask and pre-wash Oil do not create Reset load. Scalp dandruff, dry flakes, and irritation remain separate scalp routes and do not add Reset points.

## Reset-load computation

Compute one transparent integer `resetLoad`:

| Rule ID | Condition | Points |
|---|---|---:|
| `deep_cleansing.load.oily_scalp` | Oily scalp is present | 1 |
| `deep_cleansing.load.dry_shampoo_regular` | Dry Shampoo is `weekly_1x` or `weekly_2x` | 1 |
| `deep_cleansing.load.dry_shampoo_frequent` | Dry Shampoo is `weekly_3_4x`, `weekly_5_6x`, or `daily_1x` | 2 instead of the regular point |
| `deep_cleansing.load.leave_in` | Leave-in frequency is at least `weekly_1x` | 1 |
| `deep_cleansing.load.finishing_oil` | A confirmed `dry_finish` Oil is used at least `weekly_1x` | 1 |
| `deep_cleansing.load.low_wash_relative_to_load` | Normal Shampoo is `weekly_1x` or less and at least one oily-scalp, Dry Shampoo, regular Leave-in, or regular finishing-Oil signal exists | 1 |
| `deep_cleansing.load.weighed_down_corroboration` | `low_volume_or_weighed_down` exists together with at least one other Reset-load signal | 1 |

Precedence:

1. Dry Shampoo contributes either 1 or 2, never both.
2. `low_volume_or_weighed_down` contributes nothing alone.
3. Low Shampoo frequency contributes nothing alone.
4. Product category presence without at-least-weekly use contributes nothing.
5. Mask and pre-wash Oil contribute nothing even when frequent.
6. The score is an internal deterministic computation; the UI never displays the number.

## Need tier and cadence

| Rule ID | `resetLoad` | Tier | Cadence |
|---|---:|---|---|
| `deep_cleansing.inclusion.none` | 0 | `not_needed` | none |
| `deep_cleansing.inclusion.optional` | 1 | `optional` | unscheduled `Bei Bedarf` |
| `deep_cleansing.inclusion.basis` | 2–3 | `basis` | every fourth wash |
| `deep_cleansing.inclusion.high_load` | 4+ | `basis` | every third wash |

Cadence invariants:

- a Reset replaces the regular Shampoo occurrence;
- it never increases the total wet-wash frequency;
- optional means genuinely unscheduled rather than secretly every-N-washes;
- exact product directions may impose a stricter maximum but never increase the category cadence;
- changing the active category cadence creates a proposed successor plan and requires confirmation.

## Safety and scalp-route boundary

Scalp safety does not rewrite `resetLoad` or the underlying need tier.

- Active irritation or dry flakes pause the executable Reset occurrence until the scalp has calmed.
- Dandruff remains owned by the targeted Shampoo role. It does not create Deep Cleansing need.
- An independent Reset need may coexist with a dandruff route, but it is never presented as treatment and is not applied during an active irritated/dry-flake state.
- Persistent, severe, painful, weeping, or otherwise concerning scalp symptoms require the shared medical-escalation boundary rather than stronger cleansing.
- A reaction to an exact product triggers stop/reassessment guidance.

## Reset roles

Use two product capabilities:

```ts
type DeepCleansingResetRole =
  | 'residue_reset'
  | 'mineral_reset'
```

- `residue_reset` covers verified product/sebum/Styling/environmental-residue positioning.
- `mineral_reset` requires explicit verified mineral, metal, hard-water, chlorine, or lime-deposit positioning.
- A product may support both roles.
- Ingredients never infer either role.

V1's current quiz/onboarding inputs automatically create only `residue_reset`. `mineral_reset` remains a supported product capability but is not inferred without a verified user-side mineral exposure signal.

## Canonical product facts

Replace the Personal Plan use of the legacy Deep Cleansing shape with the minimal product-level specification:

```ts
type UnverifiedDeepCleansingFact = null

interface ProductDeepCleansingSpec {
  productId: string
  supportedResetRoles: DeepCleansingResetRole[] | UnverifiedDeepCleansingFact
  targetScalpTypes: ('oily' | 'balanced' | 'dry')[] | UnverifiedDeepCleansingFact
  suitableForColorTreatedHair: boolean | UnverifiedDeepCleansingFact
}
```

The shared product record continues to own identity, category, lifecycle, recommendation status, price, purchase link, and availability. Exact product cadence limits, placement, contact time, and application overrides belong to `product_application_protocols` rather than this table.

Field semantics:

- `null` means not verified;
- for arrays, `[]` means reviewed and verified to have no explicit values;
- `supportedResetRoles` is hard eligibility;
- `targetScalpTypes` is soft target positioning only;
- `suitableForColorTreatedHair` is a strict compatibility fact only for a user with colour-treated hair;
- a manufacturer “all hair types” claim does not automatically prove colour-treated compatibility;
- product facts come from verified finished-product sources, not ingredient inference.

Do not use the legacy `reset_intensity` field in Personal Plan selection. It cannot be calibrated reliably and must not be copied into a new target-intensity axis.

## Stage 2 fit

Evaluate one active/selected Deep Cleansing product against the required role:

| Verdict | Deterministic meaning |
|---|---|
| `ideal` / `passt sehr gut` | Product identity is verified, it supports the required Reset role, and no verified incompatibility applies |
| `supportive` / `passt mit Einschränkung` | It supports the required role but has one explicit relevant product-specific limitation |
| `mismatch` / `wechseln empfohlen` | Wrong category, required role is explicitly unsupported, or colour-treated suitability is verified false for a colour-treated user |
| `unknown` / `noch in Prüfung` | Product is pending or a required hard fact is unverified; colour suitability `null` is unknown only when the user's hair is colour-treated |

Selection precedence:

1. verified Deep Cleansing identity and lifecycle;
2. required Reset-role support;
3. verified user-specific compatibility;
4. preserve a valid owned product rather than force an unnecessary switch;
5. when selecting a new exact product, use explicit scalp-target positioning as a soft rank;
6. use verified protocol simplicity and practical shared catalog tie-breakers only between otherwise suitable candidates;
7. stable catalog order resolves a remaining exact tie.

Soft positioning never rescues the wrong role, overrides a verified incompatibility, or downgrades a valid general owned product. A general verified residue product still `passt sehr gut` for an oily-scalp user; an explicit oily-scalp target merely ranks another valid new candidate higher.

## Product allocation and reconciliation

- Recommend and assign at most one active Deep Cleansing product.
- Additional owned products in this category remain saved and visible but are not ranked, rotated, scheduled, or independently analysed in V1.
- A product supporting both required roles may cover both without creating a second purchase.
- Opening a shopping link never marks a product as acquired.
- A newly acquired or selected product creates a proposed assignment change; the current plan changes only after confirmation.
- A pending submitted product remains `noch in Prüfung` and does not become an executable day step.
- A user may non-blockingly retain a mismatch as an informed override while the fitting alternative remains on the shopping list.

## Stage 3 application

One Deep Cleansing occurrence replaces the regular Shampoo step. The category fallback is:

1. Wet the hair thoroughly.
2. Apply mainly to the scalp and roots.
3. Massage gently and let the foam travel through the lengths without aggressive scrubbing.
4. Rinse thoroughly.
5. Continue with the already-planned after-wash care.

Rules:

- one pass only;
- do not add a regular Shampoo before or after it;
- do not invent pumps, dosage, dwell minutes, water temperature precision, or Double Cleansing;
- a verified exact-product protocol may override contact time or placement but may not silently increase the plan cadence;
- the category does not itself force Conditioner or Mask—the compiler continues whatever after-wash steps already belong to that user's confirmed day type.

## Structured reasoning

Stage 1 displays the tier, required product type, cadence, and at most two decisive personal reasons. It never displays `resetLoad`.

Stable reason families:

- frequent Dry Shampoo use;
- regular Leave-in and/or finishing-Oil load;
- accumulation across relatively few wash events;
- oily scalp;
- weighed-down/low-volume outcome corroborating another driver.

When `low_volume_or_weighed_down` exists, prefer a paired explanation that names the experienced outcome and its corroborating driver. Never state that the concern proves buildup.

Example Basis explanation:

> Du hast angegeben, dass dein Haar schnell beschwert wirkt. Da du regelmäßig Leave-in und Finish-Öl verwendest, können Rückstände dazu beitragen. Eine Tiefenreinigung jeden vierten Waschtag setzt deshalb regelmäßig einen Reset.

Example optional explanation:

> Deine fettige Kopfhaut kann gelegentlich von einer gründlicheren Reinigung profitieren. Nutze sie nur bei Bedarf – nicht zusätzlich zu deinem normalen Waschrhythmus.

## Current active-product orientation

| Product | `supportedResetRoles` | `targetScalpTypes` | `suitableForColorTreatedHair` |
|---|---|---|---|
| NEQI Deep Cleansing Shampoo | `['residue_reset']` | `['oily', 'dry']` | `null` |
| Swiss-O-Par Tiefenreinigung | `['residue_reset', 'mineral_reset']` based on explicit Anti-Kalk/mineral-deposit positioning | `[]` | `null` |
| Balea Professional Tiefenreinigung | `['residue_reset']` | `['oily']` | `null` |
| ISANA Professional Tiefenreinigung | `['residue_reset']` | `[]` | `null` |
| Gliss Scalp Balance Tiefenreinigung | `['residue_reset']` | `['oily']` | `null` |

The role/target rows are reviewed orientation for catalog backfill. Every colour value remains unknown until an exact explicit source is verified. The inactive professional/high-end product rows remain outside this category checkpoint.

## Required deterministic fixtures

1. no accumulation signal -> `not_needed`;
2. oily scalp only -> optional `Bei Bedarf`;
3. Dry Shampoo once weekly -> optional;
4. Dry Shampoo three to four times weekly -> Basis every fourth wash;
5. weekly Leave-in plus weekly finishing Oil -> Basis every fourth wash;
6. Leave-in plus pre-wash Oil only -> optional from Leave-in, not Basis;
7. Mask plus pre-wash Oil only -> `not_needed`;
8. oily scalp plus weekly Leave-in -> Basis every fourth wash;
9. once-weekly Shampoo plus weekly Leave-in -> Basis through low-cadence corroboration;
10. twice-weekly Shampoo plus weekly Leave-in -> optional; no low-cadence point;
11. weighed-down concern alone -> `not_needed`;
12. weighed-down concern plus weekly Leave-in -> Basis and paired explanation;
13. score four or higher -> every third wash;
14. active irritation with Basis need -> tier preserved, occurrence paused;
15. dandruff without independent load -> no Deep Cleansing need;
16. verified residue owned product for oily scalp without explicit oily target -> `ideal`, no forced switch;
17. required mineral role plus residue-only product -> `mismatch`;
18. Swiss-O-Par for verified mineral role -> role passes without a chelation efficacy claim;
19. colour-treated user plus compatibility `null` -> `unknown`;
20. colour-treated user plus verified false -> `mismatch`;
21. non-colour-treated user ignores colour compatibility `null`;
22. pending owned product -> `unknown` and no executable step;
23. two owned products -> one selected/active; the other saved and unanalysed;
24. Reset occurrence substitutes for regular Shampoo and keeps total wash cadence unchanged;
25. application fallback compiles exactly one pass and then resumes existing after-wash steps.

## Launch/data gate

Before this category can produce confident exact recommendations:

- the active launch products must have canonical supported-role and scalp-target facts;
- colour-treated launch fixtures require at least one verified compatible exact product or the honest no-verified-match state;
- pending/unverified products must never be promoted to a confident alternative;
- category tests must cover every rule and fixture above;
- no runtime reader may use `reset_intensity` as Personal Plan fit authority.

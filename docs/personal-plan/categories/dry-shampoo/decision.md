---
category: dry_shampoo
document_type: decision
status: confirmed
decision_version: 2
last_reviewed_at: 2026-08-06
current_runtime_revision_reviewed: 0007e10d852004a6fb18f86e76afd7591fba435d
evidence_file: docs/personal-plan/categories/dry-shampoo/evidence.md
runtime_authority_after_implementation: src/lib/personal-plan/categories/dry-shampoo.ts
test_surface: tests/personal-plan/categories/dry-shampoo.test.ts
---

# Personal Plan Dry Shampoo decision

## Authority and current status

This document records the confirmed deterministic policy for the Dry Shampoo category. It follows `docs/personal-plan/categories/category-design-framework.md`. Existing CareBalance and recommendation-runtime rules are implementation inputs only; the new Personal Plan category module owns this behavior after implementation.

The category-level product journey and rules are confirmed. Exact catalog backfill and the shared late-binding variant-resolution component remain implementation/data work rather than open product-policy questions.

## Category charter

Dry Shampoo has one core job: absorb excess oil at the roots and make the roots look fresher between wet-wash days. It is not:

- a wet Shampoo or a substitute for necessary water cleansing;
- treatment for dandruff, dry flakes, irritation, hair loss, or another scalp condition;
- a mandatory scheduled step;
- the primary owner of volume, texture, or Styling goals;
- a cleansing-strength or scalp-health intervention.

Volume/texture is a Stage-2 product direction, scalp sensitivity is a suitability fact, and format controls application. Odour-control, treatment, growth, sweat-refresh, soft-clean-finish, and curl-refresh claims remain outside V1 logic.

## Canonical inputs

Stage-1 inclusion consumes only:

- existing Dry Shampoo ownership/use and its reported average frequency;
- oily scalp/roots;
- the resolved recommended Shampoo cadence and whether it creates non-wash days;
- the answer to the conditional bridge-preference question when required.

Stage-2 fit additionally consumes:

- sensitive scalp without active symptoms;
- active irritation, burning, soreness, wounds/pustules, dry flakes, or active dandruff;
- visible buildup/repeated layering;
- `volume` or `less_volume` goal;
- the active product's verified Dry Shampoo specification;
- a late-bound hair-colour choice only when a tinted candidate requires it.

Do not infer Dry Shampoo need from daily time, texture, workout/travel context, generic routine style, or a volume goal. Hair colour, fragrance exclusion, and aerosol exclusion are not current onboarding inputs and must not be silently inferred.

## Inclusion and need tier

Dry Shampoo is never `basis`.

| Rule ID | Condition | Output |
|---|---|---|
| `dry_shampoo.inclusion.existing_use` | User already owns/uses Dry Shampoo | `optional` |
| `dry_shampoo.inclusion.offer_bridge` | Oily roots, recommended Shampoo cadence creates non-wash days, and no existing Dry Shampoo | Ask the conditional bridge question |
| `dry_shampoo.inclusion.accepted_bridge` | User answers “Ja, das wäre praktisch” | `optional` |
| `dry_shampoo.inclusion.declined_bridge` | User answers “Nein, ich wasche dann lieber” | `not_needed` |
| `dry_shampoo.inclusion.none` | No existing use and the bridge-question condition is not met | `not_needed` |

Conditional question:

> Dein Ansatz kann zwischen Waschtagen schneller nachfetten. Möchtest du ihn an solchen Tagen ohne zusätzliche Haarwäsche auffrischen?

Answers:

- `Ja, das wäre praktisch`
- `Nein, ich wasche dann lieber`

The condition uses the recommended Shampoo cadence, not an incorrectly low current cadence. A `not_needed` category is absent from Stage 1 rather than shown as a negative card.

## Cadence, pause, and operational guard

Stage 1 expresses the occurrence as:

> Bei Bedarf zwischen Waschtagen · höchstens zweimal vor der nächsten Haarwäsche.

Dry Shampoo is never assigned a mandatory weekly schedule. Stage 3 may make it an optional non-wash-day step, but it never replaces a necessary wet wash.

Keep three independent outputs:

```ts
type DryShampooCadenceAdjustment = 'keep' | 'decrease_frequency'
type DryShampooExecutionState = 'available' | 'pause'
```

| Reported average use | Cadence adjustment |
|---|---|
| up to `weekly_3_4x` | `keep`; no warning from the weekly average alone |
| `weekly_5_6x` | `decrease_frequency` |
| `daily_1x` | `decrease_frequency` with stronger wording |

Operational rule: after two logged Dry Shampoo applications since the previous wet wash, the next relevant suggestion is a wet wash rather than another Dry Shampoo occurrence.

Changing the active product, cadence advice, or pause state creates a proposed successor plan and requires confirmation before replacing the active confirmed plan.

## Scalp safety boundary

Scalp safety does not silently delete the category or overwrite the product-fit verdict.

- Sensitive scalp without active symptoms does not block use.
- Active irritation, burning, soreness, wounds/pustules, dry flakes, or active dandruff sets `executionState = pause`.
- Visible buildup or repeated layering sets `executionState = pause` until the next wet wash.
- Hair loss alone is not a prohibition, but Dry Shampoo cannot be framed as support for hair loss.
- A product reaction triggers stop/reassessment guidance and can justify `wechseln empfohlen`.
- Persistent, severe, painful, weeping, or otherwise concerning symptoms route to the shared medical-escalation boundary.

A paused category remains visible when it was already included, labeled `Aktuell pausieren`, so the user's accepted portfolio does not disappear without explanation.

## Canonical product facts

Use the following minimal product specification:

```ts
type DryShampooStylingEffect =
  | 'standard_refresh'
  | 'volume_texture'

type DryShampooHairColorFit =
  | 'universal'
  | 'blonde_light'
  | 'brown'
  | 'dark'

type DryShampooFormat =
  | 'aerosol_spray'
  | 'aerosol_foam'
  | 'non_aerosol_liquid'

interface ProductDryShampooSpec {
  productId: string
  stylingEffect: DryShampooStylingEffect
  hairColorFit: DryShampooHairColorFit
  scalpSensitivityFit: 'sensitive_ok' | 'normal_only' | null
  format: DryShampooFormat | null
}
```

Field semantics:

- core oil absorption/root refresh is implicit to verified membership in this category;
- `stylingEffect` is a soft directional fit;
- `hairColorFit` is a soft appearance compatibility fact;
- `scalpSensitivityFit` is a soft suitability fact unless an actual negative reaction is known;
- `format` compiles the application protocol and may be used for comparison, but current profile data does not choose it;
- `null` means unverified, never false;

Keep `scalpSensitivityFit` in V1. The lossless quiz value `scalp_condition = gereizt` supplies the available sensitivity target for product assessment, while active symptoms independently set `executionState = pause`. Product fit and temporary execution safety therefore remain separate rather than deleting the sensitivity property because use is paused.

Do not add a separate `isAerosol` boolean: the constrained format already expresses aerosol versus non-aerosol and also selects the correct application protocol. Do not add cleansing strength, a generic functional-benefit array, or dormant fragrance/aerosol filters. `fragranceFree` is deliberately absent from the V1 category schema because the user profile has no fragrance-avoidance input and the fact would not affect matching or ranking. If fragrance preference is introduced later, model it once as a shared cross-category product attribute rather than adding a Dry Shampoo-local field.

### Canonical Dry Shampoo schema cutover

The live catalog currently has 10 active recommended Dry Shampoos with legacy specs. This is a controlled schema migration followed by exact-product enrichment, not a new seed cohort.

Use one clean cutover with no compatibility aliases or dual authority:

1. rename `primary_effect` to `styling_effect` across the database, generated types, Product Intake, admin, selectors, reason codes, validators, and tests;
2. migrate legacy `classic_refresh` and `sensitive_refresh` to `standard_refresh`, while `volume_texture` remains unchanged;
3. keep sensitivity positioning solely in `scalp_sensitivity_fit`; `sensitive_refresh` must not survive as a second representation of the same fact;
4. replace the legacy `foam_or_liquid` format with the precise canonical enum and do not retain the combined value or a fallback alias;
5. preserve all eight current `aerosol_spray` values mechanically in the schema/runtime migration;
6. set the two legacy `foam_or_liquid` rows to `null` in that migration rather than inserting product-specific facts into the schema/runtime PR;
7. in the shared cross-category follow-up enrichment PR, write the verified exact mappings `Balea Trockenshampoo Schaum Kopfhaut Sensitive -> aerosol_foam` and `got2b Liquid-to-Dry -> non_aerosol_liquid` from the sources recorded in `evidence.md`;
8. use `null` for any other unverified format and keep that product `unknown` / `noch in Prüfung` and out of executable instructions until reviewed.

The schema/runtime PR may therefore land inert without guessing. Dry Shampoo activation requires all 10 active recommended products to have a verified canonical format after the shared enrichment PR.

## Stage 2 fit

Evaluate product fit separately from cadence adjustment and execution pause.

| Verdict | Deterministic meaning |
|---|---|
| `ideal` / `passt sehr gut` | Verified Dry Shampoo identity; sensitivity and hair-colour facts are compatible or universal; no known negative reaction |
| `supportive` / `passt mit Einschränkung` | Core refresh job works, but sensitivity positioning, tint, or styling direction has an explicit limitation |
| `mismatch` / `wechseln empfohlen` | Wrong category, known negative reaction, or another genuinely incompatible verified property—not tint/sensitivity positioning alone |
| `unknown` / `noch in Prüfung` | Product is pending or a required product fact for the current assessment is unverified |

Rules:

- normal scalp accepts `normal_only` or `sensitive_ok` as ideal;
- sensitive scalp plus `sensitive_ok` can be ideal;
- sensitive scalp plus `normal_only` is supportive, not an automatic mismatch;
- `universal` hair-colour fit is compatible for everyone;
- a wrong tint is supportive because root refresh can still work while visible tone/residue may be suboptimal;
- no visible-residue and format facts never independently change the verdict;
- a direction mismatch (`volume` with `standard_refresh`, or `less_volume` with `volume_texture`) is supportive rather than mismatch;
- unknown catalog facts never become an optimistic pass.

The Stage-2 assessment payload is:

```ts
interface DryShampooFitAssessment {
  requiredJob: 'root_refresh'
  requiredSensitivity: 'sensitive_ok' | 'normal'
  preferredStylingEffect: DryShampooStylingEffect | null
  requiredHairColorFit: DryShampooHairColorFit | null
  matchedFacts: DryShampooReasonCode[]
  limitationFacts: DryShampooReasonCode[]
  verdict: FitVerdict
  cadenceAdjustment: DryShampooCadenceAdjustment
  executionState: DryShampooExecutionState
}
```

The product tile shows what the product needs to do, the decisive matches, and at most one decisive limitation/switch reason. A fitting product used five to six times weekly can therefore remain `passt sehr gut` while separately receiving:

> Das Produkt eignet sich für dich. Du nutzt es aktuell aber zu häufig – reduziere es auf eine kurze Brücke zwischen Waschtagen.

## Exact-product selection

Selection order:

1. verified identity, lifecycle, and category membership;
2. sensitivity and resolved hair-colour compatibility;
3. `volume` prefers `volume_texture`; `less_volume` prefers `standard_refresh`; with neither, both are acceptable;
4. preserve a suitable owned product before proposing an unnecessary replacement;
5. use curated catalog priority and then stable catalog order for a remaining tie.

Format has no global preference order. The winning suitable product brings its format. Stage 2 may show an equally suitable alternative-format tile such as:

> Gleiche Eignung, aber als Schaum statt Spray.

Recommend at most one new Dry Shampoo. An `ideal` candidate wins; a `supportive` candidate may be offered with its limitation when no ideal candidate exists because the category is optional and no purchase is forced. `mismatch` and `unknown` are never confident recommendations.

### Late-bound tint resolution

Hair colour is not part of current onboarding. Universal products may be selected without another question. When a tinted candidate is otherwise preferred, Stage 2 asks inline for one reusable variant fact:

- hell/blond;
- braun;
- dunkel.

The answer belongs to the proposed plan input and resolves the tinted variant before confirmation. This is a shared late-binding pattern for uncollected variant/preference attributes, not a Dry Shampoo-specific parallel architecture.

This inline answer represents visible hair-colour/tint fit only. It does not record whether the hair is colour-treated, does not establish colour-care compatibility, and does not introduce the deferred cross-category colour-care topic. In the worst case it is asked once at the moment a tinted candidate actually needs resolution; universal products require no question.

## Product allocation and reconciliation

- Users may save several owned Dry Shampoos.
- Exactly one active/main product is assessed and eligible for Stage-3 use.
- Prefer an explicitly selected main product; otherwise select the first entered product with stable ordering.
- Additional owned products stay saved and visible but are not ranked, rotated, scheduled, or independently analysed in V1.
- Do not create a primary/secondary rotation model for this category.
- Switching the main product reruns assessment and creates a proposed successor that requires confirmation.
- Opening a shopping link never marks the recommendation as acquired.
- A pending product appears immediately as `Noch in Prüfung` but does not receive a fit verdict or executable instruction.
- A currently confirmed active product remains active while a submitted replacement is pending.
- If the pending product is the only product, Stage 2 shows it but Stage 3 creates no exact-product step.

Pending and purchase behavior follows the shared cross-category lifecycle; this category does not create a second state machine.

## Stage 1 presentation

Dry Shampoo appears only in the Optional section. It is absent when `not_needed`.

Core explanation:

> Nimmt überschüssiges Fett am Ansatz auf und frischt ihn optisch auf.

Personal reason:

> Weil dein Ansatz zwischen deinen geplanten Waschtagen schneller nachfetten kann.

When inclusion comes from existing use, the personal reason may instead acknowledge the user's current preference. A pause state adds `Aktuell pausieren` without removing the card.

## Stage 3 application

Dry Shampoo is an optional non-wash-day action. Use one standardized protocol per format; an exact verified product protocol may override only materially different instructions.

### Aerosol spray

1. Use on dry roots and section the hair as needed.
2. Shake and spray sparingly onto the roots.
3. Let it sit briefly.
4. Massage in and brush out thoroughly.

### Aerosol foam

1. Use a small amount at the roots of dry hair.
2. Distribute through the roots.
3. Let it dry completely, either in the air or with cool blow-drying.
4. Style as usual.

### Non-aerosol liquid

1. Section the dry roots and apply sparingly.
2. Let the liquid dry briefly.
3. Work it in with a towel, brush, or cool air as the verified product directions permit.

Shared application rules:

- do not apply over active irritation, dry flakes, active dandruff, or visible buildup;
- do not invent universal centimetres, pumps, tennis-ball quantities, or exact dwell seconds in the category fallback;
- record a completed use as one Dry Shampoo occurrence;
- after the second logged occurrence since the last wet wash, recommend the wet wash next.

## Structured reasoning

Stable reason families:

- existing Dry Shampoo preference;
- oily roots between recommended wet washes;
- sensitive-scalp product positioning;
- standard-refresh versus volume/texture direction;
- universal or resolved tint fit;
- frequency reduction;
- temporary scalp/buildup pause;
- pending or unverified product facts.

The engine emits reason codes and structured facts. Presentation maps them to compact German copy and does not invent medical, cleansing, or efficacy claims.

## Required deterministic fixtures

1. existing Dry Shampoo use -> `optional` without asking the bridge question;
2. oily roots plus non-wash days plus accepted bridge -> `optional`;
3. same profile plus declined bridge -> `not_needed` and absent;
4. no existing use and no bridge-question condition -> `not_needed`;
5. volume goal plus `volume_texture` product -> `ideal`;
6. less-volume goal plus `volume_texture` product -> `supportive`;
7. neither volume direction -> either styling effect remains acceptable;
8. sensitive scalp plus `sensitive_ok` -> `ideal` when all other facts fit;
9. sensitive scalp plus `normal_only` -> `supportive`;
10. normal scalp plus either sensitivity positioning -> no sensitivity limitation;
11. universal hair-colour fit -> compatible without a tint question;
12. resolved wrong tint -> `supportive`, not mismatch;
13. otherwise preferred tinted candidate with unresolved colour -> request inline variant resolution before confirmation;
14. verified product used up to three to four times weekly -> no average-frequency warning solely from that fact;
15. fitting product used five to six times weekly -> fit verdict retained plus `decrease_frequency`;
16. fitting product used daily -> fit verdict retained plus stronger `decrease_frequency`;
17. active irritation -> category remains visible when included and execution pauses;
18. active dandruff or dry flakes -> execution pauses and scalp route takes precedence;
19. visible buildup/repeated layering -> execution pauses until wet wash;
20. known product reaction -> `mismatch` and stop/reassess guidance;
21. pending product -> `unknown` and no executable step;
22. pending replacement plus confirmed active product -> confirmed product stays active;
23. missing required hard catalog fact -> `unknown`;
24. two owned products -> selected/first is assessed; the other stays saved and unanalysed;
25. supportive candidate and no ideal catalog candidate -> may be offered with explicit limitation, never forced;
26. equally suitable different format -> alternative-format comparison, no fit downgrade;
27. each of the three V1 formats compiles its corresponding standardized protocol;
28. after one logged occurrence since wet wash -> another optional occurrence remains possible;
29. after two logged occurrences since wet wash -> next relevant suggestion is wet wash;
30. main-product change -> proposed successor and no silent active-plan mutation.

## Launch/data gate

Dry Shampoo participates in the shared two-step rollout. The canonical schema migration and deterministic runtime may land inert first. Its workstream in the single shared cross-category follow-up enrichment PR then verifies the complete canonical spec for all 10 currently active recommended products, including the two exact format splits above, before activation.

Before confident exact Dry Shampoo recommendations launch:

- all 10 active recommended products must be backfilled to the canonical product specification;
- each active recommended product must have verified identity, format, styling effect, hair-colour fit, and sensitivity positioning or an honest `unknown` state;
- pending/unverified products must never be promoted to a confident recommendation;
- category tests must cover every rule and fixture above;
- the current runtime cadence thresholds must be replaced by this single confirmed Personal Plan policy rather than partially reused.

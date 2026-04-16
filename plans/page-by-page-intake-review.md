# Page-By-Page Intake Review

Last updated: 2026-04-15
Status: Working decisions from the live architecture review

## Scope

This document captures agreed decisions from the page-by-page review of the quiz and onboarding flow.
Source of truth is the current codebase. External hair-care research is used only where we explicitly want a second opinion on product logic or user-facing questions.

## Pages 1-3

### Page 1: Landing

Decision:
- Keep as a pure entry/conversion page.
- No recommendation logic or profile state should depend on it.

Reasoning:
- This page has no decision value for recommendation quality.
- Treat copy/design updates here as UX work, not engine work.

### Page 2: Haartextur

Current code:
- Stored as `hair_profiles.hair_texture`.
- Used in leave-in eligibility/logic, routine planning, and goal-card selection.

Research summary:
- AAD says leave-in conditioners are especially relevant for curly hair, dry/brittle hair, tangled/frizzy/flyaway hair, heat-styled hair, color-treated/permed hair, and even fine/limp hair when the formula is matched correctly. AAD also notes leave-ins can help with smoothing, shine, detangling, styling manageability, and sometimes heat protection.
- AAD also says curly/coily hair is more prone to dryness and breakage and benefits from ongoing moisturization.
- Professional curl practice consistently treats wavy/curly/coily users as split across at least two intent families:
  - enhance pattern/definition
  - smooth/relax/soften the pattern

Working decisions:
- `hair_texture` is a guaranteed upstream input for completed users. If it is missing after the quiz flow, treat that as an upstream data-integrity failure, not normal user ambiguity.
- Keep `hair_texture` as a required profile input for leave-in logic, but use it for the right reason:
  - pattern/definition/smoothing decisions
  - not primary weight control
- Leave-in heaviness should continue to be driven mainly by `thickness` and `density`, not `hair_texture`.
- Resolve the current product gap by adding a textured-hair goal for users who want a smoother or less-defined finish instead of enhanced pattern.
  - Working label direction: `smooth_finish` / `less_definition`
- Keep texture-specific onboarding goals, but revise them:
  - `wavy`: add a smoother/less-defined option and consider a volume option
  - `curly`: add a smoother/less-defined option
  - `coily`: replace vague `healthier_hair` language with explicit strength/breakage language and consider adding a definition vs elongation choice
- Retrieval should use `hair_texture` as a soft relevance signal, not a hard blocker for general advice.
- The retrieval stack already supports metadata hard filters in principle, but current chunk metadata is not enriched enough to filter reliably on `hair_texture`.

Leave-in bucket note:
- Current buckets are directionally useful but not perfectly aligned with external practice.
- The biggest gap is that detangling/smoothing/manageability is not explicit enough.
- Working direction:
  - keep `heat_protect`
  - keep `curl_definition`
  - keep `repair`
  - evolve `moisture_anti_frizz` toward a broader detangle/smooth/moisturize role
  - keep shine/color support as secondary logic, unless future testing shows it deserves a primary bucket

### Page 3: Haardicke

Current code:
- Stored as `hair_profiles.thickness`.
- Hard gate for shampoo, conditioner, leave-in, and oil.
- Retrieval/profile boosting signal.
- Mask logic currently uses it at rerank stage instead of up-front eligibility.

Working decisions:
- Keep `thickness` as a strict, high-trust field.
- Keep hard-gate behavior for shampoo, conditioner, leave-in, and oil.
- Keep retrieval boosting for matching thickness.
- Move mask recommendations closer to the other categories for architectural cleanliness:
  - still derive "does this user need a mask?" from damage/treatment/stress signals
  - but require `thickness` before recommending a specific mask

Reasoning:
- The current mask flow is defensible, but it is harder to explain because thickness matters late instead of early.
- Since quiz completion is expected to be guaranteed, aligning mask logic with the other categories should improve consistency at low UX cost.

## Implementation Directions Captured So Far

1. Treat missing `hair_texture` for completed quiz users as a data-quality bug, not a normal steady-state path.
2. Add a "smooth / less defined" textured-hair goal so the engine can distinguish:
   - "I want to enhance my waves/curls/coils"
   - "I want my waves/curls/coils calmer and smoother"
3. Revisit leave-in bucket naming so detangling/smoothing/manageability is explicit.
4. Add `hair_texture` as a retrieval boost after chunk metadata is enriched to support it.
5. Make mask recommendation requirements more parallel to the other product categories by requiring `thickness` before final product recommendation.

## Pages 4-5

### Page 4: Oberflaechentest

Current code:
- Stored as `hair_profiles.cuticle_condition`.
- Used for conditioner repair level, leave-in need derivation, and routine damage/dryness logic.
- Not currently included directly in mask need derivation.

Working decisions:
- Keep the current conditioner cascade:
  - `smooth` -> low repair
  - `slightly_rough` -> medium repair
  - `rough` -> high repair
- Bring leave-in logic closer to the same repair cascade so it is easier to explain across categories.
- Include `cuticle_condition` in the general damage assessment that also informs mask likelihood.
- Keep using this page as a trusted signal; it is subjective, but still useful enough to matter.

Reasoning:
- This page is a good proxy for surface damage and manageability issues.
- The current logic is directionally sound, but it is spread across category-specific implementations instead of being expressed once and reused.

### Page 5: Zugtest

Current code:
- Stored as `hair_profiles.protein_moisture_balance`.
- Hard requirement for conditioner recommendations.
- Used to determine mask type and to strengthen mask need.
- Used in routine planning damage logic.
- Only indirectly relevant to current leave-in logic.

Working decisions:
- Keep this as a mandatory field for conditioner.
- Pull it into a shared general damage assessment layer rather than leaving it fragmented across conditioner, mask, routine, and leave-in logic.
- Let high-damage outcomes influence leave-in behavior more directly.
  - Working direction: strong damage should increase the likelihood of recommending a rinse-off conditioner plus a leave-in, rather than treating leave-in as a purely styling/goals-driven category.
- Preserve category-specific nuances on top of the shared assessment:
  - conditioner still needs balance-specific mapping
  - mask still needs moisture/protein/performance typing
  - routine still needs to explain the type of damage, not just the severity

## Shared Logic Direction

New cleanup target:
- Create a shared `damage assessment` layer that derives reusable signals from:
  - structural inputs:
    - `cuticle_condition`
    - `protein_moisture_balance`
    - `chemical_treatment`
  - heat inputs:
    - precise heat frequency
    - `drying_method`
    - heat-tool usage context
    - heat-protection coverage derived from onboarding behavior and `user_routine_items`
  - mechanical inputs:
    - `towel_material`
    - `towel_technique`
    - `brush_type`
    - `night_protection`
  - optional concern-page inputs such as:
    - `hair_damage`
    - `split_ends`
    - `breakage`
    - `dryness`
    - `frizz`
    - `tangling`

This shared layer should output at least:
- general damage severity
- damage drivers
- likely repair need
- balance direction where relevant

Then consume it differently by category:
- conditioner: repair level + balance need + weight
- mask: need strength + mask type + weight
- leave-in: repair-likelihood uplift, especially when damage is high
- routine: topic activation and explanation

## Pages 6-7

### Page 6: Kopfhaut

Current code:
- Stored as `hair_profiles.scalp_type` and `hair_profiles.scalp_condition`.
- Shampoo logic treats `scalp_condition` as higher priority than `scalp_type`.
- If `scalp_condition === "none"`, `scalp_type` becomes mandatory for shampoo.
- Oil logic currently only uses scalp state as adjunct context, not as a strong blocker.

Working decisions:
- Keep the shampoo hierarchy:
  - active scalp issue first
  - baseline scalp type second
- This design assumes the user profile is updated once an active scalp issue resolves.
- Treat stale scalp profile data as a known product risk:
  - the architecture works if profile data is current
  - it does not self-expire resolved scalp conditions
- Tighten oil logic later if needed:
  - current code does not strongly block scalp-oiling-style guidance for active scalp issues
  - it mostly adds cautionary language and adjunct support framing

Reasoning:
- The scalp hierarchy is clinically and product-wise sensible.
- The weak point is lifecycle management of scalp conditions, not the decision rule itself.

### Page 7: Chemisch Behandelt

Current code:
- Stored as `hair_profiles.chemical_treatment` array.
- Used in conditioner repair logic, leave-in repair logic, mask need logic, and routine damage/bond-builder logic.
- Quiz currently allows multi-select.

Working decisions:
- Feed this strongly into the shared damage assessment layer.
- Keep `colored` + `bleached` coexistence possible.
- Make `natural` mutually exclusive with any treated state.
- Keep chemical treatment as one of the strongest damage-severity inputs in the system.

Reasoning:
- This field is one of the clearest proxies for structural damage exposure.
- The only cleanup need is selection semantics, not importance.

## Onboarding Structure Direction

### Welcome

Decision:
- Keep as a pure UX/funnel step.
- No recommendation logic dependency.
- Basic funnel analytics are enough.

### Product Basics + Product Extras

Core product decision:
- Treat `products_basics` and `products_extras` as one conceptual data model:
  - current routine inventory
- The split between them is only UX, not data architecture.

Current problem:
- `user_product_usage` currently behaves like a current-state detail table.
- `hair_profiles.current_routine_products` separately behaves like a runtime inventory cache.
- The onboarding flow currently mirrors selected categories into `current_routine_products`, but only through a limited compatibility mapper.
- This means some extra categories are lost or collapsed before runtime because the compatibility layer only preserves an old subset.

Recommended redesign from first principles:

Primary runtime source of truth:
- Replace the current split model with a single structured table for current routine inventory.
- Working name: `user_routine_items`

Suggested table shape:
- `id`
- `user_id`
- `category`
- `product_name`
- `frequency_band`
- `updated_at`
- unique `(user_id, category)`

Category should include both basics and extras:
- `shampoo`
- `conditioner`
- `leave_in`
- `oil`
- `mask`
- `heat_protectant`
- `peeling`
- `dry_shampoo`
- `bondbuilder`
- `deep_cleansing_shampoo`
- and any later styling/support categories we intentionally expose

Meaning of the fields:
- `category`: is this product type currently part of the user's routine?
- `product_name`: which exact product is it, if the user knows it?
- `frequency_band`: how often is it used?

Important modeling choice:
- This is not a usage-history table.
- It is a current-state routine-inventory table with optional details.
- If the user deselects a category, delete the row or mark it inactive; do not pretend we are storing longitudinal history.
- V1 should support one active routine item per category only.
- Rotation / multiple active products in the same category can be a later extension.

What to do with `hair_profiles.current_routine_products`:
- Remove it as an independent source of truth.
- Derive the category list from `user_routine_items`.
- If a fast array is still desirable, treat it as a computed cache, not canonical state.

What to do with `hair_profiles.products_used`:
- Do not extend it as part of the new architecture.
- If it remains temporarily for legacy/profile-display reasons, treat it as non-canonical legacy context only.
- Do not introduce a new `routine_notes` fallback field.

Why this is cleaner:
- One source of truth for current routine inventory
- Basics and extras collapse naturally into the same model
- Drilldown data lives exactly where it belongs
- Runtime can reason over both presence and details without synchronization drift
- No ambiguity about whether `user_product_usage` is history vs current state

### Product Drilldown

Decision:
- Keep the drilldown page, but treat it explicitly as detail enrichment for `user_routine_items`.
- User mental model:
  - step 1: which product types are part of my routine?
  - step 2: which exact ones and how often?

Planned downstream uses for the structured detail:
- routine completeness
- addition vs replacement wording
- buildup/load heuristics
- bond-builder and deep-cleanse awareness
- later: deterministic overuse / mismatch rules if we decide to add them

Locked decisions:
- `user_routine_items` becomes the canonical persisted routine-inventory model.
- `hair_profiles.current_routine_products` should no longer be the source of truth.
- Do not add a generic free-text `routine_notes` field as a fallback.
- If an edge case matters, model it explicitly in structured data instead of relying on free text.

Additional decisions:
- All onboarding extras should be first-class routine categories with their own deterministic rules.
- Per-category frequency should become a real deterministic input, not shampoo-only metadata.
- Exact product names should be stored now and later used for deeper product-specific pattern detection.
- `heat_protectant` should be a first-class routine category.
- It is collected in the heat UX cluster even though it is not asked on the basics/extras pages.

### Profile freshness for scalp conditions

Lightweight lifecycle fix:
- Add a timestamp such as `scalp_state_updated_at`.
- If `scalp_condition !== none` and the timestamp is old, ask for reconfirmation on scalp-relevant turns.
- Optionally show a low-friction in-app nudge to refresh the scalp state.
- Do not auto-expire the field silently.

## Phase 2: Routine Inventory Rule Design

Recommended sequencing:
- finish the page-by-page intake review first
- then design deterministic routine-inventory rules on top of the final agreed input model

Why:
- remaining onboarding pages still add important signals for rule design
- especially heat, post-wash behavior, mechanical stress, and goals

Rule families to define after the intake review:
- routine completeness
- addition vs replacement
- frequency normalization and overuse checks
- bond-builder awareness
- deep-cleansing awareness
- heavy-routine / weigh-down risk

Working examples of what `user_routine_items` should eventually support:
- `category missing` -> candidate for add
- `category present but mismatched to profile` -> candidate for replace
- `category present but cadence risky` -> candidate for usage adjustment
- `bondbuilder absent + high damage assessment` -> candidate for add
- `deep_cleansing_shampoo absent + buildup-heavy routine` -> candidate for add
- `oil + leave_in + mask + other rich categories in fine hair` -> weight-risk cluster

## Shared Damage Assessment Spec

Core design decision:
- Do not reduce everything to one flat score.
- Build one shared `damage_assessment` object with:
  - overall severity
  - damage sub-dimensions
  - active damage drivers
  - active protective factors
  - confidence / completeness

Important boundary:
- Damage assessment answers:
  - "How stressed or damaged is the hair, and by what?"
- A separate later layer should answer:
  - "Do the user's habits support or undermine their goals?"
- Example:
  - boar-bristle brush may be neutral-to-helpful for shine
  - but not supportive for curl-definition routines
- That is goal-alignment logic, not damage scoring.

### Inputs

Primary structural inputs:
- `cuticle_condition`
- `protein_moisture_balance`
- `chemical_treatment`

Primary heat inputs:
- precise heat frequency
- `drying_method`
- heat-tool usage context
- heat-protection usage derived from `user_routine_items`

Primary mechanical inputs:
- `towel_material`
- `towel_technique`
- `brush_type`
- `night_protection`

Symptom/context inputs:
- concerns such as `hair_damage`, `split_ends`, `breakage`, `dryness`, `frizz`, `tangling`

Inputs that should usually not directly change damage severity:
- `hair_texture`
- `thickness`
- `density`
- `goals`

These belong mainly to interpretation and downstream recommendation fit, not to the base damage state.

### Proposed output shape

```ts
interface DamageAssessment {
  overall_level: "none" | "low" | "moderate" | "high" | "severe"
  overall_score: number

  structural_level: "none" | "low" | "moderate" | "high" | "severe"
  heat_level: "none" | "low" | "moderate" | "high" | "severe"
  mechanical_level: "none" | "low" | "moderate" | "high" | "severe"

  repair_priority: "low" | "medium" | "high"
  balance_direction: "protein" | "moisture" | "balanced" | null
  bond_builder_priority: "none" | "consider" | "recommend"

  active_damage_drivers: string[]
  active_protective_factors: string[]

  confidence: "low" | "medium" | "high"
  missing_inputs: string[]
}
```

### Scoring direction

Structural damage should carry the most weight:
- `cuticle_condition`
  - `smooth` -> low structural concern
  - `slightly_rough` -> moderate structural concern
  - `rough` -> high structural concern
- `protein_moisture_balance`
  - `stretches_bounces` -> balanced baseline
  - `stretches_stays` -> protein-direction structural weakness
  - `snaps` -> strong dryness/brittleness signal
- `chemical_treatment`
  - `colored` -> moderate structural load
  - `bleached` -> high structural load

Heat damage should be staggered by actual frequency:
- preserve all onboarding frequency levels
- raise heat severity as frequency rises
- increase it further when heat protection is absent
- treat protection as a meaningful reducer, but not as a reset to zero
- working calibration direction:
  - protected frequent heat should still score as meaningful heat load
  - unprotected frequent heat should score materially worse than protected frequent heat
  - the protected vs unprotected spread should be larger than a single-point cosmetic tweak

Mechanical damage should combine friction and protection:
- negative drivers:
  - rough towel material
  - `rubbeln`
  - higher-stress brush choices
  - no night protection
- protective factors:
  - gentler towel material
  - `tupfen` / scrunching
  - lower-stress brush choices
  - satin/silk / loose night protection

### Key derived semantics

`repair_priority`
- mostly driven by structural damage
- used by conditioner, mask, leave-in, and routine wording
- derivation direction:
  - base from `cuticle_condition`
  - raise with `chemical_treatment`
  - raise with strong heat load
  - raise with strong mechanical load
  - raise with explicit damage symptoms such as `hair_damage` and `split_ends`

`balance_direction`
- comes primarily from `protein_moisture_balance`
- should remain more specific than the general damage score
- derivation direction:
  - `stretches_stays` -> `protein`
  - `snaps` -> `moisture`
  - `stretches_bounces` -> `balanced`
  - if pull-test input is missing, keep `null` rather than guessing from the global damage score

`bond_builder_priority`
- strongest when damage is both structural and meaningful
- likely trigger pattern:
  - bleached
  - snaps
  - high heat
  - high structural severity
- derivation direction:
  - `none` when structural damage is low
  - `consider` when repair need is meaningful but not extreme
  - `recommend` when structural damage is high/severe, especially with bleach + brittleness patterns

Locking note:
- `bond_builder_priority` should not simply mirror `overall_level`.
- It should be triggered by specific structural-damage patterns, not by any generic high-damage state.
- This means:
  - high heat alone should not automatically imply bond-builder care
  - high mechanical stress alone should not automatically imply bond-builder care
  - high overall damage can raise the likelihood, but the strongest trigger remains chemically or structurally compromised fiber

Working trigger direction:
- `none`
  - low/moderate structural damage without clear brittleness / bleach pattern
- `consider`
  - meaningful repair need plus at least one structural red flag, for example:
    - `bleached`
    - `snaps`
    - `rough` cuticle with strong damage symptoms
    - `colored` plus high heat and breakage
- `recommend`
  - severe structural pattern, especially:
    - `bleached` + `snaps`
    - `bleached` + `rough`
    - `bleached` + `breakage` or `hair_damage`
    - very high structural severity even if not all signals are present

Category implication:
- `bond_builder_priority` is a bondbuilder/routine specializer on top of `repair_priority`, not a replacement for it.
- High `repair_priority` without a strong structural/bond signal can still warrant rich repair masks or conditioner-focused care without specifically routing to bond-building logic.

### Category consumption

Conditioner:
- read `repair_priority`
- read `balance_direction`
- still combine with thickness/density for weight

Mask:
- read `overall_level` and sub-levels to decide need strength
- read `balance_direction` for moisture/protein/performance type
- still combine with thickness for weight fit

Leave-in:
- read heat and repair dimensions
- read `balance_direction` too
- use damage severity to increase likelihood of recommending rinse-off conditioner plus leave-in in higher-damage cases
- still keep styling context and goals important
- this is especially relevant for future leave-in matching when deciding:
  - protein-leaning support
  - moisture-leaning support
  - balanced/performance support

Routine planner:
- read the full object
- turn drivers and missing protections into behavior advice
- explain *why* a routine needs repair/protection/reset changes

Shampoo and oil:
- mostly indirect use
- they do not become repair products, but can react to relevant context and avoid conflicting advice

### Brush and habit note

Brushes, towel choices, drying choices, and night protection should influence:
- damage assessment
- and later, a separate goal-alignment layer

Examples:
- scrunching:
  - protective vs rubbing for everyone
  - definition-supportive for wavy/curly/coily users
- boar bristle:
  - contextual rather than blanket-damaging
  - more compatible with shine/smoothing than with curl-definition routines

### Symptoms source

Current source:
- mostly `hair_profiles.concerns`

Important examples:
- `dryness`
- `frizz`
- `hair_damage`
- `split_ends`
- `breakage`
- `tangling`

Working direction:
- treat symptoms as optional supporting evidence, not as the primary foundation of the damage model
- structural and behavior inputs should remain primary
- symptoms can strengthen or confirm priorities such as repair

Current intake gap:
- current quiz + onboarding do not reliably collect `concerns`
- today, `concerns` mainly come from:
  - the manual profile editor
  - legacy / pre-existing profile data
- therefore the shared damage assessment should not depend on symptoms being present
- if symptoms exist, they can sharpen the assessment; if not, the model should still work cleanly

Recommended intake fix:
- add a quiz page for current hair pain points / concerns
- suggested user framing:
  - "Was ist gerade dein groesster Pain Point mit deinem Haar?"
- allow selecting up to 2 concerns
- place this as the last page of the quiz, after chemical treatment

Recommended concern set for this page:
- `dryness`
- `frizz`
- `split_ends`
- `breakage`
- `hair_damage`
- `tangling`
- `other` (free text)

Why keep it narrow:
- these are current user-perceived symptoms that sharpen care and damage interpretation
- they map cleanly into either structural wear or manageability needs:
  - structural sharpeners:
    - `split_ends`
    - `breakage`
    - `hair_damage`
  - care / manageability sharpeners:
    - `dryness`
    - `frizz`
    - `tangling`
- other topics are already captured elsewhere:
  - `dandruff`, `oily_scalp` -> scalp page
  - `colored` -> chemical treatment page
- some common cosmetic wishes should stay in goals instead of concerns:
  - `lack_of_shine` / dullness -> shine goal
  - `more_volume` / `less_volume` -> volume goals
- medically adjacent topics should not be mixed into this page:
  - `hair_loss`
  - `thinning`
- `other` should exist as an escape hatch for user expression, but should not enter deterministic logic.

Architecture note:
- current `concerns` vocabulary is mixed and should be cleaned up over time
- ideal direction:
  - user pain points / current concerns
  - scalp state
  - treatment history
  - medically adjacent topics
  should not all share one flat bucket
- for the shared damage/care logic in this flow, only these concern-page signals should feed in directly:
  - `dryness`
  - `frizz`
  - `split_ends`
  - `breakage`
  - `hair_damage`
  - `tangling`
- free-text `other` should be collected for user research and shown in the profile alongside other intake information
- free-text `other` should not affect deterministic logic or prompt-derived recommendation behavior in v1

Possible future extension:
- if we later want the assessment to react to the current conversation, add a separate temporary conversational symptom layer
- example:
  - profile says low damage
  - current message says "my hair suddenly feels extremely brittle after bleaching"
  - temporary turn-level signal can raise urgency without overwriting persisted profile state

Moisture note:
- remove `moisture_priority` from the base damage model
- hydration / anti-frizz / moisture-forward need should be handled in a later care-need layer
- that later layer can combine:
  - damage assessment
  - symptoms such as dryness / frizz
  - goals
  - texture
  - styling context

## Follow-on Layer: Care Need Assessment

Clean architecture direction:
- Step 1: `damage_assessment`
- Step 2: `care_need_assessment`

Purpose of `care_need_assessment`:
- translate damage state plus user context into care-direction needs
- keep this separate from the raw damage model
- keep it fiber-focused rather than mixing in scalp state or routine inventory
- answer the abstract question:
  - "what kind of support does the hair fiber need?"
- do not answer the intervention question:
  - "should we add, replace, increase, or decrease something in this user's routine?"

Likely outputs:
- hydration_need
- smoothing_need
- detangling_need
- definition_support_need
- thermal_protection_need
- volume_direction

Likely inputs:
- damage assessment
- current concern-page signals
- goals
- hair texture
- styling and drying context

Important exclusions:
- scalp state should stay in its own lane
- routine inventory should stay in its own lane
- `repair_priority` should stay in `damage_assessment`, not be duplicated here
- deep-cleansing need should not live here either:
  - it belongs to a later cleanse / buildup / scalp-maintenance decision layer or to category-specific shampoo logic

## Follow-on Layer: Intervention Planner

Clean architecture direction:
- Step 1: `damage_assessment`
- Step 2: `care_need_assessment`
- Step 3: `intervention_planner`

Purpose of `intervention_planner`:
- translate abstract needs into concrete routine actions
- answer the question:
  - "what should we change in this user's actual routine right now?"
- keep this separate from both:
  - the raw fiber-state diagnosis
  - the abstract support-direction layer

Primary inputs:
- `damage_assessment`
- `care_need_assessment`
- `user_routine_items`

Secondary inputs:
- scalp state
- goals
- hair texture
- thickness / density
- washing frequency
- styling and drying behavior

Core output verbs:
- `add`
- `replace`
- `increase_frequency`
- `decrease_frequency`
- `keep`
- `remove`
- `behavior_change_only`

Working intent:
- if a need can be solved by adjusting an existing category, prefer that over automatically adding a new one
- if a category is missing entirely and the need is strong, `add`
- if a category exists but is mismatched, `replace`
- if a category exists and is directionally right but underused, `increase_frequency`
- if a habit or category is contributing to overload, dryness, or conflict, `decrease_frequency` or `remove`
- if the highest-value fix is behavioral, do not force a product action

Examples:
- strong hydration need + mask already present but rarely used -> `increase_frequency`
- strong thermal protection need + no heat protectant in routine -> `add`
- high dryness + daily shampoo + no scalp reason for that frequency -> `decrease_frequency`
- strong repair need + current leave-in not aligned with repair route -> `replace`
- frizz/definition conflict driven mainly by rough drying habits -> `behavior_change_only`

### Frequency Modeling

Backend recommendation:
- do not model frequency adjustments as only:
  - `more`
  - `less`
- that loses too much information for planner logic, auditing, and UI explanation

Keep the stored input simple:
- `frequency_band`
  - `rarely`
  - `1_2x`
  - `3_4x`
  - `5_6x`
  - `daily`

But derive planner-friendly fields:
- `frequency_rank`
  - ordinal 0-4 for comparisons
- `target_frequency_band`
  - the explicit target the planner wants to move toward
- `coverage_status`
  - `underused`
  - `matched`
  - `overused`
  - `not_applicable`
  - `unknown`

Why this is better:
- preserves the user's current state
- supports clear planner actions
- avoids vague "use it more" recommendations
- makes auditing and observability much easier

Important modeling nuance:
- not every category should be interpreted as an absolute weekly frequency
- some categories are better modeled relative to another event stream

Important architecture clarification:
- distinguish between:
  - `cadence_family`
    - how a category's usage frequency is interpreted
  - `planner_lane`
    - which categories need to be reasoned about together when resolving conflicts or composing a routine
- without this split, categories like `dry_shampoo`, `deep_cleansing_shampoo`, and `peeling` end up belonging to multiple "families" for different reasons and the model becomes ambiguous

Recommended cadence families:

1. Baseline cleansing
- examples:
  - `shampoo`
- interpret relative to:
  - scalp state
  - wash cadence
  - buildup/reset pressure

2. Wash-coupled categories
- examples:
  - `conditioner`
  - `leave_in`
- interpret relative to `wash_frequency`
- core question:
  - "how often is this used compared with how often the user washes?"

3. Heat-coupled categories
- examples:
  - `heat_protectant`
- interpret relative to heat frequency
- core question:
  - "is protection used whenever heat is used?"

4. Scheduled treatment categories
- examples:
  - `mask`
  - `bondbuilder`
  - `deep_cleansing_shampoo`
  - `peeling`
- interpret as scheduled treatment or reset cadence
- do not force them into every-wash logic

5. Bridge / substitute categories
- examples:
  - `dry_shampoo`
- interpret relative to wash cadence and scalp needs
- overuse matters as much as underuse

6. Purpose-driven categories
- examples:
  - `oil`
- frequency should stay secondary to subtype/purpose
- planner should be cautious with exact cadence until use purpose is known

Recommended planner lanes:

1. `scalp_reset`
- `shampoo`
- `dry_shampoo`
- `deep_cleansing_shampoo`
- `peeling`

2. `core_fiber_care`
- `conditioner`
- `mask`
- `bondbuilder`

3. `after_wash_support`
- `leave_in`
- `heat_protectant`

4. `purpose_support`
- `oil`

Lean canonical planner output for frequency decisions:
- `category`
- `current_frequency_band`
- `target_frequency_band`
- `reason_codes`

Derived/debug fields when needed:
- `frequency_rank`
- `change_direction`
- `delta_steps`
- `coverage_status`

Reason code examples:
- `underused_for_wash_cadence`
- `missing_for_heat_events`
- `overused_for_scalp_state`
- `overused_for_damage_state`
- `sufficient_current_frequency`

### Frequency Rules By Category

Research-confidence note:
- strongest support exists for:
  - conditioner as regular post-shampoo care
  - heat protection before every heat event
  - reducing damaging grooming behaviors
  - avoiding dry shampoo as a long-term substitute for cleansing
- exact cadence for masks, bondbuilders, and deep-cleansing shampoos is more formulation-dependent
- for those categories, keep defaults conservative and allow product-specific instructions to override

#### Shampoo

Planner role:
- treat shampoo frequency as the base cadence around which several other categories are interpreted

Increase frequency when:
- scalp logic clearly justifies more frequent cleansing
- current shampoo use is too sparse for oily / buildup-prone / active-scalp needs

Decrease frequency when:
- dryness / structural stress is high
- daily or near-daily washing is present
- and there is no scalp-driven reason forcing that cadence

Guardrail:
- scalp needs outrank fiber-only dryness logic
- `dry_shampoo` should not be merged into shampoo itself, but it should be considered in the same cleanse/scalp-maintenance family when planner conflicts are resolved

#### Conditioner

Research direction:
- conditioner is generally recommended after shampooing and is one of the strongest friction-reducing / detangling / manageability supports

Planner interpretation:
- treat conditioner as wash-coupled
- target coverage should often be close to wash frequency, especially when dryness, tangling, frizz, damage, or chemical treatment are present
- generic planner target should not exceed wash frequency
- if future product design wants between-wash conditioner use or co-wash logic, that should be modeled explicitly rather than implied by the current cadence field

Increase frequency when:
- conditioner exists but is used less often than wash cadence would suggest
- and hydration / smoothing / detangling / repair needs are meaningful

Add when:
- no conditioner exists in the routine
- and no exceptional product/design rule says otherwise
- working default:
  - conditioner is baseline care, not an edge-case add-on

Keep when:
- conditioner coverage is already aligned with wash cadence

Replace before increasing when:
- the conditioner exists but is poorly matched to balance direction or repair need

#### Leave-in

Research direction:
- leave-in is targeted support, especially useful for dry, frizzy, tangled, brittle, heat-styled, or chemically treated hair

Planner interpretation:
- treat leave-in as wash-coupled, but only when the need is real
- do not force leave-in into every routine by default

Increase frequency when:
- strong hydration / smoothing / detangling / thermal-protection need exists
- and current leave-in use is sparse relative to wash cadence

Decrease frequency when:
- the hair is being weighed down
- care need is low
- or the leave-in is causing conflict with volume / lightness goals

Replace before increasing when:
- a leave-in exists, but it does not match the primary route:
  - heat protection
  - repair support
  - definition
  - smoothing / detangling

#### Heat protectant

Research direction:
- the strongest planner rule in this family
- if heat is used, protection should be used for those heat events

Planner interpretation:
- treat as heat-coupled, not wash-coupled
- target coverage should match heat frequency
- because the current onboarding question is boolean (`yes` / `no`), planner logic should initially treat this as coverage rather than exact product-item cadence
- later, if needed, richer consistency states can be added, but they are not required for the first useful rule set

Add when:
- heat frequency is meaningful
- no heat-protectant item exists

Keep when:
- protection coverage already matches heat behavior

Replace only later when:
- a structured product-catalog model exists
- and the current protection route can be identified as clearly inferior to another protection route

#### Mask

Planner interpretation:
- treat as a scheduled treatment category, not every-wash baseline care

Increase frequency when:
- repair / hydration need is meaningful
- the user already owns a suitable mask
- and current usage is too sparse for the need

Decrease frequency when:
- usage is very frequent
- and the hair profile suggests low need or risk of heaviness / overload

Add when:
- mask-level need is strong
- and no suitable mask exists

Important caution:
- target cadence should be conservative and may later depend on product type / instructions

#### Bondbuilder

Planner interpretation:
- treat as a scheduled special-treatment category
- only active when `bond_builder_priority` is `consider` or `recommend`

Increase frequency when:
- a bondbuilder exists
- `bond_builder_priority` is high
- and usage is currently very sparse

Add when:
- `bond_builder_priority = recommend`
- and no bondbuilder exists in the routine

Decrease or avoid when:
- structural pattern does not justify bond-building care

Important caution:
- exact bondbuilder cadence is product-specific and should stay conservative in generic planner logic

#### Deep-cleansing shampoo

Planner interpretation:
- treat as an occasional reset category, not a baseline frequency category
- keep it in the same scalp/reset planner family as shampoo, dry shampoo, and peeling

Increase frequency when:
- buildup / overload / styling-residue logic is strong
- and current reset cadence is absent or too sparse

Add or increase can also be justified when:
- oily scalp combines with signs of residue or heavy routine load
- but oily scalp alone should not automatically imply deep-cleansing shampoo

Decrease frequency when:
- dryness / damage is high
- and reset shampoo is being used too often

Add when:
- buildup or residue management need is real
- and no reset category exists in the routine

Guardrail:
- do not turn this into routine everyday care

Working buildup / reset-need heuristics:
- frequent dry shampoo use
- multiple residue-prone support categories present, for example combinations of:
  - oil
  - serum
  - styling products
  - heavy leave-in use
- low wash cadence relative to scalp oiliness or product load
- user-reported heaviness / residue / dull-feeling buildup from chat context
- oily scalp can strengthen the case, but should not be the sole trigger

#### Dry shampoo

Research direction:
- useful as a bridge, but not a replacement for regular shampoo-and-water cleansing

Planner interpretation:
- treat as a bridge / substitute category
- overuse matters as much as underuse

Decrease frequency when:
- use appears very frequent or habitual
- dryness, stiffness, residue, or scalp conflict is likely

Keep when:
- it is functioning as occasional between-wash support

Add only cautiously when:
- there is a genuine between-wash need
- and it does not conflict with scalp or dryness logic

#### Peeling

Planner interpretation:
- treat as a scalp/reset category
- closely analogous to `deep_cleansing_shampoo`, but more explicitly scalp-focused

Add only cautiously when:
- scalp/buildup logic supports it
- and irritation/dryness risk is not the bigger concern

Increase frequency when:
- scalp/reset need is real
- and current use is too sparse

Decrease or remove when:
- irritation, dryness, or over-exfoliation risk is present

Generic cadence cap:
- in generic logic, do not recommend peeling more often than every 2-3 weeks
- if product-specific instructions later justify a different cadence, treat that as an explicit override rather than the default PRD behavior

Guardrail:
- do not fold this into fiber-frequency logic

### Frequency Family Summary

Locked decisions:
- do not model routine frequency as only `more` / `less`
- keep stored product cadence as the simple onboarding enum:
  - `rarely`
  - `1_2x`
  - `3_4x`
  - `5_6x`
  - `daily`
- keep planner output lean:
  - `category`
  - `action`
  - `current_frequency_band`
  - `target_frequency_band`
  - `reason_codes`
- separate:
  - `cadence_family`
  - `planner_lane`
- use `cadence_family` for frequency interpretation:
  - baseline cleansing:
    - `shampoo`
  - wash-coupled:
    - `conditioner`
    - `leave_in`
  - heat-coupled:
    - `heat_protectant`
  - scheduled treatment:
    - `mask`
    - `bondbuilder`
    - `deep_cleansing_shampoo`
    - `peeling`
  - bridge:
    - `dry_shampoo`
  - purpose-driven:
    - `oil`
- use `planner_lane` for conflict resolution and orchestration:
  - `scalp_reset`
  - `core_fiber_care`
  - `after_wash_support`
  - `purpose_support`
- `conditioner` is baseline care:
  - default planner stance is to add it if absent
  - generic cadence should not exceed wash frequency
- `leave_in` is selective:
  - only tie it to wash cadence when care need exists
- `heat_protectant` is currently modeled as coverage, not exact cadence:
  - heat used + no protection = missing coverage
  - heat used + protection = covered
- `mask` and `bondbuilder` stay conservative:
  - scheduled-treatment logic
  - generic planner should rarely push above `1_2x` weekly without product-specific instructions
- `dry_shampoo` is a temporary bridge, not cleansing replacement
- `deep_cleansing_shampoo` and `peeling` belong to a scalp/reset lane and should be occasional
- `oil` frequency stays intentionally weak until subtype/purpose is known

Follow-on need:
- introduce a small `buildup_reset_need` signal inside the scalp/reset planner family
- likely drivers:
  - oily scalp
  - frequent dry shampoo use
  - heavy routine load / residue-prone categories
  - low wash cadence relative to oil / product load
  - user-reported heaviness / residue / coated dullness

#### Oil

Planner interpretation:
- frequency should remain purpose-dependent
- do not apply aggressive generic frequency targets without knowing subtype:
  - pre-wash oil
  - finishing / shine oil
  - scalp-oiling intent

Planner default:
- prefer `keep`, `replace`, or subtype clarification over hard frequency changes
- "until subtype exists" means:
  - until the system knows whether the routine item is being used as pre-wash oil, finishing oil, or scalp-oiling product
  - this can come from either structured intake later or message-level inference in chat

Evidence-informed planner principle:
- "as much product as needed, as little product as necessary"
- prefer solving a need with:
  - better behavior
  - better use of an existing category
  - or replacement of a mismatched item
  before adding a new category

### Intervention Planner Precedence

Recommended order of operations:

1. Respect scalp / cleansing guardrails first
- do not make fiber-care changes that conflict with scalp-driven cleansing needs
- if scalp state requires regular cleansing, do not blindly reduce shampoo frequency just because hair is dry

2. Fix obvious behavior drivers before forcing product expansion
- if the main driver is heat misuse, rough towel drying, rough brushing, or lack of night protection:
  - prefer `behavior_change_only` or a behavior-first intervention
- research support:
  - AAD consistently emphasizes reducing damaging grooming behaviors, minimizing rough handling, and using heat protection before styling

3. Optimize an already-present matching category before adding a new one
- if the user already owns the right category and it is merely underused:
  - prefer `increase_frequency`
- examples:
  - mask present but rarely used despite high repair/hydration need
  - conditioner present but wash cadence or use pattern is insufficient for current dryness/tangling

4. Replace mismatched products before stacking redundant ones
- if a category is present but poorly matched to the identified need:
  - prefer `replace`
- examples:
  - user has a leave-in, but no thermal protection despite frequent heat
  - user has a very heavy finish oil despite fine hair and volume goals
  - user has a low-repair conditioner despite strong structural damage

5. Add a category only when the need remains unmet
- prefer `add` when:
  - the need is strong
  - the user does not already have a fitting category
  - and behavior/frequency/replacement changes are not sufficient

6. De-escalate overload and buildup when routine complexity is creating conflict
- use `decrease_frequency` or `remove` when a category or habit is plausibly contributing to:
  - dryness
  - stiffness
  - excess weight
  - scalp irritation
  - buildup
- research support:
  - AAD warns that overuse of dry shampoo can lead to dryness, stiffness, grit, irritation, and the need to resume regular washing with shampoo and water

### Research Signals Supporting This Planner Shape

- Regular conditioner use is protective and improves manageability:
  - AAD recommends conditioner after washing, and reviews note conditioners reduce combing forces, friction, breakage risk, and improve detangling/manageability.
- Leave-in is especially useful for dry, frizzy, brittle, or tangled hair:
  - AAD positions leave-in as a targeted support layer rather than a universal default for everyone.
- Heat protection should be used before heat styling:
  - AAD and review literature support preventive protection before heat rather than only post-damage repair.
- Grooming technique matters:
  - AAD emphasizes gentler towel drying, less brushing, reduced heat, and lower manipulation of fragile/wet hair.
- Dry shampoo is not a replacement for regular cleansing:
  - AAD recommends washing with regular shampoo and water after one or two dry-shampoo uses and notes overuse can cause dryness, stiffness, and scalp issues.

### Action Decision Family

Goal of this family:
- decide *which kind of intervention* is correct for a category once need and current routine state are known

Working design principle:
- emit one primary product action per category
- a routine can still include:
  - multiple category actions
  - plus one or more behavior actions
- if a category needs both a different product and a different cadence:
  - the primary action should usually be `replace`
  - and the new target cadence can be carried in `target_frequency_band`

Required derived checks before action selection:
- `category_relevant`
  - does this category actually solve a current need?
- `category_present`
  - is the category present in `user_routine_items`?
- `category_fit`
  - if present, is it directionally matched to the need?
  - examples:
    - conditioner fit to `balance_direction` and repair need
    - leave-in fit to thermal / smoothing / definition / repair route
    - mask fit to damage severity and mask type
- `category_coverage`
  - if present and fit, is the current cadence sufficient?
  - values:
    - `insufficient`
    - `matched`
    - `excessive`
    - `unknown`
- `category_conflict`
  - is the category plausibly contributing to weight, buildup, dryness, irritation, or another routine conflict?
- `behavior_dominant`
  - is the main problem better solved by changing behavior than by changing products?

Recommended deterministic order:

1. Not relevant + harmful -> `remove` or `decrease_frequency`
- if a category is not currently needed
- and it is plausibly contributing to conflict
- prefer de-escalation

2. Behavior dominates + no major unmet category gap -> `behavior_change_only`
- if the highest-value fix is technique/behavior
- and there is no clearly missing essential category

3. Relevant + absent -> `add`
- if the category is needed
- and no fitting version exists in the routine

4. Relevant + present but mismatched -> `replace`
- if the category exists
- but it is the wrong type / weight / route for the need

5. Relevant + present + fit + under-covered -> `increase_frequency`
- if the category is right in principle
- but underused relative to current need

6. Relevant + present + fit + overused or conflicting -> `decrease_frequency`
- if the category is not wrong in principle
- but current use is excessive for the need or profile

7. Relevant + present + fit + matched -> `keep`
- if no change is needed

Important tie-break rules:
- prefer `replace` over `increase_frequency` when the product is directionally wrong
- prefer `increase_frequency` over `add` when a fitting category already exists
- prefer `behavior_change_only` over `add` when behavior is the dominant driver and product coverage is already reasonable
- prefer `decrease_frequency` over `remove` when the category is useful in principle but simply overused
- prefer `remove` when the category is both low-value and conflict-creating

Examples:
- no conditioner present -> `add`
- conditioner present but low-repair when repair need is high -> `replace`
- suitable mask present but used rarely despite strong mask need -> `increase_frequency`
- leave-in present and generally right, but too heavy / flattening for current state -> `replace`
- dry shampoo present and overused -> `decrease_frequency`
- rough towel + rough brushing + no missing essential category -> `behavior_change_only`

### Category Relevance Family

Goal of this family:
- decide whether a category should enter the planner at all for the current user state

Recommended shape:
- keep `category_relevant` as a simple boolean for the main decision tree
- attach `reason_codes` for explanation / observability
- do not turn this into a second heavy scoring system unless later testing shows that a relevance strength is necessary

Important distinction:
- `category_relevant = true` does **not** mean:
  - automatically add this category
  - automatically recommend a specific product
- it only means:
  - this category is a valid candidate for planner action

#### Shampoo relevance

Default stance:
- relevant by default

Why:
- cleansing is a baseline routine function
- cadence and type should still remain scalp-first

Reason-code examples:
- `baseline_cleansing_category`
- `scalp_state_requires_cleansing`
- `buildup_reset_pressure`

#### Conditioner relevance

Default stance:
- relevant by default

Why:
- baseline post-wash care category
- especially relevant for friction reduction, detangling, smoothing, repair support, and routine completeness

Reason-code examples:
- `baseline_core_care`
- `repair_need_present`
- `detangling_or_smoothing_need`

#### Leave-in relevance

Default stance:
- selectively relevant

Make relevant when one or more are true:
- `hydration_need` is meaningful
- `smoothing_need` / anti-frizz need is meaningful
- `detangling_need` is meaningful
- `definition_support_need` is meaningful
- `thermal_protection_need` is meaningful
- `repair_priority` is high enough that after-wash support is useful
- styling / drying context makes after-wash support clearly useful

Do not make relevant by default for everyone.

Reason-code examples:
- `after_wash_support_needed`
- `thermal_protection_needed`
- `definition_support_needed`
- `detangling_support_needed`

#### Heat protectant relevance

Default stance:
- relevant whenever heat is used

Make relevant when:
- `heat_frequency` is anything above `never`
- or drying/styling context clearly implies heat use

Not relevant when:
- no heat use

Reason-code examples:
- `heat_events_present`
- `blow_dry_heat_present`
- `hot_tool_usage_present`

#### Mask relevance

Default stance:
- selectively relevant

Make relevant when one or more are true:
- `overall_level` is meaningfully elevated
- `structural_level` is elevated
- `repair_priority` is medium/high
- hydration need is strong enough that baseline conditioner care may not be sufficient

Do not make relevant just because the user wants smoother or shinier hair.

Reason-code examples:
- `intensive_treatment_needed`
- `structural_damage_present`
- `beyond_baseline_conditioner_support`

#### Bondbuilder relevance

Default stance:
- narrowly relevant

Make relevant when:
- `bond_builder_priority` is `consider` or `recommend`

Not relevant when:
- damage is high for non-structural reasons only

Reason-code examples:
- `bond_builder_consider`
- `bond_builder_recommend`

#### Deep-cleansing shampoo relevance

Default stance:
- selectively relevant inside the scalp/reset lane

Make relevant when:
- `buildup_reset_need` is moderate/high
- oily scalp combines with heavy routine load or residue tendency
- dry-shampoo reliance or styling-residue logic points toward reset need

Do not make relevant from oily scalp alone.

Reason-code examples:
- `buildup_reset_need_present`
- `oily_scalp_plus_residue_load`
- `dry_shampoo_reset_pressure`

#### Dry shampoo relevance

Default stance:
- selectively relevant

Make relevant when:
- there is a genuine between-wash need
- wash cadence creates between-wash days
- scalp/oil pattern makes bridge support useful

Do not make relevant as a cleansing replacement.

Reason-code examples:
- `between_wash_bridge_needed`
- `oily_scalp_between_wash_support`

#### Peeling relevance

Default stance:
- selectively relevant inside the scalp/reset lane

Make relevant when:
- scalp/reset need points toward occasional exfoliation / scalp-focused reset
- buildup or scalp-oil context supports it

Keep conservative when:
- dryness / irritation risk is high

Reason-code examples:
- `scalp_reset_needed`
- `scalp_buildup_present`

#### Oil relevance

Default stance:
- purpose-dependent and conservative

Make relevant when:
- user-intended oil purpose is known and sensible
- or message-level inference strongly suggests a compatible oil use case
- shine / smoothing support is needed and weight compatibility looks reasonable

Do not make relevant from global damage alone.

Reason-code examples:
- `pre_wash_oil_intent`
- `finish_oil_intent`
- `shine_smoothing_support`

### Category Fit Family

Goal of this family:
- decide whether an already-present category is the *right version* of that category for the current need

Recommended shape:
- keep `category_fit` qualitative and rule-based
- values:
  - `good_fit`
  - `partial_fit`
  - `poor_fit`
  - `unknown`
- use `poor_fit` as the main trigger for `replace`

Structured-catalog dependency:
- deterministic fit requires structured internal product metadata by category
- the long-term useful direction is:
  - define the few product properties per category that actually matter for recommendation logic
  - store them in the product catalog / product tables
- until a current user product can be mapped to that structured catalog, treat `category_fit` as `unknown`
- in that `unknown` state, avoid overly strong replace logic unless another signal is very clear

### Locked Structured Product Properties

These are the current locked category properties for deterministic fit logic.

#### Shampoo

Keep:
- `scalp_route`
  - `oily`
  - `balanced`
  - `dry`
  - `dandruff`
  - `dry_flakes`
  - `irritated`
- `cleansing_intensity`
  - `gentle`
  - `regular`
  - `clarifying`

Do not add:
- `daily_suitable`

Reason:
- cadence suitability should be inferred from `cleansing_intensity`, not stored separately

#### Conditioner

Keep:
- `protein_moisture_balance`
  - one primary direction only
- `repair_level`
  - `low`
  - `medium`
  - `high`
- `weight`
  - `light`
  - `medium`
  - `rich`

Important:
- `repair_level` and `weight` should stay independent

#### Leave-in

Keep:
- `weight`
  - `light`
  - `medium`
  - `rich`
- `conditioner_relationship`
  - whether it can replace conditioner in some routines or only extend it
- `care_benefits`
  - `heat_protect`
  - `curl_definition`
  - `repair`
  - `detangle_smooth`

Important:
- `detangle_smooth` includes frizz-control and shine/smoothing effects
- leave-in `repair` means supportive/light repair, not mask-level treatment repair
- `conditioner_relationship` should mainly affect routine orchestration / compression / cadence discussions
- it should not become a primary leave-in matching axis

#### Mask

Current code already contains richer mask metadata:
- `format`
- `weight`
- `concentration` (to be renamed)
- `benefits`
- `ingredient_flags`
- `leave_on_minutes`
- optional usage/admin metadata like `max_uses_per_week`

For deterministic recommendation logic, keep the core model lean:
- `protein_moisture_balance`
  - one primary direction only
- `repair_level`
  - `low`
  - `medium`
  - `high`
- `weight`
  - `light`
  - `medium`
  - `rich`

Do not keep as a core deterministic property:
- separate `bond_builder` field for masks

Interpretation:
- rename current mask field `concentration` -> `repair_level`
- use `repair_level` as the canonical product-catalog term going forward
- `format`, `benefits`, `ingredient_flags`, `leave_on_minutes`, and similar fields can remain secondary/admin metadata rather than primary routing fields

#### Bondbuilder

Keep:
- `bond_repair_intensity`
  - `maintenance`
  - `intensive`
- `application_mode`
  - `pre_shampoo`
  - `post_wash_leave_in`

Do not add:
- `weight`

Reason:
- the category is defined mainly by structural-repair intensity and routine placement
- weight is not a primary matching axis here

#### Heat protectant

Keep:
- `application_stage`
  - `damp`
  - `dry`
  - `both`

Do not add:
- `heat_tool_compatibility`
- `weight`

Reason:
- stage matters because some protectants are applied on damp hair and others on dry hair
- tool-specific compatibility is usually not discriminative enough to justify a core field
- weight is not a meaningful primary axis for this category

#### Deep-cleansing shampoo

Keep:
- `scalp_type_focus`
  - `oily`
  - `balanced`
  - `dry`

Do not add:
- `cleansing_intensity`

Reason:
- this category is clarifying by definition, so a separate intensity field would be redundant in v1
- the meaningful product-side distinction is which scalp type it is better suited for
- scalp conditions like `dandruff`, `dry_flakes`, and `irritated` should stay in the planner/scalp logic, not become core product-schema values for this category

#### Peeling

Keep:
- `scalp_type_focus`
  - `oily`
  - `balanced`
  - `dry`
- `peeling_type`
  - `acid_serum`
  - `physical_scrub`

Do not add:
- barrier-support serums to this category

Reason:
- the meaningful product-side distinction is the exfoliation method, not a vague intensity scale
- `acid_serum` vs `physical_scrub` changes fit logic, especially for sensitive or quickly irritated scalps
- barrier-support scalp serums should remain a separate future category rather than muddying `peeling`

#### Dry shampoo

Keep:
- `scalp_type_focus`
  - `oily`
  - `balanced`

Do not add:
- `dry` as a scalp-type focus
- styling / finish-effect properties

Reason:
- dry scalp should not be a target fit for dry shampoo in this architecture
- the category should stay a sparing bridge tool for oily or balanced scalps rather than a styling-product taxonomy
- product-side finish differences are not important enough for deterministic recommendation logic in v1

#### Oil

Keep:
- `oil_purpose`
  - `pre_wash_oiling`
  - `styling_finish`
  - `light_finish`

Do not add:
- separate subtype field

Reason:
- this category should stay purpose-first
- purpose is the product-side distinction that actually drives relevance, fit, conflict, and routine placement
- subtype terminology adds complexity without improving deterministic recommendation logic in v1

Important distinction:
- `fit` is not the same as `coverage`
- a category can be:
  - the right type, but underused
  - the wrong type, even if used often

#### Shampoo fit

Judge fit mainly by:
- scalp condition route
- scalp type route
- cleansing harshness relative to dryness/damage

Good fit when:
- shampoo route matches scalp need
- and cleansing intensity is not obviously harsher than the fiber state can tolerate

Poor fit when:
- the shampoo route appears mismatched to scalp need
- or reset/clarifying style is being used like a baseline shampoo despite high dryness/damage

#### Conditioner fit

Judge fit mainly by:
- `balance_direction`
- `repair_priority`
- weight compatibility from `thickness` / `density`

Good fit when:
- conditioner route matches protein / moisture / balanced need
- repair intensity matches current repair priority
- weight is compatible with the hair profile

Poor fit when:
- balance route is wrong
- repair level is too weak for the damage state
- or the formula is clearly too heavy / too light for the hair profile

#### Leave-in fit

Judge fit mainly by:
- primary leave-in route:
  - thermal protection
  - smoothing / detangling
  - definition
  - repair support
- weight compatibility
- styling context compatibility

Good fit when:
- the leave-in solves the main after-wash need
- weight matches `thickness` / `density`
- and the route is compatible with styling behavior

Poor fit when:
- the leave-in route misses the main need
- the formula is too heavy / flattening
- or it conflicts with styling goals

#### Heat protectant fit

Judge fit mainly by:
- actual coverage of heat events
- whether the protection route is realistically being used before heat

Good fit when:
- heat protection is present and reliably used with heat

Poor fit when:
- protection exists in theory, but practical coverage is missing
- or the user is relying on a product that does not actually cover their heat use pattern

#### Mask fit

Judge fit mainly by:
- `repair_priority`
- `balance_direction`
- weight compatibility

Good fit when:
- repair level matches the current damage state
- type matches moisture / protein / balanced need
- weight fits the hair profile

Poor fit when:
- repair level is too weak for the damage state
- type is wrong for the balance need
- or the mask is too heavy for the profile

#### Bondbuilder fit

Judge fit mainly by:
- whether bond-building care is actually warranted
- whether the product is being used for a real structural-damage pattern

Good fit when:
- `bond_builder_priority` is `consider` / `recommend`
- and the current product is genuinely serving that lane

Poor fit when:
- structural justification is weak
- or the user is using bond-building care where a normal repair mask / conditioner route would be more appropriate

#### Deep-cleansing shampoo fit

Judge fit mainly by:
- whether reset need is actually present
- whether the cleansing intensity is appropriate for scalp/reset pressure
- whether dryness/damage makes the current reset approach too harsh

Good fit when:
- buildup/reset need is real
- and the cadence/intensity is occasional and appropriate

Poor fit when:
- there is little reset need
- or the product is being used too aggressively for the current fiber/scalp state

#### Dry shampoo fit

Judge fit mainly by:
- bridge-use appropriateness
- whether it supports between-wash management without displacing cleansing

Good fit when:
- it is functioning as occasional between-wash support

Poor fit when:
- it is effectively substituting for washing
- or it is contributing to residue, dryness, stiffness, or scalp conflict

#### Peeling fit

Judge fit mainly by:
- scalp/reset need
- irritation/dryness tolerance

Good fit when:
- scalp-focused reset need is real
- and the product is being used conservatively

Poor fit when:
- irritation/dryness risk outweighs likely benefit
- or there is little scalp/reset justification

#### Oil fit

Judge fit mainly by:
- subtype / purpose match
- weight compatibility
- goal compatibility

Good fit when:
- oil purpose matches the user's intended use case
- and weight is compatible with the hair profile and goals

Poor fit when:
- the oil purpose is mismatched
- the oil is too heavy / flattening / buildup-prone for the profile
- or the user is applying an oil pattern that conflicts with the actual need

### Category Conflict Family

Goal of this family:
- decide whether a currently present category is actively contributing to the user's problem

Recommended shape:
- keep `category_conflict` conservative and separate from `category_fit`
- values:
  - `no_conflict`
  - `possible_conflict`
  - `clear_conflict`
  - `unknown`

Important distinction:
- `poor_fit` means:
  - the category is the wrong version of a useful tool
- `clear_conflict` means:
  - the category is plausibly making the current situation worse

Planner implication:
- `poor_fit` usually points toward `replace`
- `clear_conflict` usually points toward `decrease_frequency` or `remove`
- if both are true:
  - prefer `replace` when the category is still useful in principle
  - prefer `remove` when the category is low-value and conflict-creating

#### Shampoo conflict

Possible conflict when:
- washing is very frequent
- dryness / structural damage is high
- and scalp state does not justify that intensity

Clear conflict when:
- shampoo cadence or harshness is plausibly worsening dryness / fragility
- without a strong scalp-driven reason

#### Conditioner conflict

Possible conflict when:
- the conditioner seems somewhat too rich / flattening for the profile

Clear conflict when:
- conditioner use is clearly contributing to weight, flatness, or overload
- and the need could be met better with a lighter route

Planner note:
- conditioner conflict should often resolve to `replace lighter` rather than simply `decrease`

#### Leave-in conflict

Possible conflict when:
- the product seems somewhat too heavy for the profile or goals

Clear conflict when:
- leave-in use is clearly causing weight, loss of volume, buildup feel, or mismatch with the styling outcome

#### Heat protectant conflict

Default stance:
- usually `no_conflict`

Why:
- the main planner issue is missing or inconsistent protection, not overuse

Only treat as conflict when:
- the current protection route is clearly creating a problem
- and another protection route would solve the same need better

#### Mask conflict

Possible conflict when:
- mask cadence is somewhat high relative to current need

Clear conflict when:
- mask use is clearly too frequent / too heavy
- and is plausibly causing overload, flatness, or routine excess

#### Bondbuilder conflict

Possible conflict when:
- bond-building care is being used despite weak structural justification

Clear conflict when:
- bondbuilder use is being treated like baseline care
- despite low bond-builder relevance
- or it is adding unnecessary complexity / overload to the routine

#### Deep-cleansing shampoo conflict

Possible conflict when:
- reset shampoo use is somewhat frequent despite dryness/damage pressure

Clear conflict when:
- reset shampoo is being used too aggressively for the current fiber/scalp state
- and is plausibly worsening dryness or fragility

#### Dry shampoo conflict

Possible conflict when:
- use is frequent enough to raise concern

Clear conflict when:
- dry shampoo is effectively replacing cleansing
- or contributing to residue, grit, stiffness, dryness, or scalp irritation

Research support:
- AAD explicitly warns about overuse causing dryness, stiffness, visible residue, and irritation

#### Peeling conflict

Possible conflict when:
- dryness / irritation risk is elevated

Clear conflict when:
- peeling frequency or intensity is plausibly worsening scalp irritation or dryness

#### Oil conflict

Possible conflict when:
- oil use may be too heavy for the profile or goals

Clear conflict when:
- oil is plausibly creating weight, buildup, flattening, or route mismatch
- especially when the subtype/use pattern is not well aligned with the actual need

### Behavior-Dominant Family

Goal of this family:
- decide when the highest-value intervention is behavioral rather than product-based

Recommended shape:
- keep `behavior_dominant` as a boolean for the planner
- attach `reason_codes` so the routine can explain which habits are driving the decision

Important distinction:
- `behavior_dominant = true` does **not** mean:
  - products are irrelevant
- it means:
  - the main near-term improvement will come more from behavior change than from adding another product

Planner implication:
- prefer `behavior_change_only` when:
  - behavior is the dominant driver
  - and there is no clearly missing essential category
- still allow product actions when:
  - there is an obvious missing baseline or preventive category

Core behavioral drivers to consider:
- heat misuse
- missing heat protection during heat use
- rough towel handling
- rough brushing / detangling
- lack of night protection
- overwashing without scalp justification

#### When to mark behavior as dominant

Use `behavior_dominant = true` when:
- one or more damaging behaviors are strong and current product coverage is already broadly reasonable
- or the main problem is clearly driven by technique rather than product absence

Examples:
- frizz is mainly driven by rubbing + rough brushing
- damage is mainly driven by frequent heat without protection
- curls/waves lack definition mainly because drying/styling habits are fighting the goal
- dryness is strongly amplified by overwashing behavior

#### When not to mark behavior as dominant

Keep `behavior_dominant = false` when:
- a clearly missing essential category exists
- the current routine lacks baseline care
- or the main unmet need cannot realistically be solved by behavior alone

Examples:
- no conditioner in the routine
- meaningful heat use with no protection route at all
- strong mask-level need with no intensive treatment present

#### Reason-code examples

- `rough_towel_handling`
- `rough_brushing`
- `frequent_heat_without_protection`
- `insufficient_night_protection`
- `overwashing_behavior`
- `definition_goal_blocked_by_behavior`

Research support:
- AAD guidance consistently prioritizes gentler handling, reduced heat stress, and protective technique as high-value interventions before or alongside product use

### Buildup / Reset Need

Goal of this signal:
- support the scalp/reset planner family without creating another oversized architecture layer

Recommended shape:
- derive a small `buildup_reset_need`
- values:
  - `none`
  - `low`
  - `moderate`
  - `high`
- attach `reason_codes`

Primary use:
- `shampoo`
- `dry_shampoo`
- `deep_cleansing_shampoo`
- `peeling`

Not a fiber-damage signal:
- this should stay separate from `damage_assessment`
- it describes residue / reset pressure, not structural damage

Core drivers:
- `scalp_type = oily`
- frequent `dry_shampoo` use
- heavy routine load / residue-prone categories
- low wash cadence relative to scalp oiliness or product load
- chat/context signals of:
  - heaviness
  - coated feeling
  - residue
  - hair feeling dull from buildup

Useful residue-prone categories:
- `oil`
- `serum`
- styling products
- heavy leave-in use
- dry shampoo

Working derivation direction:
- `none`
  - no meaningful oily scalp / residue / bridge-product pressure
- `low`
  - some residue-prone usage or mild oily tendency, but no strong reset pressure
- `moderate`
  - multiple reset-pressure signals are present
- `high`
  - oily scalp plus heavy routine load, frequent bridge-product use, or clear residue/buildup complaints

Important guardrails:
- oily scalp alone should not automatically force reset products
- high `buildup_reset_need` should not override severe dryness / irritation risk without caution
- this signal should justify:
  - considering reset categories
  - not automatically prescribing harsh cleansing

Research clarification:
- oily scalp absolutely can justify more regular cleansing
- but current evidence/guidance supports handling that first with appropriate shampoo cadence and scalp-matched cleansing
- not with an automatic jump to a separate deep-cleansing category
- deep-cleansing / reset logic becomes more justified when oily scalp is combined with:
  - residue-prone routine load
  - frequent dry shampoo use
  - clear buildup/heaviness complaints

Reason-code examples:
- `oily_scalp`
- `frequent_dry_shampoo_use`
- `heavy_residue_prone_routine`
- `low_wash_cadence_relative_to_load`
- `reported_buildup_symptoms`

### Routine Orchestration Rules

Goal of this family:
- merge category-level planner outputs into one coherent routine recommendation
- avoid contradictory, redundant, or overload-creating action bundles

Important distinction:
- the `intervention_planner` decides category actions
- the orchestration layer decides:
  - which actions to surface first
  - which actions can coexist
  - which ones should be collapsed, softened, or deferred

Recommended orchestration outputs:
- `primary_actions`
- `secondary_actions`
- `behavior_actions`
- `deferred_actions`
- `suppressed_actions`
- `explanation_order`

Working principle:
- do not surface every technically valid action
- surface the smallest coherent set that resolves the biggest problems

#### Priority order

Recommended default priority:
1. scalp / cleansing guardrails
2. missing baseline care
3. missing preventive care
4. high-damage treatment actions
5. selective support categories
6. de-escalation / cleanup actions
7. lower-priority optimizations

Examples:
- scalp mismatch in shampoo should outrank shine-oriented oil adjustments
- missing conditioner should outrank adding an optional finish oil
- missing heat protection during real heat use should outrank cosmetic leave-in refinements

#### Compression rules

Use these to keep the final routine recommendation compact:

- if `conditioner` is missing and `mask` is relevant:
  - surface conditioner first as baseline care
  - do not let mask eclipse missing baseline care

- if both `heat_protectant` and `leave_in` are relevant:
  - check whether one leave-in route can satisfy both
  - if yes, compress into one action instead of stacking two products unnecessarily

- if `deep_cleansing_shampoo` and `peeling` are both relevant:
  - prefer the cleaner single reset story unless both are strongly justified

- if multiple categories are only weakly relevant:
  - suppress lower-value additions
  - keep the routine lean

#### Contradiction guards

Do not surface action bundles that conflict semantically:
- avoid recommending both more frequent reset cleansing and less frequent cleansing without clearly separating:
  - baseline shampoo cadence
  - occasional reset cadence
- avoid recommending richer treatment while also warning that the routine is already too heavy, unless:
  - the richer action is explicitly replacing another heavy or mismatched step
- avoid recommending optional support categories when the routine still lacks baseline care

#### Defer vs suppress

`deferred_actions`
- valid actions that are real, but not the next best move
- can be mentioned as later options once baseline changes are in place

`suppressed_actions`
- technically valid actions that should stay out of the user-facing routine because they add noise, complexity, or redundancy

Examples:
- defer optional oil refinement until baseline repair/protection is stabilized
- suppress a second low-value support category if a stronger primary action already covers the need

#### Behavior integration

Behavior actions should not get lost just because product actions exist.

Recommended rule:
- allow behavior actions to coexist with product actions
- but cap them to the highest-value 1-2 behavior changes

Examples:
- add heat protection + reduce flat iron use frequency
- replace leave-in + stop rough towel rubbing

#### Output-shaping principle

The final surfaced routine should feel like:
- one coherent baseline
- one or two targeted upgrades
- one or two behavior corrections

Not:
- a maximal list of every possible intervention the planner found

## Step 2: Category Consumption Matrix

Goal of this step:
- keep `damage_assessment` and `care_need_assessment` reusable
- avoid rebuilding category logic from scratch in each lane
- keep category-specific gates where they truly matter

### Conditioner

Should read from `damage_assessment`:
- `repair_priority`
- `balance_direction`
- `active_damage_drivers` for explanation

Should read from `care_need_assessment`:
- later, possibly hydration / smoothing support for wording and tie-breaks
- but core eligibility should stay anchored in structural fit, not goals

Should still keep category-specific logic outside those shared layers:
- `thickness`
- `density`

Recommended architecture:
- eligibility:
  - require `thickness`
  - require `balance_direction` (which effectively means pull-test completion)
- product typing:
  - use `balance_direction` as the primary conditioner concern direction
- reranking:
  - use `repair_priority`
  - use thickness + density for expected weight

### Mask

Should read from `damage_assessment`:
- `overall_level`
- `structural_level`
- `heat_level`
- `mechanical_level`
- `repair_priority`
- `balance_direction`

Should read from `care_need_assessment`:
- only secondarily for things like smoothing or hydration emphasis in explanation

Should still keep category-specific logic outside those shared layers:
- `thickness` for weight fit

Recommended architecture:
- mask need strength should come primarily from `damage_assessment`
- mask type should come primarily from `balance_direction`
- mask repair fit should come primarily from `repair_priority`
- thickness should gate or strongly constrain the final mask recommendation
- do not create a separate mask-only bond-builder field
- if bond-building care is relevant at the same time, allow mask + bondbuilder to coexist:
  - bondbuilder for severe structural repair
  - mask for protein/moisture/repair support and maintenance

### Bondbuilder

Should read from `damage_assessment`:
- `bond_builder_priority`
- `structural_level`
- `repair_priority`
- `active_damage_drivers`

Should read from `care_need_assessment`:
- minimally, if at all

Should still keep category-specific logic outside those shared layers:
- product-specific cadence instructions

Recommended architecture:
- treat bondbuilder as a separate structural-treatment category, not as a mask subtype
- make it relevant mainly for severe structural / chemical damage patterns
- do not let generic high damage alone trigger it when the damage is mainly mechanical or scalp-related
- allow it to coexist with mask when the structural case is strong enough

### Leave-in

Should read from `damage_assessment`:
- `heat_level`
- `repair_priority`
- `balance_direction`
- `active_damage_drivers`

Should read from `care_need_assessment`:
- `hydration_need`
- `smoothing_need`
- `detangling_need`
- `definition_support_need`
- `thermal_protection_need`
- `volume_direction`

Should still keep category-specific logic outside those shared layers:
- `thickness`
- `density`
- styling context / after-wash behavior

Recommended architecture:
- leave-in should no longer be driven only by styling-context + goals
- it should also react to structural needs:
  - high heat -> heat-protective leave-in route
  - high repair -> stronger leave-in repair route
  - balance direction -> protein/moisture/performance lean
- higher-damage users should more often get:
  - rinse-off conditioner + leave-in
  rather than leave-in as a mostly cosmetic add-on

### Routine planner

Should read from `damage_assessment`:
- the full object

Should read from `care_need_assessment`:
- the full object

Should also read from:
- `user_routine_items`
- scalp state
- goals
- texture / thickness / density

Recommended architecture:
- `damage_assessment` explains what must be repaired or protected
- `care_need_assessment` explains what kind of support the routine should provide
- `user_routine_items` explains:
  - what already exists
  - what is missing
  - what may be overused
  - what should be replaced vs added
  - what frequency changes may solve the need without adding a new category

### Shampoo

Should read from `damage_assessment`:
- only lightly / indirectly

Should read from `care_need_assessment`:
- mostly not needed for the main shampoo bucket

Should remain primarily driven by:
- `scalp_condition`
- `scalp_type`
- `thickness`

Recommended architecture:
- shampoo stays scalp-first
- damage context can influence wording and avoidance of conflicting advice
- do not let global damage logic override scalp-priority routing

### Oil

Should read from `damage_assessment`:
- lightly and contextually

Should read from `care_need_assessment`:
- for shine / anti-frizz / smoothing support

Should remain primarily driven by:
- `thickness`
- user-intended oil purpose / subtype

Recommended architecture:
- oil stays purpose-first, not damage-first
- shared layers should shape:
  - whether oil is a sensible support category
  - whether it conflicts with weight risk or other routine context
- but they should not turn oil into a pseudo-repair category

## Shared Outputs By Layer

`damage_assessment` should answer:
- how damaged or stressed is the hair?
- what is causing it?
- how strong is the repair need?
- what is the protein/moisture direction?
- how strong is the bond-builder signal?

`care_need_assessment` should answer:
- what kind of support should products/routines provide?
- hydration?
- smoothing / anti-frizz?
- detangling?
- definition?
- thermal protection?
- volume direction?

Note:
- shine should stay secondary in v1
- treat it as part of smoothing / `detangle_smooth` logic and explanation rather than as a separate first-class care-need output

## Decision Table By Category

| Category | Primary inputs | Secondary inputs | Must not override core job |
|----------|----------------|------------------|-----------------------------|
| Conditioner | `repair_priority`, `balance_direction` | `thickness`, `density`, selected symptoms, routine context | goals alone, styling preferences alone |
| Mask | `overall_level`, `structural_level`, `heat_level`, `mechanical_level`, `repair_priority`, `balance_direction` | `thickness`, routine context | cosmetic goals alone, styling preferences alone |
| Bondbuilder | `bond_builder_priority`, `structural_level`, `chemical_treatment` | routine context | generic high damage alone |
| Leave-in | `care_need_assessment`, `heat_level`, `repair_priority`, `balance_direction`, styling context | `thickness`, `density`, routine context | texture alone, goals alone, styling alone |
| Heat protectant | `heat_frequency`, heat usage context | routine context | cosmetic goals, damage logic without heat use |
| Routine | `damage_assessment`, `care_need_assessment`, `user_routine_items` | scalp state, texture, thickness, density, goals | any single product-category heuristic |
| Shampoo | `scalp_condition`, `scalp_type`, `thickness` | damage context, care-need context, routine context | repair logic, cosmetic goals |
| Oil | user-intended oil purpose, `thickness` | care-need context, routine context, scalp context | global damage severity alone |

### Reading guide

Primary inputs:
- the main decision drivers for that category
- if these point in one direction, other inputs should usually not overturn them

Secondary inputs:
- refine ranking, wording, or edge-case handling
- helpful, but not the category's first principle

Must not override core job:
- guardrails against Frankenstein logic
- tells us what not to let the shared layers hijack

### Category-specific guardrails

Conditioner:
- main job: provide rinse-off core care matched to repair need and balance direction
- guardrail:
  - do not let high-level goals like `shine` or `volume` outweigh structural fit

Mask:
- main job: provide intensive treatment when damage/stress is meaningfully elevated
- guardrail:
  - do not recommend masks just because the user wants smoother or shinier hair

Leave-in:
- main job: provide after-wash support where care + styling overlap
- guardrail:
  - do not let any single dimension dominate
  - this category needs balancing across structure, care needs, weight tolerance, and styling behavior

Routine:
- main job: orchestrate products + behaviors + sequencing
- guardrail:
  - do not collapse routine logic into whichever product category happened to fire strongest

Shampoo:
- main job: cleanse appropriately and respect scalp state
- guardrail:
  - damage context can shape advice, but should not replace scalp-first routing

Oil:
- main job: solve a user-intended oil use case
- guardrail:
  - damage does not automatically imply oil
  - keep oil tied to purpose and weight compatibility

### Protective factors and confidence

`active_damage_drivers`
- include concrete causes such as:
  - `bleached`
  - `high_heat_frequency`
  - `no_heat_protection`
  - `rough_towel`
  - `towel_rubbing`
  - `rough_brushing`
  - `no_night_protection`
  - `split_ends`
  - `hair_damage`

`active_protective_factors`
- include concrete reducers such as:
  - `heat_protection_used`
  - `gentle_towel_material`
  - `gentle_towel_technique`
  - `gentle_brush_choice`
  - `night_protection_used`

`confidence`
- high when the main structural + heat + mechanical inputs are present
- medium when one major block is missing
- low when key fields like pull test or cuticle state are absent

`missing_inputs`
- explicitly list which major ingredients of the assessment are absent
- example:
  - `protein_moisture_balance`
  - `cuticle_condition`
  - `heat_frequency`
  - `night_protection`

## Heat Cluster Decisions

### Heat tools

Working decisions:
- Keep the exact-tool question for UX/context, even if tool identity is usually weaker than heat frequency.
- If the user selects `Nichts davon`:
  - skip the remaining heat pages
  - set `heat_styling = never`
  - do not treat missing/unused heat protection as a negative signal in later logic

Important cleanup:
- legacy `uses_heat_protection = false` is too blunt for the "I do not use heat at all" case.
- in the target architecture:
  - skip the heat-protection decision entirely when no heat is used
  - treat heat protection as `not_applicable` in planner logic rather than overloading a boolean

### Heat frequency

Working decisions:
- Preserve finer frequency granularity instead of collapsing multiple values into `several_weekly`.
- Feed heat frequency into the shared damage assessment with staggered severity.
- Use the more precise frequency signal across all relevant product categories, not just routine or masks.

### Heat protection

Working decisions:
- Keep the page question behavior-based: "Benutzt du Hitzeschutz?"
- Infer `heat_protectant` routine inventory from that behavior answer.
- If the answer is `yes`, create/update a `heat_protectant` routine item.
- If the answer is `no`, no `heat_protectant` routine item should exist.
- If the user does not use heat tools, skip the page and treat heat protection as not applicable.
- Feed heat protection into the shared damage assessment as a modifier / multiplier using:
  - precise heat frequency
  - presence/absence of `heat_protectant` usage in the routine model
- Give heat protection a meaningful effect size in scoring:
  - protected daily/frequent heat should still count as real heat load
  - unprotected daily/frequent heat should land materially higher
  - working direction: more than a one-point delta at high frequency

Reasoning:
- In this product, owning a heat protectant is not the point; actual use is.
- Because the page already asks about usage, inventory can be derived from behavior rather than modeled separately.
- This keeps the architecture cleaner while still supporting routine-level reasoning.

Cleanup implication:
- Long-term, the standalone `uses_heat_protection` field should become unnecessary or be deprecated.
- Protected vs unprotected heat can be derived from:
  - `heat_styling`
  - `user_routine_items` containing or not containing `heat_protectant`
- Because current runtime still reads `uses_heat_protection`, remove it as part of the implementation refactor, not before.

Future rule note:
- Some leave-ins include heat protection and may replace a dedicated heat-protectant slot in certain routines.
- This should be handled later in deterministic routine rules and recommendation wording.

Tool-specific nuance to preserve for later:
- Exact tool type can matter when combined with hair texture and goals.
- Example:
  - curly hair
  - flat-iron usage
  - goal = curl definition
  -> system should be able to flag that the current behavior works against the stated goal

## Towel + Technique Decisions

### Towel material

Working decisions:
- `towel_material` should not stay prompt-only.
- Feed it into frizz / mechanical-stress logic and the shared damage assessment.
- Also let it influence routine guidance when it conflicts with the user's texture and goals.

Research summary:
- AAD recommends gently wrapping hair in a towel or T-shirt to absorb moisture and warns that rough rubbing can cause damage.
- AAD also recommends microfiber towels to reduce time spent blow-drying.
- Professional curly-hair guidance consistently treats rougher towel friction as definition/frizz-negative and microfiber or cotton T-shirt approaches as gentler.

Working logic direction:
- rougher / higher-friction towel materials -> negative stress/frizz signal
- gentler / lower-friction materials -> protective signal

### Towel technique

Working decisions:
- `rubbeln` should be a negative stress signal.
- `tupfen / scrunchen` should be a positive protective signal.
- Do not delay derived stress/protection updates until the night-protection page; derive and persist them as soon as this page is answered.
- Feed towel-technique effects into the shared damage assessment.

Research summary:
- AAD explicitly warns that roughly rubbing hair dry can cause damage.
- Professional curl-practice guidance consistently treats scrunching as definition-supportive for wavy/curly/coily hair and as a way to reduce frizz compared with rough rubbing.

Important nuance:
- Scrunching is especially relevant when the user has wavy/curly/coily hair or a curl-definition goal.
- For straight hair, gentle blotting still reads as protective, but the curl-definition benefit is not relevant.

## Pages 11-12 Decisions

### Drying method

Working decisions:
- `drying_method` is a high-value signal and should feed directly into the shared damage assessment.
- It should also carry more weight than the simple heat-tools checklist.
- The onboarding order should likely be made more chronological for the user:
  - towel material
  - towel technique
  - drying method
  - heat tools
  - heat frequency
  - heat protection
  - then later brush / night-protection habits

Post-wash-actions cleanup:
- The current `post_wash_actions` model is too coarse.
- Current values:
  - `air_dry`
  - `blow_dry_only`
  - `heat_tool_styling`
  - `non_heat_styling`
- Working direction:
  - revisit and likely expand this model so it reflects actual after-wash behavior more precisely
  - keep it usable for leave-in logic and routine logic, not just as a legacy compatibility field

Specific decision:
- `blow_dry_diffuser` should not automatically count as less damaging than `blow_dry`.
- Treat it as roughly similar heat exposure, but with more texture-aware styling context.

### Brush type

Working decisions:
- `brush_type` should feed the shared damage assessment.
- Derived protective/stress signals should be written immediately when this page is answered, not delayed until night protection.
- Keep brush logic texture-aware where relevant.

Research summary:
- AAD recommends wide-tooth combs over brushes for wet detangling and says tightly curled/textured hair should be brushed when wet to reduce breakage.
- AAD also recommends gentle styling tools such as a soft-bristled brush and wide-tooth comb in fragile-hair contexts.
- A recent dermatologist guide to hairbrushes says:
  - wide-tooth combs are suitable across hair types and especially useful on wet curly hair with conditioner to reduce breakage
  - boar bristle brushes are better suited to straight and wavy hair for distributing scalp oils rather than detangling

Working logic direction:
- `wide_tooth_comb`, `detangling`, and `fingers` should count as protective / lower-stress signals
- `paddle` and `round` should remain higher-stress signals in the current model
- `boar_bristle` should not be treated as the same as `rough_brushing`
  - better as contextual / texture-specific guidance than as a blanket negative stress factor
  - likely better for smoothing / shine-oriented routines than for wet detangling or curl-definition support

## Pages 13-14 Decisions

### Night protection

Working decisions:
- `night_protection` should become a real protective-signal page, not just prompt context.
- Positive protective signals should be derived from:
  - `silk_satin_pillow`
  - `silk_satin_bonnet`
  - `loose_braid`
  - `loose_bun`
  - `pineapple`
- Choosing `Nichts davon` should count against the protection side of the damage/stress assessment.
- Keep `tight_hairstyles` out of onboarding for now.

Reasoning:
- The current model is too skewed toward explicit damage inputs and under-models protective behaviors.
- Night protection is one of the clearest everyday protective behaviors and should be reflected in the shared damage/protection assessment.

### Goals

Working decisions:
- Do not persist `desired_volume` as a separate source of truth.
- Express volume intent directly in `goals` via:
  - `volume`
  - `less_volume`
- Treat any extra volume field as derived-only at most, or remove it.
- Revisit goal logic because current interactions with other profile properties are still too shallow.

Reasoning:
- Goals are one of the strongest cross-category signals in the system.
- The current storage duplicates intent unnecessarily and hides some useful interactions behind legacy compatibility.
- Future logic should evaluate goals in combination with:
  - hair texture
  - thickness / density
  - drying and styling behavior
  - damage assessment
  - routine inventory

## Sources Used For External Validation

- AAD: Dermatologists' top tips for using leave-in conditioner
- AAD: 6 curly hair tips from dermatologists
- AAD: Tressed to impress: tips for keeping your mane magnificent
- AAD: Black hair: Tips for everyday care
- Curlsmith professional education content on differences between wavy, curly, and coily needs

## Current PRD Status

- Quiz + onboarding page review completed
- Shared architecture layers defined:
  - `damage_assessment`
  - `care_need_assessment`
  - `intervention_planner`
- Planner families defined:
  - frequency modeling
  - action decisions
  - relevance
  - fit
  - conflict
  - behavior dominance
  - buildup/reset need
  - routine orchestration
- Core product-catalog properties partially locked:
  - `shampoo`
  - `conditioner`
  - `leave-in`
  - `mask`

Next recommended step:
- define the remaining structured product properties category by category before implementation specs:
  - `bondbuilder`
  - `deep_cleansing_shampoo`
  - `dry_shampoo`
  - `peeling`
  - `oil`
  - `heat_protectant`

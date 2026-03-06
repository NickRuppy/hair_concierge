# Leave-In Recommendation Logic Spec (v1)

## 1. Purpose

Build a deterministic, preference-weighted recommendation layer for `leave_in` products that:

1. Uses structured user-profile and product-profile data.
2. Prefers leave-ins as dual-purpose care + styling prep when applicable.
3. Avoids rigid exclusions except basic availability/sanity checks.
4. Integrates with the existing score-based matcher as a reranking layer.

This spec is category-specific (`leave_in`) and follows a pattern that can be reused for shampoo, conditioner, oils, and masks.

## 2. Core Decisions (Locked)

1. Blow-dry alone does **not** count as styling.
2. Prefer leave-in products with care + heat protection over pure heat-protectants (preference, not ban).
3. For medium/coarse hair, leave-in as conditioner replacement is downranked, not excluded.
4. Existing profile concerns are equally weighted among themselves.
5. No routine step cap in this phase.
6. Use a strong penalty (not hard exclusion) when a product is heat-activated but user does not heat-style.
7. Use explicit typed DB columns (not tags-only strategy).
8. Use `products` core table + category-specific spec table pattern.
9. Candidate pool before reranking is `10` for leave-ins.
10. Ship directly to all users (no feature-flag rollout for this phase).

## 3. Data Model

### 3.1 User Profile: Required Inputs for Leave-In Logic

Use existing fields from `hair_profiles`:

1. `hair_texture`
2. `thickness`
3. `concerns`
4. `goals`
5. `heat_styling`
6. `styling_tools`
7. `products_used`
8. `cuticle_condition`
9. `protein_moisture_balance`
10. `chemical_treatment`

Add new fields to `hair_profiles`:

1. `post_wash_actions text[] default '{}'`
2. Allowed values:
3. `air_dry`
4. `blow_dry_only`
5. `heat_tool_styling`
6. `non_heat_styling`
7. `routine_preference text`
8. Allowed values: `minimal`, `balanced`, `advanced`
9. `current_routine_products text[] default '{}'`
10. Allowed values:
11. `shampoo`
12. `conditioner`
13. `leave_in`
14. `oil`
15. `mask`
16. `heat_protectant`
17. `serum`
18. `scrub`

Notes:

1. `products_used` stays for free-text context, but logic should use `current_routine_products`.
2. `post_wash_actions` is asked in onboarding and later editable in profile/enrichment.

### 3.2 Product Model

Keep `products` as core shared table. Add category-specific table:

`product_leave_in_specs`

Columns:

1. `product_id uuid primary key references products(id) on delete cascade`
2. `format text not null`
3. Allowed values: `spray`, `milk`, `lotion`, `cream`, `serum`
4. `weight text not null`
5. Allowed values: `light`, `medium`, `rich`
6. `roles text[] not null default '{}'`
7. Allowed values:
8. `replacement_conditioner`
9. `extension_conditioner`
10. `styling_prep`
11. `oil_replacement`
12. `provides_heat_protection boolean not null default false`
13. `heat_protection_max_c integer null`
14. `heat_activation_required boolean not null default false`
15. `care_benefits text[] not null default '{}'`
16. Allowed values:
17. `moisture`
18. `protein`
19. `repair`
20. `detangling`
21. `anti_frizz`
22. `shine`
23. `curl_definition`
24. `volume`
25. `ingredient_flags text[] not null default '{}'`
26. Allowed values:
27. `silicones`
28. `polymers`
29. `oils`
30. `proteins`
31. `humectants`
32. `application_stage text[] not null default '{towel_dry}'`
33. Allowed values:
34. `towel_dry`
35. `dry_hair`
36. `pre_heat`
37. `post_style`
38. `created_at timestamptz default now()`
39. `updated_at timestamptz default now()`

Recommended indexes:

1. GIN on `roles`
2. GIN on `care_benefits`
3. GIN on `application_stage`
4. B-tree on `weight`
5. Partial index on `heat_activation_required = true`

Constraint recommendations:

1. If `heat_protection_max_c` is set, `provides_heat_protection` must be true.
2. If `heat_activation_required` is true, `roles` should include `styling_prep`.

## 4. Onboarding and Enrichment

### 4.1 Onboarding Additions

Add onboarding questions:

1. `What do you do with your hair after washing?`
2. Multi-select mapped to `post_wash_actions`.
3. `How detailed should your routine be?`
4. Single-select mapped to `routine_preference`.
5. `Which products are currently in your routine?`
6. Multi-select mapped to `current_routine_products`.

### 4.2 Enrichment Step

Add a profile enrichment section (later phase) to refine:

1. Current routine consistency.
2. Detailed styling behavior.
3. Product feedback and dislikes.

## 5. Recommendation Flow (Leave-In)

### 5.1 Trigger

Use leave-in path when intent/category indicates:

1. Explicit leave-in request.
2. Routine question where leave-in is relevant.
3. Styling-prep recommendation opportunity.

Category filter mapping for product retrieval:

1. `leave_in -> ["Leave-in"]`

### 5.2 Context Builder

Build a `LeaveInContext` object:

1. `thickness`
2. `concerns`
3. `goals`
4. `post_wash_actions`
5. `current_routine_products`
6. `routine_preference`
7. `uses_heat_tools` derived boolean
8. `is_blow_dry_only` derived boolean
9. `needs_styling_prep` derived boolean (true only when styling beyond blow-dry)

Derivation rules:

1. `is_blow_dry_only = post_wash_actions contains blow_dry_only AND not heat_tool_styling`
2. `uses_heat_tools = post_wash_actions contains heat_tool_styling OR styling_tools contains non-Föhn heat tools`
3. `needs_styling_prep = uses_heat_tools OR post_wash_actions contains non_heat_styling`

### 5.3 Mode Inference

Infer primary mode:

1. `styling_prep` if `needs_styling_prep = true`
2. `replacement_conditioner` if:
3. `thickness = fine`
4. `routine_preference = minimal`
5. `current_routine_products` lacks `conditioner` or user indicates simplification
6. `extension_conditioner` for medium/coarse hair or stronger care signals
7. `oil_replacement` if fine hair + frizz concern + routine includes oil or user wants lighter anti-frizz handling

Allow secondary mode tags; do not force one hard mode.

## 6. Candidate Retrieval

1. Retrieve only products in leave-in category from `products`.
2. Join `product_leave_in_specs` for scoring fields.
3. Use existing semantic matcher as base score source.
4. Return top N candidates (`10`) before deterministic reranking.

## 7. Scoring Model

### 7.1 Final Score

`final_score = base_match_0_100 + adjustment_sum`

1. `base_match_0_100 = combined_score * 100` from existing matcher.
2. `adjustment_sum` is additive from rules below.

### 7.2 Rule Weights

Positive adjustments:

1. `+15` if inferred primary mode is present in product `roles`.
2. `+8` if inferred secondary mode is present.
3. `+10` if `needs_styling_prep = true` and role includes `styling_prep`.
4. `+12` if `uses_heat_tools = true` and `provides_heat_protection = true`.
5. `+10 * concern_overlap_ratio` where overlap ratio = matched concerns / user concerns count.
6. `+8` for thickness-weight fit:
7. `fine -> light`
8. `normal -> medium`
9. `coarse -> rich`
10. `+6` if `routine_preference = minimal` and role includes `replacement_conditioner`.
11. `+6` if medium/coarse or damage signals and role includes `extension_conditioner`.
12. `+4` if frizz concern and role includes `oil_replacement` with `light` or `medium` weight.

Negative adjustments:

1. `-8` if user uses heat tools and product has no heat protection.
2. `-20` if `heat_activation_required = true` and `uses_heat_tools = false`.
3. `-8` if `thickness = fine` and product `weight = rich`.
4. `-6` if medium/coarse and product is replacement-only without extension/styling role.
5. `-4` for pure heat-protectant style profile when equivalent leave-in-with-care options exist.

Hard exclusion set (minimal):

1. Product inactive.
2. Missing required leave-in spec row (data quality guard).
3. Optional fallback rule: if at least 3 viable alternatives exist, exclude products with `heat_activation_required = true` when user does not heat-style.

### 7.3 Tie-Breaking

Tie-break order:

1. Higher concern overlap.
2. Better mode fit count.
3. Better weight fit.
4. Lower `sort_order`.

## 8. Recommendation Output Contract

For each recommended leave-in include:

1. `score`
2. `top_reasons[]`
3. `tradeoffs[]`
4. `mode_match[]`
5. `usage_hint` (for example: apply on towel-dried hair before styling)

Explainability examples:

1. `Recommended because it matches your frizz concern and supports styling prep.`
2. `Lower-ranked because it is heat-activated but you do not use heat tools.`

## 9. Implementation Plan

### 9.1 Backend

1. Add migration for `hair_profiles` new onboarding/routine fields.
2. Add migration for `product_leave_in_specs` table and constraints/indexes.
3. Extend types and validators for new fields.
4. Extend intent/product category mapping to include leave-in retrieval path.
5. Add deterministic leave-in reranker stage after matcher returns candidates.
6. Return structured explanation metadata with each product.

### 9.2 Admin and Ingestion

1. Update admin product UI to show leave-in spec form when category is leave-in.
2. Update ingestion pipeline to parse and upsert leave-in spec data.
3. Add validation for allowed enum values.

### 9.3 Onboarding and Profile

1. Add onboarding screens/steps for `post_wash_actions`, `routine_preference`, `current_routine_products`.
2. Persist to `hair_profiles`.
3. Add profile editing and future enrichment entrypoint.

## 10. Testing Plan

### 10.1 Unit Tests

1. Mode inference tests (blow-dry-only vs styling).
2. Weight fit tests by thickness.
3. Heat activation penalty tests.
4. Concern overlap scoring tests.
5. Replacement vs extension preference tests.

### 10.2 Integration Tests

1. Leave-in query with heat styling returns heat-protective leave-ins near top.
2. Blow-dry-only user does not get styling boost.
3. Fine hair user with frizz gets lightweight oil-replacement candidates.
4. Medium/coarse user still can receive replacement option, but not top by default.

### 10.3 Regression Tests

1. Shampoo and conditioner flows remain unchanged.
2. Existing matcher still works when leave-in spec data is missing for non-leave-in categories.

## 11. Telemetry and Monitoring

Track events:

1. Leave-in mode inferred.
2. Top score factors applied.
3. Penalties applied (`heat_activation_mismatch`, `weight_mismatch`, etc.).
4. Recommendation click-through and conversion by mode.
5. User feedback on recommendation relevance.

## 12. Rollout Strategy

1. Phase 1: Schema + admin + ingestion for leave-in specs.
2. Phase 2: Reranker active for all users.
3. Phase 3: Onboarding capture enabled.
4. Phase 4: Analyze metrics and tune weights.
5. Phase 5: Reuse pattern for next category.

## 13. Open Items

1. Final source of truth for allowed enums (DB check constraints vs app constants).
2. Whether optional fallback exclusion for heat-activated products should be enabled from day one.

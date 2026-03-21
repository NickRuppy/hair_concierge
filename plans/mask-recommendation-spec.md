> **Status: PARTIAL** — Basic mask logic built. Richer product data model (dosing, concentration, deficit targets) pending.

# Mask Recommendation Logic Spec (v1.1)

## 1. Purpose

Build a deterministic, profile-aware recommendation layer for `mask` products that:

1. Recommends masks only when there is a meaningful damage/deficit signal.
2. Keeps masks as a supplement to conditioner, not a replacement.
3. Uses structured user and product fields with typed DB columns.
4. Produces usage instructions (frequency, amount, stage, placement) with each recommendation.

## 2. Core Decisions (Locked)

1. Mask recommendation can be omitted when user need is low.
2. Mask is always supplemental care; conditioner remains required.
3. v1 scope is length-only masks (no scalp-mask recommendation logic).
4. For fine hair vs heavy/oily masks: apply strong downranking (not hard exclusion by default).
5. `mechanical_stress_level` is inferred from user styling behavior, not manually collected.
6. Use explicit typed DB columns in a category-specific table (`product_mask_specs`).
7. Recommendation output must include deterministic usage guidance.
8. For explicit mask requests with low need, return up to `3` optional low-intensity masks with clear optional framing.
9. `hair_texture` (pattern: straight/wavy/curly/coily) factors into need scoring — curly/coily hair is more porous and has higher baseline mask need.
10. Base product matcher pre-filters candidates; mask reranker scores on top (same pattern as leave-in).
11. Recommendation metadata uses discriminated union with `BaseMeta` base interface + `category` literal discriminant.

## 3. Data Model

### 3.1 User Profile Inputs

Use existing `hair_profiles` fields:

1. `hair_texture` — pattern (straight/wavy/curly/coily); factors into need scoring (porosity signal)
2. `thickness` — diameter (fine/normal/coarse); drives weight fitting + dosing
3. `concerns` — German free-text array; mapped to deficit targets
4. `cuticle_condition` — (glatt/leicht_uneben/rau); damage signal
5. `protein_moisture_balance` — (snaps/stretches_bounces/stretches_stays); deficit signal
6. `chemical_treatment` — array (natur/gefaerbt/blondiert); damage + deficit signal
7. `heat_styling` — frequency enum (taeglich/mehrmals_woche/1_mal_woche/selten/nie); stress inference
8. `styling_tools` — free-text array; stress inference (count relevant tools, not all entries)
9. `post_wash_actions` — enum array; stress inference
10. `wash_frequency` — frequency enum; stress inference
11. `routine_preference` — (minimal/balanced/advanced); adherence scoring

Note: `goals` is excluded from mask context — it does not add signal beyond what `concerns` already captures for mask recommendations.

No new persisted user field required in v1 for stress. Instead infer:

`mechanical_stress_level = low | medium | high`

from existing styling volume/frequency signals (Section 5.2).

### 3.2 Product Model

Add category-specific table:

`product_mask_specs`

Scalar columns:

| Column | Type | Allowed Values | Notes |
|---|---|---|---|
| `product_id` | `uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE` | — | 1:1 with products |
| `format` | `text NOT NULL` | `gel`, `lotion`, `cream`, `butter` | Intrinsic formulation type |
| `weight` | `text NOT NULL` | `light`, `medium`, `rich` | Intrinsic heaviness; drives thickness fit scoring |
| `concentration` | `text NOT NULL` | `low`, `medium`, `high` | Treatment intensity; key for need-gating |
| `apply_on_scalp_allowed` | `boolean NOT NULL DEFAULT false` | — | v1 length-only scope penalizes `true` |
| `leave_on_minutes` | `integer NOT NULL DEFAULT 10` | 1–60 | Drives usage hint; adherence risk for minimal routines |
| `max_uses_per_week` | `integer NOT NULL DEFAULT 1` | 1–3 | Frequency safety cap |
| `dose_fine_ml` | `integer NULL` | positive | Per-thickness dosing; nullable with fallback defaults |
| `dose_normal_ml` | `integer NULL` | positive | |
| `dose_coarse_ml` | `integer NULL` | positive | |

Array columns:

| Column | Type | Allowed Values |
|---|---|---|
| `benefits` | `text[] NOT NULL DEFAULT '{}'` | `moisture`, `protein`, `repair`, `anti_frizz`, `shine`, `detangling`, `elasticity`, `color_protect` |
| `ingredient_flags` | `text[] NOT NULL DEFAULT '{}'` | `oils`, `butters`, `proteins`, `humectants`, `silicones`, `acids` |

Timestamps: `created_at`, `updated_at` (same pattern as `product_leave_in_specs`).

Removed from earlier draft (not needed in v1):
- ~~`oil_richness`~~ — `weight` already captures heaviness for scoring; no positive scoring rule justified a separate axis.
- ~~`rinse_out`~~ — all v1 masks are rinse-out; column would be `true` on every row.
- ~~`requires_conditioner_after`~~ — conditioner-after-mask is enforced at prompt level (Section 5.3), not per-product. Tom's protocol applies universally.

Recommended constraints:

1. `leave_on_minutes >= 1 AND leave_on_minutes <= 60`
2. `max_uses_per_week >= 1 AND max_uses_per_week <= 3`
3. Dose fields (if set) must be positive integers.

Recommended indexes:

1. GIN on `benefits`
2. GIN on `ingredient_flags`
3. B-tree on `weight`
4. B-tree on `concentration`
5. Partial index on `apply_on_scalp_allowed = true`

## 4. Category Plumbing Prerequisites

Before mask-specific reranking, fix category routing/filtering:

1. Add `mask` mapping in product category DB filter map.
2. Include `mask` in router category default product mode.
3. Add `mask` branch in pipeline product matching.
4. Add mask section headers + reasoning prompt in synthesizer.

## 5. Recommendation Flow (Mask)

### 5.1 Trigger

Use mask path when classification category is `mask`, or when routine/product recommendation intent clearly requests deep treatment.

### 5.2 Context Builder

Build `MaskContext` from profile:

1. `hair_texture` — pattern (for porosity-based need adjustment)
2. `thickness` — diameter (for weight fitting + dosing)
3. `concerns` — mapped to deficit targets
4. `cuticle_condition`
5. `protein_moisture_balance`
6. `chemical_treatment`
7. `routine_preference`
8. `mechanical_stress_level` (inferred — Section 5.2.1)
9. `damage_need_level` (inferred — Section 5.2.2)
10. `deficit_targets` (inferred — Section 5.2.3)

#### 5.2.1 Inference: `mechanical_stress_level`

1. Initialize `stress_points = 0`.
2. Add points from `heat_styling`:
   - `taeglich: +4`
   - `mehrmals_woche: +3`
   - `1_mal_woche: +2`
   - `selten: +1`
   - `nie: +0`
3. Add `+2` if `post_wash_actions` contains `heat_tool_styling`.
4. Add `+1` if `post_wash_actions` contains `non_heat_styling`.
5. Add `+1` if `styling_tools` has 2+ **relevant** tools (heat tools like Glätteisen, Lockenstab, Warmluftbürste — not passive items like Haarband, Klammer). Use `isNonFoenHeatTool()` normalization from leave-in reranker pattern.
6. Add `+1` if `wash_frequency = taeglich` (more manipulation cycles).
7. Bucket:
   - `0–2 → low`
   - `3–5 → medium`
   - `6+ → high`

#### 5.2.2 Inference: `damage_need_level`

1. Initialize `need_points = 0`.
2. `cuticle_condition = rau → +3`, `leicht_uneben → +1`
3. `protein_moisture_balance = snaps → +2`, `stretches_stays → +2`
4. `chemical_treatment` includes `blondiert → +3`, `gefaerbt → +1`
5. Concerns include damage signals → `+1` each (cap `+3`). Match via `normalizeText()` (strip umlauts/diacritics):
   - `haarschaden` / `haarschaeden`
   - `spliss`
   - `trockenheit`
   - `frizz`
6. `mechanical_stress_level = high → +2`, `medium → +1`
7. `hair_texture = curly → +1`, `coily → +2` (higher porosity = higher baseline need)
8. Bucket:
   - `0–2 → low`
   - `3–6 → medium`
   - `7+ → high`

#### 5.2.3 Inference: `deficit_targets`

Derive an ordered list of deficit targets from profile signals. Use frequency-based ranking with deterministic tie-breaks.

From `protein_moisture_balance`:

| Value | Deficit Targets |
|---|---|
| `snaps` | `moisture` (primary) |
| `stretches_stays` | `protein` (primary) |
| `stretches_bounces` | — (balanced, no deficit) |

From `cuticle_condition`:

| Value | Deficit Targets |
|---|---|
| `rau` | `repair`, `moisture` |
| `leicht_uneben` | `moisture` (low priority) |
| `glatt` | — |

From `chemical_treatment`:

| Value | Deficit Targets |
|---|---|
| `blondiert` | `protein`, `repair` |
| `gefaerbt` | `color_protect` |

From `concerns` (via `normalizeText()` matching):

| Concern Pattern | Deficit Targets |
|---|---|
| `trockenheit` | `moisture` |
| `spliss` | `repair` |
| `haarschaden` / `haarschaeden` | `repair`, `protein` |
| `frizz` | `moisture`, `anti_frizz` |
| `glanzlos` / `glanz` | `shine` |

From `hair_texture` (porosity signal):

| Value | Deficit Targets |
|---|---|
| `curly` | `moisture` |
| `coily` | `moisture`, `protein` |

Deterministic ranking algorithm:

1. Collect all candidate targets from all signal groups above.
2. Count frequency per target (`target_count`).
3. Sort by:
   - `target_count` descending
   - strongest-source priority descending (if tied):
     1. `protein_moisture_balance`
     2. `chemical_treatment`
     3. `cuticle_condition`
     4. `concerns`
     5. `hair_texture`
   - alphabetical target key ascending (final deterministic fallback)
4. First target is primary; remaining targets are secondary.

This ordered list drives the `+15` / `+8` scoring rules in Section 7.2.

### 5.3 Need Gate

1. If `damage_need_level = low` and category is not explicitly `mask`: return no mask recommendations.
2. If explicit `mask` request and `damage_need_level = low`: allow only light/low-intensity options, return at most `3`, and explain optional usage.
3. Mask remains additive care; recommendation text and usage hint must preserve conditioner usage after mask.

## 6. Candidate Retrieval

Same pattern as leave-in: base product matcher → mask reranker.

1. Base product matcher pre-filters by `category = 'Maske'` + `suitable_hair_textures` + `suitable_concerns`, returns up to `10` candidates with `combined_score` (semantic + concern overlap).
2. Mask reranker joins candidates with `product_mask_specs` (excludes candidates without a spec row).
3. Base matcher `combined_score` (0–1) is scaled to 0–100 as `base_match_0_100` for the scoring model.

Clarification:

1. Base matcher uses `thickness` as the primary structural filter (`fine/normal/coarse`) against `suitable_hair_textures`.
2. `hair_texture` (`straight/wavy/curly/coily`) is used in mask reranker need/fit logic only, not for base matcher filtering.

Note: the base matcher's thickness filter is a coarse pre-filter (binary inclusion). The mask reranker's `weight` scoring (Section 7.2) provides the nuanced fit signal. If pre-filtering proves too aggressive (excluding masks the reranker would score well), revisit in v2 by relaxing the thickness filter for masks.

## 7. Scoring Model

### 7.1 Final Score

`final_score = base_match_0_100 + adjustment_sum`

### 7.2 Rule Weights

Positive:

1. `+15` if product benefits match top inferred deficit target (primary).
2. `+8` if product benefits match an additional (secondary) deficit target.
3. `+8` if `weight` fits thickness (with hair texture tolerance):
   - `fine → light`
   - `normal → medium`
   - `coarse → medium | rich`
   - Curly/coily override: `curly` or `coily` with `normal` thickness also accepts `rich` (higher porosity absorbs heavier formulations).
4. `+8` if high-need profile and concentration is `medium | high`.
5. `+6` if chemical treatment includes `blondiert` and benefits include `repair` or `protein`.
6. `+5` if low-need profile and concentration is `low`.
7. `+4` if `max_uses_per_week = 1` (supports rare-use safety baseline).

Negative:

1. `-12` if `thickness = fine` and `weight = rich` (strong heaviness penalty).
2. `-10` if low-need profile and concentration is `high`.
3. `-8` if `apply_on_scalp_allowed = true` (v1 length-only scope).
4. `-6` if `leave_on_minutes > 20` and `routine_preference = minimal` (adherence risk).
5. `-6` if `max_uses_per_week > 1` and need is not high.

Hard exclusions (minimal):

1. Product inactive.
2. Missing required mask spec row.
3. Optional guard: if at least 3 viable alternatives exist, exclude `apply_on_scalp_allowed = true`.

### 7.3 Tie-Breaking

Tie-break order:

1. Higher deficit overlap count.
2. Better thickness/weight fit.
3. Lower heaviness risk for fine hair.
4. Lower `sort_order`.

## 8. Output Contract

### 8.1 Recommendation Metadata Type

Use discriminated union with a shared base interface:

```ts
interface BaseRecommendationMeta {
  category: string          // discriminant
  score: number
  top_reasons: string[]
  tradeoffs: string[]
  usage_hint: string
}

interface LeaveInRecommendationMeta extends BaseRecommendationMeta {
  category: 'leave_in'
  mode_match: LeaveInRole[]
}

interface MaskRecommendationMeta extends BaseRecommendationMeta {
  category: 'mask'
  need_level: 'low' | 'medium' | 'high'
}

type RecommendationMeta = LeaveInRecommendationMeta | MaskRecommendationMeta
```

The `Product` type uses `recommendation_meta?: RecommendationMeta`. UI code that only needs the common fields (score, reasons, tradeoffs, usage_hint) works with `BaseRecommendationMeta` — no narrowing needed. Category-specific rendering uses `switch (meta.category)`.

### 8.2 Per-Recommendation Fields

For each recommended mask include:

1. `category: 'mask'` — discriminant
2. `score` — final score from Section 7.1
3. `top_reasons` — top 3 positive scoring reasons
4. `tradeoffs` — top 3 negative scoring reasons
5. `usage_hint` — deterministic usage guidance string
6. `need_level` — the user's inferred `damage_need_level`

### 8.3 Usage Hint Content

`usage_hint` must include (rendered in German for UI):

1. Stage: after shampoo, before conditioner
2. Placement: lengths and ends only, avoid scalp
3. Frequency by need level:
   - `low`: optional, about every 2–4 weeks
   - `medium`: about every 1–2 weeks
   - `high`: about weekly (respect `max_uses_per_week`)
4. Amount by thickness from product dose fields; fallback defaults if missing:
   - `fine`: 2–4 ml
   - `normal`: 5–8 ml
   - `coarse`: 8–12 ml

### 8.4 Result Count

- `damage_need_level = high`: return top 3 masks.
- `damage_need_level = medium`: return top 3 masks.
- `damage_need_level = low` (explicit request only): return up to 3 light/low-intensity masks with clear optional framing.
- `damage_need_level = low` (implicit/routine): return no masks.

## 9. Implementation Plan

### 9.1 Schema

1. Add migration for `product_mask_specs` table (10 scalar + 2 array columns, no `oil_richness`/`rinse_out`/`requires_conditioner_after`).
2. Constraints: format/weight/concentration CHECK, leave_on_minutes range, max_uses_per_week range, dose positivity.
3. Indexes: GIN on benefits + ingredient_flags, B-tree on weight + concentration, partial on apply_on_scalp_allowed.
4. RLS: admin-only CRUD (same pattern as `product_leave_in_specs`).
5. Updated_at trigger (reuse `update_updated_at_column()`).

### 9.2 Type System and Constants

1. Add `src/lib/mask/constants.ts` with mask-specific enums (MaskFormat, MaskWeight, MaskConcentration, MaskBenefit, MaskIngredientFlag) + `ProductMaskSpecs` interface.
2. Refactor recommendation metadata into discriminated union:
   - Extract `BaseRecommendationMeta` (shared: score, top_reasons, tradeoffs, usage_hint).
   - `LeaveInRecommendationMeta extends BaseRecommendationMeta` (category: 'leave_in', mode_match).
   - `MaskRecommendationMeta extends BaseRecommendationMeta` (category: 'mask', need_level).
   - `RecommendationMeta = LeaveInRecommendationMeta | MaskRecommendationMeta`.
3. Update `Product` type: `recommendation_meta?: RecommendationMeta`, add `mask_specs?: ProductMaskSpecs | null`.
4. Update leave-in reranker to emit `category: 'leave_in'` on its metadata.

### 9.3 Admin + Validation

1. Extend `productSchema` with typed `mask_specs`.
2. Extend admin product UI with mask spec form (shown when category matches mask).
3. Extend admin product APIs (`GET/POST/PUT`) to hydrate/upsert/delete `product_mask_specs`.

### 9.4 Pipeline + Reranker

1. Add `inferMechanicalStress()` — uses heat_styling, post_wash_actions, styling_tools (relevant tools only via `isNonFoenHeatTool()`), wash_frequency.
2. Add `inferDamageNeedLevel()` — uses cuticle_condition, protein_moisture_balance, chemical_treatment, concerns, mechanical_stress_level, hair_texture.
3. Add `inferDeficitTargets()` — maps profile signals to ordered deficit list per Section 5.2.3 tables.
4. Add `mapMaskConcernToBenefits()` — mask-specific concern→benefit mapper (extends leave-in pattern with `elasticity`, `color_protect`).
5. Add `rerankMaskProducts()` — deterministic scoring per Section 7.2.
6. Add mask branch in `pipeline.ts` (after base matcher, before synthesis).
7. Add mask to router category product mode + category DB filter map in `product-matcher.ts`.
   - Category map for v1 mask is strict: `mask -> ["Maske"]` (no variants).
8. Add mask section headers + reasoning prompt in synthesizer (conditioner-after-mask messaging baked into prompt).

### 9.5 Tests

1. Unit tests for `inferMechanicalStress()` — verify styling_tools counts only relevant heat tools.
2. Unit tests for `inferDamageNeedLevel()` — verify hair_texture contributes (curly +1, coily +2).
3. Unit tests for `inferDeficitTargets()` — verify dedup + priority ordering.
4. Unit tests for fine-hair heaviness penalty (`-12` for fine + rich).
5. Unit tests for curly/coily weight tolerance override (normal+curly accepts rich).
6. Integration test: explicit mask query with low need returns up to 3 optional/light masks.
7. Integration test: high-damage profile ranks repair/protein masks first.
8. Integration test: coily hair with moderate damage scores higher need than straight hair with same signals.

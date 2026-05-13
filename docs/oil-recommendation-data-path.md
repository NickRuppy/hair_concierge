# Oil Recommendation Data Path

## Decision

Keep oil on `product_oil_eligibility` for now. Do not create or migrate to `product_oil_specs` until oil needs product-level properties that cannot be represented on the current eligibility rows.

The current table is already richer than the original strict matcher bridge:

- `thickness`
- `oil_subtype`
- `oil_purpose`
- `ingredient_flags`

That is enough for the current production behavior: purpose inference, thickness eligibility, subtype mapping, finish bridge handling, and no-recommendation guardrails.

## Live DB Snapshot

Read-only check against the live Supabase project on 2026-05-13:

- `products` where `category = 'Öle'` and `is_active = true`: 41
- `product_oil_eligibility`: 45 rows
- active oil products without eligibility rows: 0
- `product_oil_specs`: not present in the live schema cache
- `oil_purpose` coverage on active oil eligibility rows: 45/45

Purpose distribution:

- `pre_wash_oiling`: 16 rows
- `styling_finish`: 17 rows
- `light_finish`: 12 rows

Subtype distribution:

- `natuerliches-oel`: 16 rows
- `styling-oel`: 15 rows
- `trocken-oel`: 14 rows

## Production Selection Flow

Current agentic product selection uses `select_products`, not the older embedding/RAG path, for product facts.

Oil path:

1. `buildRecommendationRequestContext()` infers `oilPurpose` and `oilNoRecommendationReason` from the user message.
2. `buildOilCategoryDecision()` maps the inferred purpose to the legacy matcher subtype:
   - `pre_wash_oiling` -> `natuerliches-oel`
   - `styling_finish` -> `styling-oel`
   - `light_finish` -> `trocken-oel`
3. `selectOilProductsWithEngine()` first fetches strict subtype candidates through `matchOilProducts()`, which reads `product_oil_eligibility` by `thickness + oil_subtype`.
4. It also fetches generic active oil candidates as a safety net.
5. It loads `product_oil_eligibility.oil_purpose` for the candidate set and reranks purpose-first.
6. `rerankOilProductsWithEngine()` prefers exact `oil_purpose`, allows only the adjacent styling/light finish bridge when exact finish coverage is thin, and preserves the classic subtype match when `oil_purpose` is legacy-null.

The older oil-specific RAG decision module and unused `src/lib/rag/category-engine` wrappers were removed after reachability checks showed production uses the recommendation engine selector above.

## Guardrails

Oil remains guidance-only, without product cards, for:

- scalp treatment requests such as dandruff, itching, irritation, hair loss, or growth
- named therapy oils that are not catalogued as regular oil products
- overload risk where an oil would likely worsen coated, greasy, flat, or weighed-down hair
- requests better served by another category, such as leave-in, conditioner, mask, or heat protectant

## Migration Criteria

Create a dedicated `product_oil_specs` table only if oil needs stable product-level properties that should not repeat per eligibility row. Plausible examples:

- application zone with independent scalp/length semantics
- cosmetic finish strength
- volatile/silicone-heavy finish behavior beyond ingredient flags
- therapy-oil lifecycle once those products become catalogued

Until then, `product_oil_eligibility` is the canonical oil fit table.

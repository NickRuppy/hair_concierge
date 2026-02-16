# Workstream 1: Rule Engine Pre-Filter

> **Standalone implementation spec.** This file contains everything needed to implement WS1 independently.

## Goal

Deterministically eliminate ineligible products/content *before* the LLM ever sees them, so constraint violations become physically impossible. The LLM only receives pre-filtered candidates — it cannot recommend something it was never given.

## Background: Current Pipeline

The current pipeline in `src/lib/rag/pipeline.ts` calls:
1. `classifyIntent(message)` — returns one of 8 intent types
2. `retrieveContext(query, options)` — vector search via `match_content_chunks` RPC, then `rerankChunks()` with 1.15x profile boost + deduplication
3. `matchProducts(query, hairType, concerns)` — vector search via `match_products` RPC with `0.6 * similarity + 0.4 * profile_score`

**The problem:** Neither retriever nor product-matcher enforces hard business rules. The metadata filter only applies `hair_texture` for `product_recommendation` intent. No rules exist for chemical treatment conflicts, ingredient incompatibilities, or concern-product alignment beyond basic vector similarity.

## New Dependency

```bash
npm install json-rules-engine
```

- [json-rules-engine docs](https://github.com/CacheControl/json-rules-engine)
- Rules are JSON objects — storable in DB, editable by non-developers
- Supports async fact evaluation, priority ordering, and custom operators

## Database Migration

**File:** `supabase/migrations/20260217000000_create_recommendation_rules.sql`

```sql
-- Stores business rules for product/content filtering
-- Rules are in json-rules-engine format, loaded and cached at runtime
CREATE TABLE recommendation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  rule_json jsonb NOT NULL,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,  -- higher = evaluated first
  applies_to text NOT NULL DEFAULT 'both' CHECK (applies_to IN ('products', 'chunks', 'both')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS: only admins can manage rules; authenticated users can read active rules
ALTER TABLE recommendation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recommendation_rules_select_authenticated"
  ON recommendation_rules FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "recommendation_rules_admin_all"
  ON recommendation_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Seed initial rules
INSERT INTO recommendation_rules (name, description, applies_to, rule_json) VALUES
(
  'hair_type_compatibility',
  'Products must be suitable for the user hair type',
  'products',
  '{
    "conditions": {
      "all": [{
        "fact": "product_suitable_hair_types",
        "operator": "doesNotContain",
        "value": { "fact": "user_hair_type" }
      }]
    },
    "event": {
      "type": "disqualified",
      "params": { "reason": "Product not suitable for user hair type" }
    }
  }'::jsonb
),
(
  'concern_alignment',
  'Products must address at least one user concern',
  'products',
  '{
    "conditions": {
      "all": [{
        "fact": "concern_overlap_count",
        "operator": "equal",
        "value": 0
      }, {
        "fact": "user_concerns_count",
        "operator": "greaterThan",
        "value": 0
      }]
    },
    "event": {
      "type": "disqualified",
      "params": { "reason": "Product addresses none of the user concerns" }
    }
  }'::jsonb
),
(
  'sulfate_color_conflict',
  'No sulfate products for color-treated hair',
  'products',
  '{
    "conditions": {
      "all": [{
        "fact": "user_has_color_treatment",
        "operator": "equal",
        "value": true
      }, {
        "fact": "product_has_sulfates",
        "operator": "equal",
        "value": true
      }]
    },
    "event": {
      "type": "disqualified",
      "params": { "reason": "Sulfate products damage color-treated hair" }
    }
  }'::jsonb
),
(
  'chunk_texture_match',
  'Content chunks with explicit hair_texture metadata must match user texture',
  'chunks',
  '{
    "conditions": {
      "all": [{
        "fact": "chunk_has_texture_metadata",
        "operator": "equal",
        "value": true
      }, {
        "fact": "chunk_texture_matches_user",
        "operator": "equal",
        "value": false
      }]
    },
    "event": {
      "type": "disqualified",
      "params": { "reason": "Content chunk texture does not match user profile" }
    }
  }'::jsonb
);
```

Apply via: `mcp__supabase__apply_migration` or `supabase migration new create_recommendation_rules`

## Files to Create

### `src/lib/rag/rule-engine.ts`

```typescript
import { Engine, RuleProperties } from 'json-rules-engine';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { HairProfile, Product, IntentType } from '@/lib/types';
import type { RetrievedChunk } from './retriever';

// ── Types ──────────────────────────────────────────────

interface FilterResult<T> {
  eligible: T[];
  disqualified: { item: T; reasons: string[] }[];
}

interface RuleRow {
  id: string;
  name: string;
  rule_json: RuleProperties;
  applies_to: 'products' | 'chunks' | 'both';
  priority: number;
}

// ── Rule Cache ─────────────────────────────────────────
// Rules rarely change — cache for 5 minutes

let cachedRules: RuleRow[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function loadRules(): Promise<RuleRow[]> {
  if (cachedRules && Date.now() < cacheExpiry) return cachedRules;

  const { data, error } = await supabaseAdmin
    .from('recommendation_rules')
    .select('id, name, rule_json, applies_to, priority')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  if (error) {
    console.error('[rule-engine] Failed to load rules:', error);
    return cachedRules ?? [];  // Fallback to stale cache if available
  }

  cachedRules = data as RuleRow[];
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return cachedRules;
}

// ── Fact Builders ──────────────────────────────────────
// These compute the "facts" that json-rules-engine evaluates

function buildProductFacts(product: Product, profile: HairProfile) {
  const userConcerns = profile.concerns ?? [];
  const productConcerns = product.suitable_concerns ?? [];
  const overlapCount = userConcerns.filter(c => productConcerns.includes(c)).length;

  return {
    // Product attributes
    product_suitable_hair_types: product.suitable_hair_types ?? [],
    product_has_sulfates: (product.tags ?? []).some(t =>
      t.toLowerCase().includes('sulfat') || t.toLowerCase().includes('sls')
    ),
    concern_overlap_count: overlapCount,

    // User attributes
    user_hair_type: profile.hair_type,
    user_hair_texture: profile.hair_texture,
    user_concerns_count: userConcerns.length,
    user_has_color_treatment: (profile.chemical_treatment ?? []).some(t =>
      t === 'gefaerbt' || t === 'blondiert'
    ),
  };
}

function buildChunkFacts(chunk: RetrievedChunk, profile: HairProfile) {
  const chunkTexture = chunk.metadata?.hair_texture as string | undefined;

  return {
    chunk_has_texture_metadata: !!chunkTexture,
    chunk_texture_matches_user: !chunkTexture || chunkTexture === profile.hair_texture,
    user_hair_texture: profile.hair_texture,
  };
}

// ── Main Filter Functions ──────────────────────────────

export async function filterProducts(
  products: Product[],
  profile: HairProfile,
  intent: IntentType,
): Promise<FilterResult<Product>> {
  const rules = await loadRules();
  const productRules = rules.filter(r => r.applies_to === 'products' || r.applies_to === 'both');

  if (productRules.length === 0) {
    return { eligible: products, disqualified: [] };
  }

  const engine = new Engine();
  for (const rule of productRules) {
    engine.addRule(rule.rule_json);
  }

  const eligible: Product[] = [];
  const disqualified: { item: Product; reasons: string[] }[] = [];

  for (const product of products) {
    const facts = buildProductFacts(product, profile);
    const { events } = await engine.run(facts);

    const disqualifyEvents = events.filter(e => e.type === 'disqualified');
    if (disqualifyEvents.length > 0) {
      disqualified.push({
        item: product,
        reasons: disqualifyEvents.map(e => (e.params as { reason: string }).reason),
      });
    } else {
      eligible.push(product);
    }
  }

  // Safety: if ALL products got filtered out, return top 3 from original set
  // (better to show something than nothing)
  if (eligible.length === 0 && products.length > 0) {
    console.warn('[rule-engine] All products filtered out — falling back to top 3 unfiltered');
    return { eligible: products.slice(0, 3), disqualified: [] };
  }

  return { eligible, disqualified };
}

export async function filterChunks(
  chunks: RetrievedChunk[],
  profile: HairProfile,
  intent: IntentType,
): Promise<FilterResult<RetrievedChunk>> {
  // Only apply chunk filtering for product-related intents
  const PRODUCT_INTENTS: IntentType[] = ['product_recommendation', 'routine_help'];
  if (!PRODUCT_INTENTS.includes(intent)) {
    return { eligible: chunks, disqualified: [] };
  }

  const rules = await loadRules();
  const chunkRules = rules.filter(r => r.applies_to === 'chunks' || r.applies_to === 'both');

  if (chunkRules.length === 0) {
    return { eligible: chunks, disqualified: [] };
  }

  const engine = new Engine();
  for (const rule of chunkRules) {
    engine.addRule(rule.rule_json);
  }

  const eligible: RetrievedChunk[] = [];
  const disqualified: { item: RetrievedChunk; reasons: string[] }[] = [];

  for (const chunk of chunks) {
    const facts = buildChunkFacts(chunk, profile);
    const { events } = await engine.run(facts);

    const disqualifyEvents = events.filter(e => e.type === 'disqualified');
    if (disqualifyEvents.length > 0) {
      disqualified.push({
        item: chunk,
        reasons: disqualifyEvents.map(e => (e.params as { reason: string }).reason),
      });
    } else {
      eligible.push(chunk);
    }
  }

  return { eligible, disqualified };
}

// ── Cache Invalidation ─────────────────────────────────

export function invalidateRuleCache(): void {
  cachedRules = null;
  cacheExpiry = 0;
}
```

## Files to Modify

### `src/lib/rag/pipeline.ts`

**Where to insert rule filtering:**

After `retrieveContext()` (currently Step 2), add:
```typescript
// Step 2.5: Rule engine pre-filter on chunks
const { eligible: eligibleChunks, disqualified: disqualifiedChunks } =
  await filterChunks(retrievedChunks, hairProfile, intent);

if (disqualifiedChunks.length > 0) {
  console.log(`[pipeline] Rule engine filtered ${disqualifiedChunks.length} chunks`);
}
```

After `matchProducts()` (currently Step 5), add:
```typescript
// Step 5.5: Rule engine pre-filter on products
const { eligible: eligibleProducts, disqualified: disqualifiedProducts } =
  await filterProducts(matchedProducts, hairProfile, intent);

if (disqualifiedProducts.length > 0) {
  console.log(`[pipeline] Rule engine filtered ${disqualifiedProducts.length} products`);
}
```

Pass `eligibleChunks` and `eligibleProducts` to `synthesizeResponse()` instead of the raw results.

### `src/lib/rag/retriever.ts`

No changes needed — the rule filter runs *after* retrieval, before synthesis. The existing `metadata_filter` on `match_content_chunks` is complementary (DB-level pre-filter), not replaced.

### `src/lib/rag/product-matcher.ts`

No changes needed if rules are applied in `pipeline.ts` after `matchProducts()` returns. The existing `match_products` RPC still does the initial vector search + profile scoring.

## Important: Product Metadata for Sulfate Detection

The sulfate rule requires knowing which products contain sulfates. Currently, this is approximated by checking `product.tags` for sulfate-related keywords. For better accuracy:

**Option A (quick):** Ensure product tags include `"sulfathaltig"` or `"sulfatfrei"` during product ingestion.

**Option B (thorough):** Add a `flags jsonb` column to the products table:
```sql
ALTER TABLE products ADD COLUMN flags jsonb DEFAULT '{}';
-- Example: { "contains_sulfates": true, "contains_silicones": false, "contains_parabens": false }
```

Start with Option A (tag convention), upgrade to Option B later if needed.

## Verification

### Unit Tests (create `tests/unit/rule-engine.test.ts`)

1. **Hair type filter:** Product with `suitable_hair_types: ["dick"]` is disqualified when user has `hair_type: "glatt"` and the product types don't include "glatt"
2. **Concern alignment:** Product with `suitable_concerns: ["Frizz"]` is disqualified when user has `concerns: ["Haarausfall", "Schuppen"]` (zero overlap)
3. **Sulfate-color conflict:** Product tagged `"sulfathaltig"` is disqualified when user has `chemical_treatment: ["gefaerbt"]`
4. **Chunk texture filter:** Chunk with `metadata.hair_texture: "dick"` is disqualified when user has `hair_texture: "fein"` and intent is `product_recommendation`
5. **Chunk texture passthrough:** Same chunk passes when intent is `general_chat` (not a product intent)
6. **Empty fallback:** When all products get filtered, returns top 3 from original set

### Integration Test

1. Create a test user profile with `hair_texture: "fein"`, `chemical_treatment: ["blondiert"]`
2. Send a product recommendation message
3. Verify: no products with `suitable_hair_types` excluding "fein" types appear
4. Verify: no products tagged with sulfate indicators appear

### Playwright QA

Run existing QA fixtures (`npm run test:qa`) and verify all 16 questions produce rule-compliant recommendations.

## Dependencies on Other Workstreams

- **None** — WS1 can be implemented independently
- WS2 (Deterministic Scoring) builds on WS1's eligible set as input
- WS3 (Structured Outputs) benefits from WS1 reducing the candidate set

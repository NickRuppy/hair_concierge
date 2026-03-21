# Workstream 5: Semantic Caching Layer

> **Standalone implementation spec.** This file contains everything needed to implement WS5 independently.

## Goal

Cache recommendation responses so that semantically similar queries from users with the same profile attributes return instant, consistent responses. Target: 50-90% cost reduction at 10K+ user scale, sub-second response times for cache hits.

## Background: Current Cost Structure

Every chat message triggers:
1. Embedding generation (~$0.00013 per query)
2. Intent classification (GPT-4o, ~30 tokens out, ~$0.005)
3. Response synthesis (GPT-4o, ~500-1000 tokens out, ~$0.03-0.06)
4. Optionally: memory extraction (GPT-4o-mini, ~$0.003)

**Total per message: ~$0.04-0.07**
**At 10K users x 20 messages/month = 200K messages/month = $8K-14K/month**

With 60% cache hit rate: **$3.2K-5.6K/month** (saving $5K-8K/month)

## Database Migration

**File:** `supabase/migrations/20260217000003_create_recommendation_cache.sql`

```sql
-- Enable pgcrypto for hashing if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE recommendation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cache key components
  cache_key_hash text NOT NULL,              -- SHA-256 hash of deterministic key
  query_embedding vector(384),               -- For semantic similarity matching
  intent_type text NOT NULL,
  hair_texture text,
  concerns text[] DEFAULT '{}',
  product_set_hash text,                     -- Hash of eligible product IDs

  -- Cached response
  response_content text NOT NULL,
  response_products jsonb,                   -- Product recommendations array
  response_sources jsonb,                    -- Citation sources array
  response_metadata jsonb DEFAULT '{}',      -- Additional context (intent, profile snapshot)

  -- Cache management
  hit_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  last_hit_at timestamptz,
  expires_at timestamptz NOT NULL,

  UNIQUE(cache_key_hash)
);

-- HNSW index for semantic similarity search
CREATE INDEX idx_cache_embedding ON recommendation_cache
  USING hnsw (query_embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Expiry index for cleanup
CREATE INDEX idx_cache_expiry ON recommendation_cache (expires_at);

-- Partition index for scoped semantic search
CREATE INDEX idx_cache_intent_texture ON recommendation_cache (intent_type, hair_texture);

-- RLS: service role only (no user-facing access)
ALTER TABLE recommendation_cache ENABLE ROW LEVEL SECURITY;

-- No user-facing policies — only accessed via service role (supabaseAdmin)

-- Cleanup function: run periodically to remove expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM recommendation_cache
  WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- RPC for semantic cache lookup (scoped by intent + texture)
CREATE OR REPLACE FUNCTION match_cache_entry(
  query_emb vector(384),
  p_intent_type text,
  p_hair_texture text DEFAULT NULL,
  similarity_threshold float DEFAULT 0.92,
  max_results int DEFAULT 1
)
RETURNS TABLE (
  id uuid,
  cache_key_hash text,
  response_content text,
  response_products jsonb,
  response_sources jsonb,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.cache_key_hash,
    rc.response_content,
    rc.response_products,
    rc.response_sources,
    (1 - (rc.query_embedding <=> query_emb))::float AS similarity
  FROM recommendation_cache rc
  WHERE rc.intent_type = p_intent_type
    AND (p_hair_texture IS NULL OR rc.hair_texture = p_hair_texture)
    AND rc.expires_at > now()
    AND (1 - (rc.query_embedding <=> query_emb)) >= similarity_threshold
  ORDER BY rc.query_embedding <=> query_emb ASC
  LIMIT max_results;
END;
$$;
```

## Files to Create

### `src/lib/rag/cache.ts`

```typescript
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/openai/embeddings';
import type { Product, IntentType, HairTexture, CitationSource } from '@/lib/types';

// ── Types ──────────────────────────────────────────────

interface CacheKey {
  intentType: IntentType;
  hairTexture: HairTexture | null;
  concerns: string[];
  eligibleProductIds: string[];
}

interface CachedResponse {
  content: string;
  products: Product[] | null;
  sources: CitationSource[] | null;
}

// ── TTL Configuration ──────────────────────────────────

const TTL_SECONDS: Partial<Record<IntentType, number>> = {
  product_recommendation: 4 * 60 * 60,   // 4 hours
  routine_help: 4 * 60 * 60,              // 4 hours
  hair_care_advice: 24 * 60 * 60,         // 24 hours
  ingredient_question: 24 * 60 * 60,      // 24 hours
  diagnosis: 12 * 60 * 60,                // 12 hours
  // general_chat, photo_analysis, followup: NOT cached
};

const CACHEABLE_INTENTS = new Set(Object.keys(TTL_SECONDS));

// ── Cache Key Computation ──────────────────────────────

function computeCacheKeyHash(key: CacheKey): string {
  const normalized = JSON.stringify({
    intent: key.intentType,
    texture: key.hairTexture,
    concerns: [...key.concerns].sort(),
    products: createHash('sha256')
      .update([...key.eligibleProductIds].sort().join(','))
      .digest('hex')
      .slice(0, 16),
  });
  return createHash('sha256').update(normalized).digest('hex');
}

// ── Public API ─────────────────────────────────────────

/**
 * Check if a cached response exists for this query.
 * Two-tier lookup: exact key match first, then semantic similarity.
 */
export async function checkCache(
  query: string,
  queryEmbedding: number[],
  cacheKey: CacheKey,
): Promise<CachedResponse | null> {
  if (!CACHEABLE_INTENTS.has(cacheKey.intentType)) return null;

  // Tier 1: Exact key match (fastest)
  const keyHash = computeCacheKeyHash(cacheKey);
  const { data: exactMatch } = await supabaseAdmin
    .from('recommendation_cache')
    .select('response_content, response_products, response_sources')
    .eq('cache_key_hash', keyHash)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (exactMatch) {
    // Increment hit count (fire-and-forget)
    supabaseAdmin
      .from('recommendation_cache')
      .update({ hit_count: supabaseAdmin.rpc('increment_hit_count'), last_hit_at: new Date().toISOString() })
      .eq('cache_key_hash', keyHash)
      .then(() => {});  // Don't await

    // Actually, simpler approach:
    await supabaseAdmin.rpc('increment_cache_hits', { p_cache_key_hash: keyHash });

    return {
      content: exactMatch.response_content,
      products: exactMatch.response_products as Product[] | null,
      sources: exactMatch.response_sources as CitationSource[] | null,
    };
  }

  // Tier 2: Semantic similarity (if embedding available)
  if (queryEmbedding.length > 0) {
    const { data: semanticMatches } = await supabaseAdmin.rpc('match_cache_entry', {
      query_emb: queryEmbedding,
      p_intent_type: cacheKey.intentType,
      p_hair_texture: cacheKey.hairTexture,
      similarity_threshold: 0.92,
      max_results: 1,
    });

    if (semanticMatches?.length) {
      const match = semanticMatches[0];
      return {
        content: match.response_content,
        products: match.response_products as Product[] | null,
        sources: match.response_sources as CitationSource[] | null,
      };
    }
  }

  return null;
}

/**
 * Store a response in the cache.
 */
export async function storeInCache(
  query: string,
  queryEmbedding: number[],
  cacheKey: CacheKey,
  response: CachedResponse,
): Promise<void> {
  if (!CACHEABLE_INTENTS.has(cacheKey.intentType)) return;

  const ttl = TTL_SECONDS[cacheKey.intentType];
  if (!ttl) return;

  const keyHash = computeCacheKeyHash(cacheKey);
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  await supabaseAdmin
    .from('recommendation_cache')
    .upsert({
      cache_key_hash: keyHash,
      query_embedding: queryEmbedding,
      intent_type: cacheKey.intentType,
      hair_texture: cacheKey.hairTexture,
      concerns: cacheKey.concerns,
      product_set_hash: createHash('sha256')
        .update([...cacheKey.eligibleProductIds].sort().join(','))
        .digest('hex')
        .slice(0, 16),
      response_content: response.content,
      response_products: response.products,
      response_sources: response.sources,
      expires_at: expiresAt,
    }, {
      onConflict: 'cache_key_hash',
    });
}

/**
 * Invalidate cache entries matching given criteria.
 * Called when user profile updates, products change, or content is re-ingested.
 */
export async function invalidateCache(criteria: {
  hairTexture?: string;
  intentType?: string;
  all?: boolean;
}): Promise<number> {
  let query = supabaseAdmin.from('recommendation_cache').delete();

  if (criteria.all) {
    query = query.neq('id', '00000000-0000-0000-0000-000000000000');  // Delete all
  } else {
    if (criteria.hairTexture) {
      query = query.eq('hair_texture', criteria.hairTexture);
    }
    if (criteria.intentType) {
      query = query.eq('intent_type', criteria.intentType);
    }
  }

  const { count } = await query.select('*', { count: 'exact', head: true });
  await query;
  return count ?? 0;
}

/**
 * Check if an intent type is cacheable.
 */
export function isCacheable(intentType: IntentType): boolean {
  return CACHEABLE_INTENTS.has(intentType);
}
```

**Note:** The `increment_cache_hits` RPC needs to be added to the migration:

```sql
-- Add to migration:
CREATE OR REPLACE FUNCTION increment_cache_hits(p_cache_key_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE recommendation_cache
  SET hit_count = hit_count + 1, last_hit_at = now()
  WHERE cache_key_hash = p_cache_key_hash;
END;
$$;
```

## Files to Modify

### `src/lib/rag/pipeline.ts`

Insert cache check at the very beginning and cache store at the end:

```typescript
import { checkCache, storeInCache, isCacheable } from './cache';

// In runPipeline():

// Step 0: Early cache check (before any LLM calls)
// Note: We need intent + embedding first, so cache check happens after Step 1
// But we can do a "quick" embedding generation for the cache check

const queryEmbedding = await generateEmbedding(message);

// After Step 1 (intent classification) but before Step 2 (retrieval):
if (isCacheable(intent) && hairProfile) {
  const cacheKey = {
    intentType: intent,
    hairTexture: hairProfile.hair_texture,
    concerns: hairProfile.concerns ?? [],
    eligibleProductIds: [],  // Empty for initial check — use semantic match
  };

  const cached = await checkCache(message, queryEmbedding, cacheKey);
  if (cached) {
    console.log(`[pipeline] Cache hit for intent=${intent}, texture=${hairProfile.hair_texture}`);
    return {
      type: 'cached' as const,
      content: cached.content,
      products: cached.products ?? [],
      sources: cached.sources ?? [],
      conversationId,
      intent,
    };
  }
}

// ... rest of pipeline ...

// After synthesis completes (Step 7):
if (isCacheable(intent) && hairProfile) {
  const cacheKey = {
    intentType: intent,
    hairTexture: hairProfile.hair_texture,
    concerns: hairProfile.concerns ?? [],
    eligibleProductIds: (eligibleProducts ?? []).map(p => p.id),
  };

  // Fire-and-forget cache store
  storeInCache(message, queryEmbedding, cacheKey, {
    content: fullResponseContent,
    products: finalProducts,
    sources: finalSources,
  }).catch(err => console.error('[pipeline] Cache store failed:', err));
}
```

### `src/app/api/chat/route.ts`

Handle cached responses (emit as SSE without pipeline):

```typescript
if (pipelineResult.type === 'cached') {
  // Emit cached response as SSE events
  writer.write(encoder.encode(`data: ${JSON.stringify({
    type: 'conversation_id',
    data: pipelineResult.conversationId,
  })}\n\n`));

  writer.write(encoder.encode(`data: ${JSON.stringify({
    type: 'content_delta',
    data: pipelineResult.content,
  })}\n\n`));

  if (pipelineResult.products?.length) {
    writer.write(encoder.encode(`data: ${JSON.stringify({
      type: 'product_recommendations',
      data: pipelineResult.products,
    })}\n\n`));
  }

  if (pipelineResult.sources?.length) {
    writer.write(encoder.encode(`data: ${JSON.stringify({
      type: 'sources',
      data: pipelineResult.sources,
    })}\n\n`));
  }

  writer.write(encoder.encode(`data: ${JSON.stringify({
    type: 'done',
    data: { intent: pipelineResult.intent, cached: true },
  })}\n\n`));
}
```

## Cache Invalidation Triggers

### On Profile Update
When a user updates their profile (hair_texture, concerns), invalidate their segment's cache:

```typescript
// In profile update handler:
import { invalidateCache } from '@/lib/rag/cache';

// After profile update:
await invalidateCache({ hairTexture: updatedProfile.hair_texture });
```

### On Product Catalog Update
When products are added/updated/removed, invalidate product recommendation caches:

```typescript
// In product admin handlers:
await invalidateCache({ intentType: 'product_recommendation' });
await invalidateCache({ intentType: 'routine_help' });
```

### On Content Re-ingestion
When markdown content is re-ingested:

```typescript
// In ingestion scripts:
await invalidateCache({ intentType: 'hair_care_advice' });
await invalidateCache({ intentType: 'ingredient_question' });
```

### Scheduled Cleanup
Run `cleanup_expired_cache()` periodically (e.g., daily cron or Supabase Edge Function):

```typescript
await supabaseAdmin.rpc('cleanup_expired_cache');
```

## Verification

### Unit Tests

1. `computeCacheKeyHash()` returns identical hash for same inputs regardless of array order
2. `computeCacheKeyHash()` returns different hash when any input changes
3. `isCacheable()` returns true for product_recommendation, false for general_chat
4. Cache store + check round-trip: store a response, then check returns it

### Integration Tests

1. Send identical query with same profile twice -> second response is faster (cache hit)
2. Send semantically similar query (different wording, same intent) -> cache hit
3. Send same query with different hair_texture -> cache miss (different segment)
4. Update user profile -> cache invalidated, next query is a miss
5. Wait for TTL expiry -> cache miss

### Performance Tests

1. Measure response time for cache hit vs cache miss
2. Target: cache hit < 500ms, cache miss = normal pipeline time (3-8s)
3. Run 100 identical queries -> verify only 1 embedding generation + 1 LLM call

### Monitoring

Track and log:
- Cache hit rate by intent type
- Average latency for hits vs misses
- Cache size (row count + storage)
- Invalidation frequency

## Dependencies

- **WS2 (recommended):** Deterministic scoring ensures cached responses are the same ones that would be generated fresh. Without WS2, caching still works but cached responses may differ from fresh ones.
- **Phase 1 overall:** Cache works best when the pipeline produces consistent outputs (WS1 + WS2 + WS3).

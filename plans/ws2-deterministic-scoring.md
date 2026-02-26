# Workstream 2: Deterministic Scoring & Ranking

> **Standalone implementation spec.** This file contains everything needed to implement WS2 independently.

## Goal

Replace probabilistic LLM-based product/chunk selection with a deterministic scoring function. Same inputs = same product ranking every time. The LLM receives products in pre-determined order and generates explanations only — it does NOT choose or reorder products.

## Background: Current Ranking Logic

### Chunk Re-ranking (`src/lib/rag/retriever.ts` — `rerankChunks()`)
1. If chunk's `metadata.hair_texture` matches user's `hair_texture` -> 1.15x multiplier on `weighted_similarity`
2. Sort by `weighted_similarity` descending
3. Deduplicate: if >80% of shorter chunk's text appears in a higher-ranked chunk, drop it
4. Return top N

### Product Scoring (`match_products` RPC — `supabase/migrations/`)
- `combined_score = 0.6 * semantic_similarity + 0.4 * profile_score`
- `profile_score = 0.5 * hair_type_match + 0.5 * (concern_overlap / user_concerns.length)`

### The Problem
Both approaches produce non-deterministic results because:
- Vector similarity varies slightly between API calls (floating-point batching)
- The LLM can reorder or emphasize different products each time
- No user preference signals (likes/dislikes) influence ranking
- No novelty consideration (same products recommended repeatedly)

## Files to Create

### `src/lib/rag/scorer.ts`

```typescript
import type { HairProfile, Product } from '@/lib/types';
import type { RetrievedChunk } from './retriever';

// ── Scoring Weights ────────────────────────────────────
// Weights must sum to 1.0 for normalized output

const CHUNK_WEIGHTS = {
  semanticSimilarity: 0.35,
  authorityWeight: 0.25,
  hairTextureMatch: 0.20,
  concernRelevance: 0.15,
  recency: 0.05,           // prefer newer content for evolving topics
} as const;

const PRODUCT_WEIGHTS = {
  semanticSimilarity: 0.25,
  hairTypeMatch: 0.20,
  concernOverlap: 0.20,
  authorityWeight: 0.15,   // from source_type of originating chunk
  userPreference: 0.10,    // liked/disliked history
  novelty: 0.05,           // not recently recommended
  priceRelevance: 0.05,    // optional: budget awareness
} as const;

// ── Chunk Scoring ──────────────────────────────────────

export interface ChunkScoringInput {
  chunk: RetrievedChunk;
  userProfile: HairProfile;
}

export function scoreChunk(input: ChunkScoringInput): number {
  const { chunk, userProfile } = input;
  const w = CHUNK_WEIGHTS;

  // 1. Semantic similarity (already 0-1 from vector search)
  const similarity = chunk.weighted_similarity ?? chunk.similarity ?? 0;

  // 2. Authority weight (normalize 0.8-1.4 range to 0-1)
  const authorityRaw = getAuthorityWeight(chunk.source_type);
  const authority = (authorityRaw - 0.8) / (1.4 - 0.8);  // 0.8->0, 1.4->1

  // 3. Hair texture match (binary: 0 or 1)
  const chunkTexture = chunk.metadata?.hair_texture as string | undefined;
  const textureMatch = !chunkTexture || chunkTexture === userProfile.hair_texture ? 1 : 0;

  // 4. Concern relevance (0-1)
  const chunkConcern = chunk.metadata?.concern as string | undefined;
  const userConcerns = userProfile.concerns ?? [];
  const concernRelevance = chunkConcern && userConcerns.includes(chunkConcern) ? 1 :
    chunkConcern ? 0.3 : 0.5;  // no metadata = neutral

  // 5. Recency (always 0.5 for now — can be enhanced with content dates)
  const recency = 0.5;

  return (
    similarity * w.semanticSimilarity +
    authority * w.authorityWeight +
    textureMatch * w.hairTextureMatch +
    concernRelevance * w.concernRelevance +
    recency * w.recency
  );
}

// ── Product Scoring ────────────────────────────────────

export interface ProductScoringInput {
  product: Product;
  semanticSimilarity: number;  // from match_products RPC
  userProfile: HairProfile;
  likedProductIds?: string[];
  dislikedProductIds?: string[];
  recentlyRecommendedIds?: string[];
}

export function scoreProduct(input: ProductScoringInput): number {
  const { product, semanticSimilarity, userProfile } = input;
  const w = PRODUCT_WEIGHTS;

  // 1. Semantic similarity (0-1)
  const similarity = Math.min(1, Math.max(0, semanticSimilarity));

  // 2. Hair type match (0 or 1)
  const hairTypeMatch = (product.suitable_hair_types ?? []).includes(userProfile.hair_type ?? '')
    ? 1 : 0;

  // 3. Concern overlap (0-1)
  const userConcerns = userProfile.concerns ?? [];
  const productConcerns = product.suitable_concerns ?? [];
  const concernOverlap = userConcerns.length > 0
    ? userConcerns.filter(c => productConcerns.includes(c)).length / userConcerns.length
    : 0.5;  // no concerns = neutral

  // 4. Authority weight (hardcoded to 1.0 for products from product table)
  const authority = 1.0;

  // 5. User preference (-1 disliked, 0 unknown, +1 liked -> normalize to 0-1)
  const liked = input.likedProductIds ?? [];
  const disliked = input.dislikedProductIds ?? [];
  const prefSignal = liked.includes(product.id) ? 1 :
    disliked.includes(product.id) ? -1 : 0;
  const userPreference = (prefSignal + 1) / 2;  // -1->0, 0->0.5, 1->1

  // 6. Novelty (bonus for not recently recommended)
  const recentlyRecommended = input.recentlyRecommendedIds ?? [];
  const novelty = recentlyRecommended.includes(product.id) ? 0 : 1;

  // 7. Price relevance (placeholder — 0.5 neutral for now)
  const priceRelevance = 0.5;

  return (
    similarity * w.semanticSimilarity +
    hairTypeMatch * w.hairTypeMatch +
    concernOverlap * w.concernOverlap +
    authority * w.authorityWeight +
    userPreference * w.userPreference +
    novelty * w.novelty +
    priceRelevance * w.priceRelevance
  );
}

// ── Batch Scoring & Ranking ────────────────────────────

export function rankChunks(
  chunks: RetrievedChunk[],
  userProfile: HairProfile,
): RetrievedChunk[] {
  const scored = chunks.map(chunk => ({
    chunk,
    score: scoreChunk({ chunk, userProfile }),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Deduplicate (preserve existing logic from retriever.ts)
  const deduped = deduplicateChunks(scored.map(s => s.chunk));

  return deduped;
}

export function rankProducts(
  products: Array<Product & { similarity?: number }>,
  userProfile: HairProfile,
  likedProductIds?: string[],
  dislikedProductIds?: string[],
  recentlyRecommendedIds?: string[],
): Product[] {
  const scored = products.map(product => ({
    product,
    score: scoreProduct({
      product,
      semanticSimilarity: product.similarity ?? 0.5,
      userProfile,
      likedProductIds,
      dislikedProductIds,
      recentlyRecommendedIds,
    }),
  }));

  scored.sort((a, b) => b.score - a.score);
  return scored.map(s => s.product);
}

// ── Helpers ────────────────────────────────────────────

function getAuthorityWeight(sourceType: string): number {
  const weights: Record<string, number> = {
    book: 1.4,
    product_list: 1.4,
    qa: 1.0,
    narrative: 1.0,
    community_qa: 1.0,
    transcript: 0.8,
    live_call: 0.8,
    product_links: 0.8,
  };
  return weights[sourceType] ?? 1.0;
}

function deduplicateChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  // Preserve existing deduplication logic from retriever.ts
  // Drop chunks where >80% of shorter chunk's text appears as
  // contiguous substring in a higher-ranked chunk
  const result: RetrievedChunk[] = [];

  for (const chunk of chunks) {
    const isDuplicate = result.some(existing => {
      const shorter = chunk.content.length < existing.content.length ? chunk : existing;
      const longer = chunk.content.length < existing.content.length ? existing : chunk;
      const overlapThreshold = shorter.content.length * 0.8;

      // Check if 80%+ of shorter appears in longer
      let matchLength = 0;
      for (let i = 0; i <= longer.content.length - shorter.content.length; i++) {
        let j = 0;
        while (j < shorter.content.length && longer.content[i + j] === shorter.content[j]) {
          j++;
        }
        matchLength = Math.max(matchLength, j);
      }
      return matchLength >= overlapThreshold;
    });

    if (!isDuplicate) {
      result.push(chunk);
    }
  }

  return result;
}
```

## Files to Modify

### `src/lib/rag/retriever.ts`

**Replace `rerankChunks()`** with call to `rankChunks()` from scorer:

```typescript
// BEFORE (in retrieveContext):
const reranked = rerankChunks(chunks, hairProfile, count);

// AFTER:
import { rankChunks } from './scorer';
const ranked = rankChunks(chunks, hairProfile);
const reranked = ranked.slice(0, count);
```

Remove the old `rerankChunks()` function entirely.

### `src/lib/rag/product-matcher.ts`

After `matchProducts()` fetches products from the RPC, re-score them locally:

```typescript
import { rankProducts } from './scorer';

// After RPC returns products:
const ranked = rankProducts(
  rpcProducts,
  userProfile,
  userProfile.liked_products,    // from WS4, empty array until then
  userProfile.disliked_products, // from WS4, empty array until then
  [],                             // recentlyRecommendedIds — future enhancement
);
return ranked.slice(0, count);
```

### `src/lib/rag/synthesizer.ts`

Update `formatProducts()` to indicate pre-ranked order:

```typescript
function formatProducts(products: Product[]): string {
  if (!products.length) return '';

  let text = '## Produktempfehlungen (in Reihenfolge der Relevanz)\n\n';
  products.forEach((product, index) => {
    text += `${index + 1}. **${product.name}**`;
    if (product.brand) text += ` von ${product.brand}`;
    text += '\n';
    if (product.short_description) text += `   ${product.short_description}\n`;
    if (product.tom_take) text += `   Tom's Take: ${product.tom_take}\n`;
    if (product.price_eur) text += `   Preis: ${product.price_eur} EUR\n`;
    text += '\n';
  });

  return text;
}
```

### `src/lib/rag/prompts.ts`

Add to the `SYSTEM_PROMPT` template, in the instructions section:

```
## Produktempfehlungen

Die Produkte in der Kontextsektion sind bereits fuer diesen Nutzer bewertet und in der besten Reihenfolge sortiert.
Praesente sie in dieser Reihenfolge. Aendere die Reihenfolge NICHT.
Du darfst ergaenzen, warum ein Produkt besonders gut passt, aber die Auswahl und Reihenfolge ist vorgegeben.
Empfehle NUR Produkte aus der bereitgestellten Liste — erfinde keine anderen.
```

## Verification

### Unit Tests (create `tests/unit/scorer.test.ts`)

1. **Determinism:** Call `scoreChunk()` with identical inputs 100 times — always returns exact same float
2. **Determinism:** Call `scoreProduct()` with identical inputs 100 times — always returns exact same float
3. **Texture match boost:** Chunk with matching texture scores higher than identical chunk without match
4. **Concern overlap:** Product addressing 2/3 user concerns scores higher than product addressing 1/3
5. **User preference:** Liked product scores higher than unknown; disliked scores lower
6. **Authority tiers:** Book chunk scores higher than transcript chunk (same similarity)
7. **Ranking stability:** Given same input array, `rankChunks()` always returns same order

### Integration Test

1. Run the pipeline with a fixed user profile + fixed query
2. Record the product ranking
3. Run again 5 times
4. Verify: identical ranking every time

### Comparison Test

1. Run existing QA fixtures through old `rerankChunks()` and new `rankChunks()`
2. Compare: does the new scorer produce more relevant top-5 chunks?
3. Log both rankings for manual review

## Dependencies

- **WS1 (optional):** If WS1 is implemented first, the scorer receives pre-filtered candidates. If not, the scorer runs on the full candidate set (still works, just less optimal).
- **WS4 (optional):** When WS4 adds `liked_products`/`disliked_products` to profiles, the scorer automatically uses them. Until then, these default to empty arrays.

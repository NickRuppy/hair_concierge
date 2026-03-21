# Workstream 6: Knowledge Graph (Relational in Postgres)

> **Standalone implementation spec.** This file contains everything needed to implement WS6 independently.

## Goal

Enable multi-hop reasoning for complex queries by modeling product-concern-ingredient-texture relationships as a graph in plain Postgres tables. This augments (not replaces) the existing vector search with structural reasoning.

**Example:** "What should I use for dry, color-treated, fine hair?"
- Vector search finds chunks mentioning 1-2 of these constraints
- Graph traversal finds products connected to ALL three via explicit edges
- Combined results are more relevant than either alone

## Background: Why Vector Search Alone Falls Short

Current vector search in `match_content_chunks` finds semantically similar content but cannot reason about multi-constraint intersections:

| Query | Vector Search | Graph Traversal |
|-------|--------------|-----------------|
| "Shampoo fuer feines Haar" | Finds chunks mentioning fine hair shampoos | Finds products with `suitable_for -> fein` edge |
| "Sulfatfrei + coloriert + fein" | Finds chunks mentioning some of these | Intersects: `safe_for -> coloriert` AND `suitable_for -> fein` AND NOT `contains -> sulfate` |
| "Alternative zu Olaplex" | Finds chunks mentioning Olaplex | Traverses `alternative_to -> Olaplex` edges |
| "Was passt zu meinem Conditioner?" | Limited — no product relationship awareness | Traverses `part_of_routine -> after` edges |

## Database Migration

**File:** `supabase/migrations/20260217000004_create_knowledge_graph.sql`

```sql
-- ── Graph Nodes ────────────────────────────────────────

CREATE TABLE graph_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_type text NOT NULL CHECK (node_type IN (
    'product',          -- Maps to products table
    'concern',          -- Hair concerns (Trockenheit, Frizz, etc.)
    'ingredient',       -- Active ingredients
    'hair_texture',     -- fein, mittel, dick
    'hair_type',        -- glatt, wellig, lockig, kraus
    'routine_step',     -- Reinigung, Pflege, Styling, Behandlung
    'category',         -- Product categories (Shampoo, Conditioner, etc.)
    'treatment'         -- Chemical treatments (gefaerbt, blondiert, etc.)
  )),
  name text NOT NULL,
  name_normalized text GENERATED ALWAYS AS (lower(trim(name))) STORED,
  external_id uuid,                -- Links to products.id for product nodes
  properties jsonb DEFAULT '{}',   -- Additional attributes
  created_at timestamptz DEFAULT now(),
  UNIQUE(node_type, name_normalized)
);

-- ── Graph Edges ────────────────────────────────────────

CREATE TABLE graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  edge_type text NOT NULL CHECK (edge_type IN (
    'addresses',         -- product -> concern (this product helps with this concern)
    'suitable_for',      -- product -> hair_texture / hair_type
    'contains',          -- product -> ingredient
    'conflicts_with',    -- ingredient -> treatment (e.g., sulfate conflicts with color)
    'part_of_routine',   -- product -> routine_step (e.g., shampoo -> Reinigung)
    'recommended_by',    -- product -> (implicit expert node, weight = confidence)
    'alternative_to',    -- product -> product
    'safe_for',          -- product -> treatment (safe for color-treated, etc.)
    'helps_with',        -- ingredient -> concern
    'belongs_to'         -- product -> category
  )),
  weight float DEFAULT 1.0,        -- Confidence/strength of relationship
  source_evidence text,             -- Where this relationship comes from
  properties jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(source_id, target_id, edge_type)
);

-- ── Indexes ────────────────────────────────────────────

CREATE INDEX idx_graph_nodes_type ON graph_nodes(node_type);
CREATE INDEX idx_graph_nodes_name ON graph_nodes(name_normalized);
CREATE INDEX idx_graph_nodes_external ON graph_nodes(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_graph_edges_source ON graph_edges(source_id);
CREATE INDEX idx_graph_edges_target ON graph_edges(target_id);
CREATE INDEX idx_graph_edges_type ON graph_edges(edge_type);

-- ── Multi-hop Query Functions ──────────────────────────

-- Find products matching multiple constraints via graph traversal
CREATE OR REPLACE FUNCTION find_products_by_constraints(
  p_hair_texture text DEFAULT NULL,
  p_hair_type text DEFAULT NULL,
  p_concerns text[] DEFAULT NULL,
  p_treatments text[] DEFAULT NULL,
  p_max_results int DEFAULT 10
)
RETURNS TABLE (
  product_node_id uuid,
  product_external_id uuid,
  product_name text,
  match_score float,
  matched_constraints text[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  total_constraints int := 0;
BEGIN
  -- Count active constraints
  IF p_hair_texture IS NOT NULL THEN total_constraints := total_constraints + 1; END IF;
  IF p_hair_type IS NOT NULL THEN total_constraints := total_constraints + 1; END IF;
  IF p_concerns IS NOT NULL THEN total_constraints := total_constraints + array_length(p_concerns, 1); END IF;
  IF p_treatments IS NOT NULL THEN total_constraints := total_constraints + array_length(p_treatments, 1); END IF;

  IF total_constraints = 0 THEN
    RETURN;  -- No constraints = no results
  END IF;

  RETURN QUERY
  WITH product_nodes AS (
    SELECT gn.id, gn.external_id, gn.name
    FROM graph_nodes gn
    WHERE gn.node_type = 'product'
  ),
  constraint_matches AS (
    -- Hair texture match
    SELECT pn.id AS product_id, 'texture:' || p_hair_texture AS constraint_key
    FROM product_nodes pn
    JOIN graph_edges ge ON ge.source_id = pn.id AND ge.edge_type = 'suitable_for'
    JOIN graph_nodes target ON ge.target_id = target.id
      AND target.node_type = 'hair_texture'
      AND target.name_normalized = lower(p_hair_texture)
    WHERE p_hair_texture IS NOT NULL

    UNION ALL

    -- Hair type match
    SELECT pn.id, 'type:' || p_hair_type
    FROM product_nodes pn
    JOIN graph_edges ge ON ge.source_id = pn.id AND ge.edge_type = 'suitable_for'
    JOIN graph_nodes target ON ge.target_id = target.id
      AND target.node_type = 'hair_type'
      AND target.name_normalized = lower(p_hair_type)
    WHERE p_hair_type IS NOT NULL

    UNION ALL

    -- Concern matches
    SELECT pn.id, 'concern:' || c.concern
    FROM product_nodes pn
    JOIN graph_edges ge ON ge.source_id = pn.id AND ge.edge_type = 'addresses'
    JOIN graph_nodes target ON ge.target_id = target.id AND target.node_type = 'concern'
    CROSS JOIN unnest(p_concerns) AS c(concern)
    WHERE target.name_normalized = lower(c.concern)
      AND p_concerns IS NOT NULL

    UNION ALL

    -- Treatment safety matches
    SELECT pn.id, 'safe_for:' || t.treatment
    FROM product_nodes pn
    JOIN graph_edges ge ON ge.source_id = pn.id AND ge.edge_type = 'safe_for'
    JOIN graph_nodes target ON ge.target_id = target.id AND target.node_type = 'treatment'
    CROSS JOIN unnest(p_treatments) AS t(treatment)
    WHERE target.name_normalized = lower(t.treatment)
      AND p_treatments IS NOT NULL
  ),
  scored AS (
    SELECT
      pn.id AS product_node_id,
      pn.external_id AS product_external_id,
      pn.name AS product_name,
      count(cm.constraint_key)::float / total_constraints::float AS match_score,
      array_agg(DISTINCT cm.constraint_key) AS matched_constraints
    FROM product_nodes pn
    LEFT JOIN constraint_matches cm ON cm.product_id = pn.id
    GROUP BY pn.id, pn.external_id, pn.name
    HAVING count(cm.constraint_key) > 0
  )
  SELECT s.product_node_id, s.product_external_id, s.product_name,
         s.match_score, s.matched_constraints
  FROM scored s
  ORDER BY s.match_score DESC, s.product_name ASC
  LIMIT p_max_results;
END;
$$;
```

## Files to Create

### `src/lib/rag/knowledge-graph.ts`

```typescript
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { HairProfile, Product, IntentType } from '@/lib/types';

// ── Types ──────────────────────────────────────────────

interface GraphProduct {
  productNodeId: string;
  productExternalId: string | null;
  productName: string;
  matchScore: number;
  matchedConstraints: string[];
}

// ── Query Functions ────────────────────────────────────

/**
 * Find products matching user profile constraints via graph traversal.
 * Returns products sorted by how many constraints they satisfy.
 */
export async function findProductsByProfile(
  profile: HairProfile,
  maxResults: number = 10,
): Promise<GraphProduct[]> {
  const { data, error } = await supabaseAdmin.rpc('find_products_by_constraints', {
    p_hair_texture: profile.hair_texture,
    p_hair_type: profile.hair_type,
    p_concerns: profile.concerns?.length ? profile.concerns : null,
    p_treatments: profile.chemical_treatment?.length ? profile.chemical_treatment : null,
    p_max_results: maxResults,
  });

  if (error) {
    console.error('[knowledge-graph] Query failed:', error);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    productNodeId: row.product_node_id,
    productExternalId: row.product_external_id,
    productName: row.product_name,
    matchScore: row.match_score,
    matchedConstraints: row.matched_constraints,
  }));
}

/**
 * Find products that conflict with user's treatment history.
 * E.g., products containing sulfates when user is color-treated.
 */
export async function findConflictingProducts(
  profile: HairProfile,
): Promise<string[]> {
  if (!profile.chemical_treatment?.length) return [];

  const { data } = await supabaseAdmin
    .from('graph_edges')
    .select(`
      source:graph_nodes!graph_edges_source_id_fkey(name, external_id),
      target:graph_nodes!graph_edges_target_id_fkey(name)
    `)
    .eq('edge_type', 'conflicts_with')
    .in('target.name_normalized', profile.chemical_treatment.map(t => t.toLowerCase()));

  // Collect product IDs that contain conflicting ingredients
  const conflictingProductIds: string[] = [];
  // This requires a two-hop query — simplified for now
  // Full implementation: product -> contains -> ingredient -> conflicts_with -> treatment

  return conflictingProductIds;
}

/**
 * Find alternative products (for when a user dislikes a specific product).
 */
export async function findAlternatives(
  productName: string,
  maxResults: number = 3,
): Promise<GraphProduct[]> {
  const { data: sourceNode } = await supabaseAdmin
    .from('graph_nodes')
    .select('id')
    .eq('node_type', 'product')
    .eq('name_normalized', productName.toLowerCase().trim())
    .single();

  if (!sourceNode) return [];

  const { data: alternatives } = await supabaseAdmin
    .from('graph_edges')
    .select(`
      target:graph_nodes!graph_edges_target_id_fkey(id, name, external_id)
    `)
    .eq('source_id', sourceNode.id)
    .eq('edge_type', 'alternative_to')
    .limit(maxResults);

  return (alternatives ?? []).map((row: any) => ({
    productNodeId: row.target.id,
    productExternalId: row.target.external_id,
    productName: row.target.name,
    matchScore: 1.0,
    matchedConstraints: ['alternative'],
  }));
}
```

### `scripts/populate-knowledge-graph.ts`

```typescript
/**
 * Populates the knowledge graph from existing data sources:
 * 1. Products table -> product nodes + edges to textures, types, concerns
 * 2. Content chunks -> extract additional relationships via LLM
 *
 * Run: npx tsx scripts/populate-knowledge-graph.ts
 */

import { supabaseAdmin } from '../src/lib/supabase/admin';

async function main() {
  console.log('Populating knowledge graph...');

  // Step 1: Create texture nodes
  const textures = ['fein', 'mittel', 'dick'];
  for (const t of textures) {
    await upsertNode('hair_texture', t);
  }

  // Step 2: Create hair type nodes
  const types = ['glatt', 'wellig', 'lockig', 'kraus'];
  for (const t of types) {
    await upsertNode('hair_type', t);
  }

  // Step 3: Create concern nodes
  const concerns = [
    'Haarausfall', 'Schuppen', 'Trockenheit', 'Fettige Kopfhaut',
    'Haarschaeden', 'Coloriert', 'Spliss', 'Frizz', 'Duenner werdendes Haar',
  ];
  for (const c of concerns) {
    await upsertNode('concern', c);
  }

  // Step 4: Create treatment nodes
  const treatments = ['natur', 'gefaerbt', 'blondiert'];
  for (const t of treatments) {
    await upsertNode('treatment', t);
  }

  // Step 5: Create routine step nodes
  const steps = ['Reinigung', 'Pflege', 'Styling', 'Behandlung'];
  for (const s of steps) {
    await upsertNode('routine_step', s);
  }

  // Step 6: Load products and create product nodes + edges
  const { data: products } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('is_active', true);

  for (const product of products ?? []) {
    const productNodeId = await upsertNode('product', product.name, product.id);

    // Create category node and edge
    if (product.category) {
      const categoryNodeId = await upsertNode('category', product.category);
      await upsertEdge(productNodeId, categoryNodeId, 'belongs_to');
    }

    // Create edges to suitable hair types
    for (const ht of product.suitable_hair_types ?? []) {
      const htNodeId = await findNode('hair_type', ht);
      if (htNodeId) await upsertEdge(productNodeId, htNodeId, 'suitable_for');
    }

    // Create edges to suitable concerns
    for (const concern of product.suitable_concerns ?? []) {
      const concernNodeId = await findNode('concern', concern);
      if (concernNodeId) await upsertEdge(productNodeId, concernNodeId, 'addresses');
    }

    // Infer texture suitability from hair types
    // (This is a simplification — real mapping may be more nuanced)
    for (const ht of product.suitable_hair_types ?? []) {
      // Map hair types to typical textures
      const textureMap: Record<string, string[]> = {
        glatt: ['fein', 'mittel'],
        wellig: ['mittel'],
        lockig: ['mittel', 'dick'],
        kraus: ['dick'],
      };
      for (const texture of textureMap[ht] ?? []) {
        const textureNodeId = await findNode('hair_texture', texture);
        if (textureNodeId) await upsertEdge(productNodeId, textureNodeId, 'suitable_for');
      }
    }

    console.log(`  Created product node: ${product.name} (${product.suitable_hair_types?.length ?? 0} types, ${product.suitable_concerns?.length ?? 0} concerns)`);
  }

  console.log('Knowledge graph population complete.');
}

// ── Helper Functions ───────────────────────────────────

async function upsertNode(nodeType: string, name: string, externalId?: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('graph_nodes')
    .upsert({
      node_type: nodeType,
      name,
      external_id: externalId ?? null,
    }, {
      onConflict: 'node_type,name_normalized',
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to upsert node ${nodeType}:${name}: ${error.message}`);
  return data!.id;
}

async function findNode(nodeType: string, name: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('graph_nodes')
    .select('id')
    .eq('node_type', nodeType)
    .eq('name_normalized', name.toLowerCase().trim())
    .single();

  return data?.id ?? null;
}

async function upsertEdge(sourceId: string, targetId: string, edgeType: string, weight: number = 1.0): Promise<void> {
  await supabaseAdmin
    .from('graph_edges')
    .upsert({
      source_id: sourceId,
      target_id: targetId,
      edge_type: edgeType,
      weight,
    }, {
      onConflict: 'source_id,target_id,edge_type',
    });
}

main().catch(console.error);
```

## Files to Modify

### `src/lib/rag/retriever.ts`

Augment vector search with graph results for product intents:

```typescript
import { findProductsByProfile } from './knowledge-graph';

// In retrieveContext(), after vector search:
const GRAPH_AUGMENTED_INTENTS: IntentType[] = ['product_recommendation', 'routine_help'];

if (GRAPH_AUGMENTED_INTENTS.includes(intent) && hairProfile) {
  const graphProducts = await findProductsByProfile(hairProfile, 10);

  // Merge graph results with vector results
  // Graph products that aren't already in vector results get added with a base similarity
  for (const gp of graphProducts) {
    if (gp.productExternalId && !vectorResults.some(v => v.id === gp.productExternalId)) {
      // Create a synthetic chunk or product entry from graph result
      // This integration point depends on whether we're augmenting chunks or products
    }
  }
}
```

### `src/lib/rag/product-matcher.ts`

Merge graph-discovered products with vector-matched products:

```typescript
import { findProductsByProfile } from './knowledge-graph';

// After matchProducts() RPC:
const graphProducts = await findProductsByProfile(hairProfile, 5);

// Fetch full product records for graph-discovered products not already in RPC results
const newProductIds = graphProducts
  .filter(gp => gp.productExternalId && !rpcProducts.some(p => p.id === gp.productExternalId))
  .map(gp => gp.productExternalId!);

if (newProductIds.length > 0) {
  const { data: additionalProducts } = await supabaseAdmin
    .from('products')
    .select('*')
    .in('id', newProductIds);

  // Add graph-discovered products with their graph match score as a synthetic similarity
  for (const product of additionalProducts ?? []) {
    const graphMatch = graphProducts.find(gp => gp.productExternalId === product.id);
    rpcProducts.push({
      ...product,
      similarity: graphMatch?.matchScore ?? 0.5,
    });
  }
}
```

## Data Population Strategy

### Phase 1: Automated from Products Table
Run `scripts/populate-knowledge-graph.ts` to create:
- Product nodes linked to existing products
- Texture, type, concern, treatment, category nodes
- Edges from products to their attributes

### Phase 2: Extract from Book/Transcripts (Future)
Use GPT-4o to extract relationships from Tom's book and transcripts:
- "Tom recommends Product X for Concern Y" -> `recommended_by` edge
- "Ingredient A helps with Concern B" -> `helps_with` edge
- "Product X can be used instead of Product Y" -> `alternative_to` edge

### Phase 3: Community Feedback (Future)
Extract from community Q&A:
- User-reported positive outcomes -> strengthen `addresses` edges
- User-reported negative outcomes -> create `conflicts_with` edges

## Verification

### Unit Tests

1. `findProductsByProfile()` returns products matching fein + Trockenheit
2. Products matching ALL constraints score higher than partial matches
3. `findAlternatives()` returns products with `alternative_to` edges
4. Empty profile returns empty results (no constraints = no matches)

### Integration Tests

1. Populate graph from test data
2. Query with `{hair_texture: "fein", concerns: ["Trockenheit", "Frizz"]}`
3. Verify returned products are genuinely suitable
4. Compare with vector-only results — graph should find additional relevant products

### Data Validation

After running populate script:
- Every active product has a corresponding graph node
- Every product with `suitable_hair_types` has edges to those type nodes
- Every product with `suitable_concerns` has edges to those concern nodes
- No orphaned edges (all reference valid nodes)

## Dependencies

- **WS1 (recommended):** Rule engine can use graph relationships for more sophisticated filtering
- **WS2 (recommended):** Scorer can incorporate `match_score` from graph traversal as an additional factor
- **Independent otherwise:** Graph population and queries work without other workstreams

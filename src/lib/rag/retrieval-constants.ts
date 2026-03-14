/**
 * Retrieval pipeline constants — Phase 1 Hybrid Retrieval.
 * All tunable parameters live here, not scattered across files.
 * Ref: PRD NFRs, Section 8
 */

// ── RRF Fusion ────────────────────────────────────────────────────────────────
/** Reciprocal Rank Fusion smoothing constant */
export const RRF_K = 60

// ── Candidate counts ──────────────────────────────────────────────────────────
/** Dense retrieval candidate count per subquery */
export const DENSE_CANDIDATE_COUNT = 20

/** Lexical retrieval candidate count per subquery */
export const LEXICAL_CANDIDATE_COUNT = 20

/** Dense retrieval similarity threshold */
export const DENSE_MATCH_THRESHOLD = 0.65

/** Default number of final context chunks to return */
export const DEFAULT_FINAL_COUNT = 5

// ── Reranker ──────────────────────────────────────────────────────────────────
/** Max candidates sent to the cross-encoder reranker */
export const RERANK_TOP_N = 12

/** Reranker API timeout in milliseconds */
export const RERANK_TIMEOUT_MS = 5000

// ── Subquery decomposition ────────────────────────────────────────────────────
/** Min word count to trigger subquery decomposition (skip for short queries) */
export const SUBQUERY_MIN_WORDS = 8

/** Max subqueries to generate from a complex query */
export const SUBQUERY_MAX_COUNT = 4

// ── Authority weighting tiers (must match SQL functions) ──────────────────────
export const AUTHORITY_WEIGHTS: Record<string, number> = {
  book: 1.4,
  product_list: 1.4,
  qa: 1.0,
  narrative: 1.0,
  community_qa: 1.0,
  transcript: 0.8,
  live_call: 0.8,
  product_links: 0.8,
}

/** Default authority weight for unknown source types */
export const DEFAULT_AUTHORITY_WEIGHT = 1.0

// ── Profile boost multipliers ─────────────────────────────────────────────────
/** Boost for chunks matching user's thickness */
export const THICKNESS_MATCH_BOOST = 1.15

/** Boost for community_qa chunks with product mentions */
export const COMMUNITY_QA_PRODUCT_BOOST = 1.25

// ── Router (Phase 2) ────────────────────────────────────────────────────────
/** Minimum confidence for the router to proceed without clarification */
export const ROUTER_CONFIDENCE_THRESHOLD = 0.72

/** Minimum filled slots required for product/routine intents */
export const ROUTER_MIN_SLOTS_PRODUCT = 2

/** Maximum clarification rounds before forcing a best-effort answer */
export const ROUTER_MAX_CLARIFICATION_ROUNDS = 2

/** Intents where product matching is relevant */
export const PRODUCT_INTENTS: string[] = [
  "product_recommendation",
  "routine_help",
  "hair_care_advice",
]

/** Key information slots checked for completeness */
export const ROUTER_SLOT_KEYS = [
  "problem",
  "duration",
  "products_tried",
  "routine",
  "special_circumstances",
] as const

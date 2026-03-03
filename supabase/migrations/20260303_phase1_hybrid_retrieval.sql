-- Phase 1: Hybrid Retrieval — tsvector column, GIN index, lexical search function
-- Ref: PRD Section 7, FR-1, FR-2, FR-4

-- ── 1. Add tsvector column (generated from content) ───────────────────────────

ALTER TABLE content_chunks
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      to_tsvector('german', coalesce(content, ''))
    ) STORED;

-- ── 2. GIN index for fast full-text search ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_content_chunks_search_vector
  ON content_chunks USING gin(search_vector);

-- ── 3. Lexical search function (BM25-style FTS with authority weighting) ──────
-- Mirrors match_content_chunks signature/weighting but uses ts_rank_cd instead
-- of cosine similarity. Authority tiers are identical.

CREATE OR REPLACE FUNCTION public.match_content_chunks_lexical(
    query_text text,
    match_count int DEFAULT 20,
    source_filter text DEFAULT NULL,
    metadata_filter jsonb DEFAULT NULL,
    source_types text[] DEFAULT NULL
)
RETURNS TABLE (
    id              uuid,
    source_type     text,
    source_name     text,
    chunk_index     int,
    content         text,
    metadata        jsonb,
    rank            float,
    weighted_rank   float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    tsq tsquery;
BEGIN
    -- Build tsquery from plain text using German config
    -- plainto_tsquery handles multi-word input safely
    tsq := plainto_tsquery('german', query_text);

    -- If the query produces an empty tsquery, try simple config as fallback
    -- (handles INCI names, brand names, English terms that German dict strips)
    IF tsq = ''::tsquery THEN
        tsq := plainto_tsquery('simple', query_text);
    END IF;

    -- Still empty → no results
    IF tsq = ''::tsquery THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        cc.id,
        cc.source_type,
        cc.source_name,
        cc.chunk_index,
        cc.content,
        cc.metadata,
        ts_rank_cd(cc.search_vector, tsq, 1)::float AS rank,
        (
            ts_rank_cd(cc.search_vector, tsq, 1)
            * CASE cc.source_type
                WHEN 'book'          THEN 1.4
                WHEN 'product_list'  THEN 1.4
                WHEN 'qa'            THEN 1.0
                WHEN 'narrative'     THEN 1.0
                WHEN 'community_qa'  THEN 1.0
                WHEN 'transcript'    THEN 0.8
                WHEN 'live_call'     THEN 0.8
                WHEN 'product_links' THEN 0.8
                ELSE 1.0
              END
        )::float AS weighted_rank
    FROM content_chunks cc
    WHERE
        cc.search_vector @@ tsq
        AND (source_filter IS NULL OR cc.source_type = source_filter)
        AND (metadata_filter IS NULL OR cc.metadata @> metadata_filter)
        AND (source_types IS NULL OR cc.source_type = ANY(source_types))
    ORDER BY weighted_rank DESC
    LIMIT match_count;
END;
$$;

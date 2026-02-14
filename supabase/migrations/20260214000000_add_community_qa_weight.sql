-- Add community_qa (1.0x) to authority weighting in match_content_chunks.
-- Same tier as qa and narrative — direct personalized advice from Tom.

-- Update source_type constraint to allow community_qa
ALTER TABLE content_chunks DROP CONSTRAINT IF EXISTS content_chunks_source_type_check;
ALTER TABLE content_chunks ADD CONSTRAINT content_chunks_source_type_check
  CHECK (source_type IN ('book','transcript','qa','live_call','product_links','narrative','product_list','community_qa'));

CREATE OR REPLACE FUNCTION public.match_content_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5,
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
    similarity      float,
    weighted_similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cc.id,
        cc.source_type,
        cc.source_name,
        cc.chunk_index,
        cc.content,
        cc.metadata,
        (1 - (cc.embedding <=> query_embedding))::float AS similarity,
        (
            (1 - (cc.embedding <=> query_embedding))
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
        )::float AS weighted_similarity
    FROM content_chunks cc
    WHERE
        cc.embedding IS NOT NULL
        AND (1 - (cc.embedding <=> query_embedding)) >= match_threshold
        AND (source_filter IS NULL OR cc.source_type = source_filter)
        AND (metadata_filter IS NULL OR cc.metadata @> metadata_filter)
        AND (source_types IS NULL OR cc.source_type = ANY(source_types))
    ORDER BY weighted_similarity DESC
    LIMIT match_count;
END;
$$;

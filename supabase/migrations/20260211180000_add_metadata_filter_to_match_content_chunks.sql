-- Add metadata_filter parameter to match_content_chunks for hybrid search.
-- Uses JSONB @> (contains) operator to pre-filter chunks by metadata
-- (e.g. hair_texture, concern, category) before vector similarity ranking.

CREATE OR REPLACE FUNCTION public.match_content_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5,
    source_filter text DEFAULT NULL,
    metadata_filter jsonb DEFAULT NULL
)
RETURNS TABLE (
    id            uuid,
    source_type   text,
    source_name   text,
    chunk_index   int,
    content       text,
    metadata      jsonb,
    similarity    float
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
        (1 - (cc.embedding <=> query_embedding))::float AS similarity
    FROM content_chunks cc
    WHERE
        cc.embedding IS NOT NULL
        AND (1 - (cc.embedding <=> query_embedding)) >= match_threshold
        AND (source_filter IS NULL OR cc.source_type = source_filter)
        AND (metadata_filter IS NULL OR cc.metadata @> metadata_filter)
    ORDER BY cc.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;

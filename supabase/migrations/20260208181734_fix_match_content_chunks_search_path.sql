-- Fix match_content_chunks: add 'extensions' to search_path so pgvector
-- operators (<=> cosine distance) resolve correctly on Supabase-hosted
-- instances where the vector extension lives in the extensions schema.

CREATE OR REPLACE FUNCTION public.match_content_chunks(
    query_embedding vector(1536),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5,
    source_filter text DEFAULT NULL
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
    ORDER BY cc.embedding <=> query_embedding ASC
    LIMIT match_count;
END;
$$;

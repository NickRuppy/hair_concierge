ALTER TABLE content_chunks DROP CONSTRAINT IF EXISTS content_chunks_source_type_check;

ALTER TABLE content_chunks ADD CONSTRAINT content_chunks_source_type_check
  CHECK (source_type IN ('book','transcript','qa','live_call','product_links','narrative','product_list'));

CREATE INDEX IF NOT EXISTS idx_content_chunks_source_name ON content_chunks (source_name);

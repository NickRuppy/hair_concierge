-- Backfill products.market_segment for every currently recommended product from the approved
-- brand list (plans/profi-tier-baseline/market-segment-proposal.csv, approved by Nick 2026-10-09)
-- and add the "recommended => segment" rule. Brands match case-insensitively with typographic
-- apostrophes folded; the last five rows are catalog spellings the list groups under one brand
-- (Balea Med, Garnier Fructis, Garnier Wahre Schätze, It’s, Schwarzkopf taft).
--
-- The CHECK is added (and validated) only after every recommended row carries a segment. From now
-- on a writer that recommends a product sets market_segment in the same statement.
-- Rollback: ALTER TABLE public.products DROP CONSTRAINT products_recommended_requires_market_segment;
-- the values themselves are harmless to keep.
--
-- The timestamp trigger is paused for this one UPDATE: Bondbuilder admission/promotion receipts
-- compare whole serialized product rows (market_segment excluded, updated_at included), so a
-- classification-only write must not move updated_at. Other product triggers stay active.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid = 'public.products'::pg_catalog.regclass AND tgname = 'set_updated_at_products'
  ) THEN
    ALTER TABLE public.products DISABLE TRIGGER set_updated_at_products;
  END IF;
END $$;

WITH segment_by_brand(brand_key, segment) AS (
  VALUES
    ('alcina', 'professional'),
    ('allgäuer ölmühle', 'drugstore'),
    ('alterra', 'drugstore'),
    ('alverde', 'drugstore'),
    ('authentic beauty concept', 'professional'),
    ('aveda', 'professional'),
    ('balea', 'drugstore'),
    ('bali curls', 'drugstore'),
    ('batiste', 'drugstore'),
    ('benecos', 'drugstore'),
    ('biogourmet', 'drugstore'),
    ('cantu', 'drugstore'),
    ('color wow', 'professional'),
    ('curlsmith', 'professional'),
    ('dejan garz', 'drugstore'),
    ('dmbio', 'drugstore'),
    ('dr. scheller', 'drugstore'),
    ('epres', 'professional'),
    ('eucerin', 'drugstore'),
    ('evo', 'professional'),
    ('fructis', 'drugstore'),
    ('garnier', 'drugstore'),
    ('gliss', 'drugstore'),
    ('got2b', 'drugstore'),
    ('guhl', 'drugstore'),
    ('hair biology', 'drugstore'),
    ('hask', 'drugstore'),
    ('head & shoulders', 'drugstore'),
    ('herbal essences', 'drugstore'),
    ('innersense', 'professional'),
    ('isana', 'drugstore'),
    ('it''s a 10', 'professional'),
    ('jean&len', 'drugstore'),
    ('k18', 'professional'),
    ('kevin murphy', 'professional'),
    ('koro', 'drugstore'),
    ('kérastase', 'professional'),
    ('l''oréal paris', 'drugstore'),
    ('langhaarmädchen', 'drugstore'),
    ('lavera', 'drugstore'),
    ('living proof', 'professional'),
    ('l''oréal', 'drugstore'),
    ('maria nila', 'professional'),
    ('monday', 'drugstore'),
    ('monday haircare', 'drugstore'),
    ('moriveda', 'drugstore'),
    ('moroccanoil', 'professional'),
    ('nanoil', 'drugstore'),
    ('nedura', 'drugstore'),
    ('neqi', 'drugstore'),
    ('nivea', 'drugstore'),
    ('nutreeoil', 'drugstore'),
    ('nuxe', 'drugstore'),
    ('ogx', 'drugstore'),
    ('olaplex', 'professional'),
    ('ouai', 'professional'),
    ('pantene', 'drugstore'),
    ('paul mitchell', 'professional'),
    ('pomélo+co', 'drugstore'),
    ('primavera', 'drugstore'),
    ('redken', 'professional'),
    ('salthouse', 'drugstore'),
    ('sante', 'drugstore'),
    ('schaebens', 'drugstore'),
    ('schauma', 'drugstore'),
    ('sebamed', 'drugstore'),
    ('shiseido fino', 'drugstore'),
    ('swiss-o-par', 'drugstore'),
    ('syoss', 'drugstore'),
    ('taft', 'drugstore'),
    ('the ordinary', 'drugstore'),
    ('urban alchemy', 'professional'),
    ('wahre schätze', 'drugstore'),
    ('weleda', 'drugstore'),
    ('wella professionals', 'professional'),
    ('balea med', 'drugstore'),
    ('garnier fructis', 'drugstore'),
    ('garnier wahre schätze', 'drugstore'),
    ('it''s', 'professional'),
    ('schwarzkopf taft', 'drugstore'),
    -- Synthetic local catalog (scripts/mobile/catalog-fixture.ts); no production product uses it.
    ('chaarlie local', 'drugstore')
)
UPDATE public.products AS p
   SET market_segment = s.segment
  FROM segment_by_brand AS s
 WHERE p.is_chaarlie_recommended
   AND p.market_segment IS NULL
   AND lower(replace(btrim(p.brand), '’', '''')) = s.brand_key;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger
     WHERE tgrelid = 'public.products'::pg_catalog.regclass AND tgname = 'set_updated_at_products'
  ) THEN
    ALTER TABLE public.products ENABLE TRIGGER set_updated_at_products;
  END IF;
END $$;

DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(pg_catalog.format('%s (%s)', p.id, coalesce(p.brand, 'no brand')), ', ')
    INTO v_missing
    FROM public.products AS p
   WHERE p.is_chaarlie_recommended AND p.market_segment IS NULL;
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'market_segment_backfill_incomplete' USING DETAIL = v_missing;
  END IF;
END $$;

ALTER TABLE public.products
  ADD CONSTRAINT products_recommended_requires_market_segment
  CHECK (NOT is_chaarlie_recommended OR market_segment IS NOT NULL);

-- Approved availability-only correction for four existing products.
-- Approval: Nick, "Okay sounds good.", after exact four-row preview.
-- Only purchase_link_status and purchase_link_checked_at are assigned.
-- The inspected normal BEFORE UPDATE trigger sets products.updated_at.
-- Exact whole-row hashes guard every field, including embeddings.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $availability_fix$
DECLARE
  target_ids uuid[] := ARRAY['dc8b8d4a-8ca9-452c-8d04-03b785b63275', '517dca50-5d55-4038-ba1d-f9b745708327', '29e36443-93ff-4b62-9cf0-55ad9f89f530', 'cb228f9d-4e46-4302-9a6f-92c393eda1bd']::uuid[];
  expected_full jsonb := '{"29e36443-93ff-4b62-9cf0-55ad9f89f530":"dd9ee8fde07dae5dc17c690066dba9cd","517dca50-5d55-4038-ba1d-f9b745708327":"32de6f2551b1bdff952b6a1c18a6c4c4","cb228f9d-4e46-4302-9a6f-92c393eda1bd":"90cdf761e6c8415b34d405074e296e7f","dc8b8d4a-8ca9-452c-8d04-03b785b63275":"fd795e124c5f4522a30ed6b93fa92e1a"}'::jsonb;
  expected_protected jsonb := '{"29e36443-93ff-4b62-9cf0-55ad9f89f530":"9918823cf5c67659e803d81e27e3bab6","517dca50-5d55-4038-ba1d-f9b745708327":"93eb3bb86750f1704537d84db378c933","cb228f9d-4e46-4302-9a6f-92c393eda1bd":"53356c8798a731be0243a052ac92b408","dc8b8d4a-8ca9-452c-8d04-03b785b63275":"5b2918e77b108257deec4503aca9a630"}'::jsonb;
  expected_related jsonb := '{"product_oil_specs":"61f6ebe5085bceb14749660e87b6057e","product_identifiers":"b98fd55ea68fe71d6049e554660ac1c1","product_oil_eligibility":"ad2837f5b6a2340fe17048bbfeeece9f","product_dry_shampoo_specs":"5213fd71b2c0c05dd512d30a2cdf2803","product_concern_eligibility":"bfd9ced46eade51d21137de94b054b71","product_application_protocols":"a1f737e8d6663ed6f5170710d8ef5b32","product_heat_protectant_specs":"065d1e704215e01445f4aac16b838f51","product_thickness_eligibility":"c4c953e2805e9c1438e2770820bc897a"}'::jsonb;
  actual jsonb;
  other_hash text;
  affected integer;
BEGIN
  PERFORM 1 FROM public.products p
  WHERE p.id = ANY(target_ids) ORDER BY p.id FOR UPDATE;

  SELECT jsonb_object_agg(p.id::text, md5(to_jsonb(p)::text))
  INTO actual FROM public.products p WHERE p.id = ANY(target_ids);
  IF actual IS DISTINCT FROM expected_full THEN
    RAISE EXCEPTION 'Approved product snapshot drift; no update allowed';
  END IF;

  SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id), '[]'::jsonb)::text)
  INTO other_hash FROM public.products p WHERE NOT (p.id = ANY(target_ids));
  IF other_hash IS DISTINCT FROM 'ce8cd1a8b117a20e084fbfda22bd84ba' THEN
    RAISE EXCEPTION 'Untargeted catalogue snapshot drift; no update allowed';
  END IF;
  SELECT jsonb_build_object('product_identifiers', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_identifiers x),
      'product_application_protocols', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_application_protocols x),
      'product_oil_specs', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_oil_specs x),
      'product_oil_eligibility', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_oil_eligibility x),
      'product_dry_shampoo_specs', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_dry_shampoo_specs x),
      'product_heat_protectant_specs', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_heat_protectant_specs x),
      'product_thickness_eligibility', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_thickness_eligibility x),
      'product_concern_eligibility', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_concern_eligibility x)) INTO actual;
  IF actual IS DISTINCT FROM expected_related THEN
    RAISE EXCEPTION 'Protected catalogue relations drift; no update allowed';
  END IF;

  UPDATE public.products
  SET purchase_link_status = 'available',
      purchase_link_checked_at = transaction_timestamp()
  WHERE id = ANY(target_ids) AND purchase_link_status = 'unavailable';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 4 THEN
    RAISE EXCEPTION 'Expected four availability corrections, got %', affected;
  END IF;
  SET CONSTRAINTS ALL IMMEDIATE;

  SELECT jsonb_object_agg(p.id::text,
    md5((to_jsonb(p) - ARRAY['purchase_link_status','purchase_link_checked_at','updated_at'])::text))
  INTO actual FROM public.products p WHERE p.id = ANY(target_ids);
  IF actual IS DISTINCT FROM expected_protected THEN
    RAISE EXCEPTION 'Protected product fields changed; rollback required';
  END IF;
  IF (SELECT count(*) FROM public.products p WHERE p.id = ANY(target_ids)
      AND purchase_link_status = 'available'
      AND purchase_link_checked_at = transaction_timestamp()) <> 4 THEN
    RAISE EXCEPTION 'Availability postcondition failed';
  END IF;
  SELECT md5(COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.id), '[]'::jsonb)::text)
  INTO other_hash FROM public.products p WHERE NOT (p.id = ANY(target_ids));
  IF other_hash IS DISTINCT FROM 'ce8cd1a8b117a20e084fbfda22bd84ba' THEN
    RAISE EXCEPTION 'Untargeted products changed; rollback required';
  END IF;
  SELECT jsonb_build_object('product_identifiers', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_identifiers x),
      'product_application_protocols', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_application_protocols x),
      'product_oil_specs', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_oil_specs x),
      'product_oil_eligibility', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_oil_eligibility x),
      'product_dry_shampoo_specs', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_dry_shampoo_specs x),
      'product_heat_protectant_specs', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_heat_protectant_specs x),
      'product_thickness_eligibility', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_thickness_eligibility x),
      'product_concern_eligibility', (SELECT md5(COALESCE(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text), '[]'::jsonb)::text) FROM public.product_concern_eligibility x)) INTO actual;
  IF actual IS DISTINCT FROM expected_related THEN
    RAISE EXCEPTION 'Protected catalogue relations changed; rollback required';
  END IF;
END
$availability_fix$;

SELECT id, name, purchase_link_status, purchase_link_checked_at, updated_at,
       price_eur, price_checked_at, currency, net_content_value, net_content_unit,
       affiliate_link, is_active, lifecycle_status, is_chaarlie_recommended
FROM public.products WHERE id IN ('dc8b8d4a-8ca9-452c-8d04-03b785b63275', '517dca50-5d55-4038-ba1d-f9b745708327', '29e36443-93ff-4b62-9cf0-55ad9f89f530', 'cb228f9d-4e46-4302-9a6f-92c393eda1bd') ORDER BY id;

COMMIT;

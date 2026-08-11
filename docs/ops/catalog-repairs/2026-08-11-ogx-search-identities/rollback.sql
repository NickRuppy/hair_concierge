-- NOT APPLIED. OPERATOR ONLY. NOT A MIGRATION.
-- Roll back only the exact post-state produced by repair.sql. If anything has
-- drifted, stop and prepare a fresh compensating package.
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

DO $rollback$
DECLARE
  v_brand_id constant uuid := '3bef8ddb-49c4-47a4-9103-faca256bb34a';
  v_biotin_id constant uuid := '3f3c7d89-9e7b-4e91-85f7-d3c58d304918';
  v_keratin_id constant uuid := 'bef4f219-2c1f-4e02-8e3a-93056b95465a';
  v_rosemary_id constant uuid := '7b5ec424-d21f-4eb8-999e-7aed98e94b86';
  v_thick_full_line_candidate_id constant uuid := '42023ab3-00e6-4798-8417-85ec3276fee5';
  v_strength_length_line_candidate_id constant uuid := '03366918-eb15-41d9-8aaf-4a547f013d7d';
  v_refreshing_scalp_line_candidate_id constant uuid := '58a9d837-9658-4954-be08-77f613455d20';
  v_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-repair:2026-08-11-ogx-search-identities', 0)
  );

  PERFORM 1
  FROM public.products
  WHERE id IN (v_biotin_id, v_keratin_id, v_rosemary_id)
  ORDER BY id
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.product_lines pl ON pl.id = p.product_line_id AND pl.brand_id = p.brand_id
    WHERE p.id = v_biotin_id
      AND p.brand_id = v_brand_id
      AND p.brand = 'OGX'
      AND p.name = 'Biotin & Collagen Shampoo'
      AND pl.canonical_name = 'Thick & Full +'
      AND p.category_key = 'shampoo'
      AND p.is_active = true
      AND p.lifecycle_status = 'active'
      AND p.image_url LIKE '%/28-%'
      AND p.image_url LIKE '%ogx-ogx-biotin-collagen-89197267cf81.webp%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.product_lines pl ON pl.id = p.product_line_id AND pl.brand_id = p.brand_id
    WHERE p.id = v_keratin_id
      AND p.brand_id = v_brand_id
      AND p.brand = 'OGX'
      AND p.name = 'Keratin Oil Shampoo'
      AND pl.canonical_name = 'Strength & Length +'
      AND p.category_key = 'shampoo'
      AND p.is_active = true
      AND p.lifecycle_status = 'active'
      AND p.image_url LIKE '%/29-%'
      AND p.image_url LIKE '%ogx-ogx-keratin-oil-c2bde030beb2.webp%'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.product_lines pl ON pl.id = p.product_line_id AND pl.brand_id = p.brand_id
    WHERE p.id = v_rosemary_id
      AND p.brand_id = v_brand_id
      AND p.brand = 'OGX'
      AND p.name = 'Rosemary Mint Shampoo'
      AND pl.canonical_name = 'Refreshing Scalp +'
      AND p.category_key = 'shampoo'
      AND p.is_active = true
      AND p.lifecycle_status = 'active'
      AND p.image_url LIKE '%/31-%'
      AND p.image_url LIKE '%ogx-ogx-rosemary-c14a74393fc0.webp%'
  ) THEN
    RAISE EXCEPTION 'OGX search identity rollback post-state guard failed' USING ERRCODE = '22000';
  END IF;

  UPDATE public.products
  SET name = 'OGX Biotin & Collagen', product_line_id = NULL
  WHERE id = v_biotin_id
    AND name = 'Biotin & Collagen Shampoo';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'OGX search identity rollback Biotin row drifted: %', v_count USING ERRCODE = '22000';
  END IF;

  UPDATE public.products
  SET name = 'OGX Keratin Oil', product_line_id = NULL
  WHERE id = v_keratin_id
    AND name = 'Keratin Oil Shampoo';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'OGX search identity rollback Keratin row drifted: %', v_count USING ERRCODE = '22000';
  END IF;

  UPDATE public.products
  SET name = 'OGX Rosemary', product_line_id = NULL
  WHERE id = v_rosemary_id
    AND name = 'Rosemary Mint Shampoo';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'OGX search identity rollback Rosemary row drifted: %', v_count USING ERRCODE = '22000';
  END IF;

  DELETE FROM public.product_lines pl
  WHERE pl.id IN (
      v_thick_full_line_candidate_id,
      v_strength_length_line_candidate_id,
      v_refreshing_scalp_line_candidate_id
    )
    AND pl.brand_id = v_brand_id
    AND pl.canonical_name IN ('Thick & Full +', 'Strength & Length +', 'Refreshing Scalp +')
    AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.product_line_id = pl.id)
    AND NOT EXISTS (SELECT 1 FROM public.brand_aliases a WHERE a.product_line_id = pl.id);

  IF EXISTS (
    SELECT 1 FROM public.products
    WHERE id IN (v_biotin_id, v_keratin_id, v_rosemary_id)
      AND product_line_id IS NOT NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_biotin_id
      AND name = 'OGX Biotin & Collagen'
      AND brand_id = v_brand_id
      AND category_key = 'shampoo'
      AND is_active = true
      AND lifecycle_status = 'active'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_keratin_id
      AND name = 'OGX Keratin Oil'
      AND brand_id = v_brand_id
      AND category_key = 'shampoo'
      AND is_active = true
      AND lifecycle_status = 'active'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_rosemary_id
      AND name = 'OGX Rosemary'
      AND brand_id = v_brand_id
      AND category_key = 'shampoo'
      AND is_active = true
      AND lifecycle_status = 'active'
  ) THEN
    RAISE EXCEPTION 'OGX search identity rollback final postcondition failed' USING ERRCODE = '22000';
  END IF;
END
$rollback$;

COMMIT;

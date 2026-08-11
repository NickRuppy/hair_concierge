-- NOT APPLIED. OPERATOR ONLY. NOT A MIGRATION.
-- This package updates only the three exact OGX product identity rows after
-- creating or reusing exact OGX product_lines. Never run through app code.
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

DO $repair$
DECLARE
  v_brand_id constant uuid := '3bef8ddb-49c4-47a4-9103-faca256bb34a';
  v_biotin_id constant uuid := '3f3c7d89-9e7b-4e91-85f7-d3c58d304918';
  v_keratin_id constant uuid := 'bef4f219-2c1f-4e02-8e3a-93056b95465a';
  v_rosemary_id constant uuid := '7b5ec424-d21f-4eb8-999e-7aed98e94b86';
  v_thick_full_line_candidate_id constant uuid := '42023ab3-00e6-4798-8417-85ec3276fee5';
  v_strength_length_line_candidate_id constant uuid := '03366918-eb15-41d9-8aaf-4a547f013d7d';
  v_refreshing_scalp_line_candidate_id constant uuid := '58a9d837-9658-4954-be08-77f613455d20';
  v_thick_full_line constant text := 'Thick & Full +';
  v_strength_length_line constant text := 'Strength & Length +';
  v_refreshing_scalp_line constant text := 'Refreshing Scalp +';
  v_biotin_name constant text := 'Biotin & Collagen Shampoo';
  v_keratin_name constant text := 'Keratin Oil Shampoo';
  v_rosemary_name constant text := 'Rosemary Mint Shampoo';
  v_thick_full_line_id uuid;
  v_strength_length_line_id uuid;
  v_refreshing_scalp_line_id uuid;
  v_count integer;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-repair:2026-08-11-ogx-search-identities', 0)
  );

  IF NOT EXISTS (
    SELECT 1 FROM public.brands WHERE id = v_brand_id AND canonical_name = 'OGX'
  ) THEN
    RAISE EXCEPTION 'OGX search identity repair brand guard failed' USING ERRCODE = '22000';
  END IF;

  PERFORM 1
  FROM public.products
  WHERE id IN (v_biotin_id, v_keratin_id, v_rosemary_id)
  ORDER BY id
  FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_biotin_id
      AND brand_id = v_brand_id
      AND brand = 'OGX'
      AND name = 'OGX Biotin & Collagen'
      AND product_line_id IS NULL
      AND category_key = 'shampoo'
      AND is_active = true
      AND lifecycle_status = 'active'
      AND image_url LIKE '%/28-%'
      AND image_url LIKE '%ogx-ogx-biotin-collagen-89197267cf81.webp%'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_keratin_id
      AND brand_id = v_brand_id
      AND brand = 'OGX'
      AND name = 'OGX Keratin Oil'
      AND product_line_id IS NULL
      AND category_key = 'shampoo'
      AND is_active = true
      AND lifecycle_status = 'active'
      AND image_url LIKE '%/29-%'
      AND image_url LIKE '%ogx-ogx-keratin-oil-c2bde030beb2.webp%'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = v_rosemary_id
      AND brand_id = v_brand_id
      AND brand = 'OGX'
      AND name = 'OGX Rosemary'
      AND product_line_id IS NULL
      AND category_key = 'shampoo'
      AND is_active = true
      AND lifecycle_status = 'active'
      AND image_url LIKE '%/31-%'
      AND image_url LIKE '%ogx-ogx-rosemary-c14a74393fc0.webp%'
  ) THEN
    RAISE EXCEPTION 'OGX search identity repair product fingerprint drifted' USING ERRCODE = '22000';
  END IF;

  SELECT id INTO v_thick_full_line_id
  FROM public.product_lines
  WHERE brand_id = v_brand_id
    AND normalized_name = public.product_intake_review_normalize_identity_text(v_thick_full_line)
  FOR UPDATE;
  IF v_thick_full_line_id IS NULL THEN
    INSERT INTO public.product_lines (id, brand_id, canonical_name, normalized_name)
    VALUES (
      v_thick_full_line_candidate_id,
      v_brand_id,
      v_thick_full_line,
      public.product_intake_review_normalize_identity_text(v_thick_full_line)
    )
    RETURNING id INTO v_thick_full_line_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.product_lines
    WHERE id = v_thick_full_line_id
      AND brand_id = v_brand_id
      AND canonical_name = v_thick_full_line
  ) THEN
    RAISE EXCEPTION 'OGX search identity repair found conflicting Thick & Full + line' USING ERRCODE = '22000';
  END IF;

  SELECT id INTO v_strength_length_line_id
  FROM public.product_lines
  WHERE brand_id = v_brand_id
    AND normalized_name = public.product_intake_review_normalize_identity_text(v_strength_length_line)
  FOR UPDATE;
  IF v_strength_length_line_id IS NULL THEN
    INSERT INTO public.product_lines (id, brand_id, canonical_name, normalized_name)
    VALUES (
      v_strength_length_line_candidate_id,
      v_brand_id,
      v_strength_length_line,
      public.product_intake_review_normalize_identity_text(v_strength_length_line)
    )
    RETURNING id INTO v_strength_length_line_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.product_lines
    WHERE id = v_strength_length_line_id
      AND brand_id = v_brand_id
      AND canonical_name = v_strength_length_line
  ) THEN
    RAISE EXCEPTION 'OGX search identity repair found conflicting Strength & Length + line' USING ERRCODE = '22000';
  END IF;

  SELECT id INTO v_refreshing_scalp_line_id
  FROM public.product_lines
  WHERE brand_id = v_brand_id
    AND normalized_name = public.product_intake_review_normalize_identity_text(v_refreshing_scalp_line)
  FOR UPDATE;
  IF v_refreshing_scalp_line_id IS NULL THEN
    INSERT INTO public.product_lines (id, brand_id, canonical_name, normalized_name)
    VALUES (
      v_refreshing_scalp_line_candidate_id,
      v_brand_id,
      v_refreshing_scalp_line,
      public.product_intake_review_normalize_identity_text(v_refreshing_scalp_line)
    )
    RETURNING id INTO v_refreshing_scalp_line_id;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.product_lines
    WHERE id = v_refreshing_scalp_line_id
      AND brand_id = v_brand_id
      AND canonical_name = v_refreshing_scalp_line
  ) THEN
    RAISE EXCEPTION 'OGX search identity repair found conflicting Refreshing Scalp + line' USING ERRCODE = '22000';
  END IF;

  UPDATE public.products
  SET name = v_biotin_name, product_line_id = v_thick_full_line_id
  WHERE id = v_biotin_id
    AND name = 'OGX Biotin & Collagen'
    AND product_line_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'OGX search identity repair Biotin row update drifted: %', v_count USING ERRCODE = '22000';
  END IF;

  UPDATE public.products
  SET name = v_keratin_name, product_line_id = v_strength_length_line_id
  WHERE id = v_keratin_id
    AND name = 'OGX Keratin Oil'
    AND product_line_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'OGX search identity repair Keratin row update drifted: %', v_count USING ERRCODE = '22000';
  END IF;

  UPDATE public.products
  SET name = v_rosemary_name, product_line_id = v_refreshing_scalp_line_id
  WHERE id = v_rosemary_id
    AND name = 'OGX Rosemary'
    AND product_line_id IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'OGX search identity repair Rosemary row update drifted: %', v_count USING ERRCODE = '22000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.product_lines pl ON pl.id = p.product_line_id AND pl.brand_id = p.brand_id
    WHERE p.id = v_biotin_id
      AND p.brand_id = v_brand_id
      AND p.name = v_biotin_name
      AND pl.canonical_name = v_thick_full_line
      AND p.category_key = 'shampoo'
      AND p.is_active = true
      AND p.lifecycle_status = 'active'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.product_lines pl ON pl.id = p.product_line_id AND pl.brand_id = p.brand_id
    WHERE p.id = v_keratin_id
      AND p.brand_id = v_brand_id
      AND p.name = v_keratin_name
      AND pl.canonical_name = v_strength_length_line
      AND p.category_key = 'shampoo'
      AND p.is_active = true
      AND p.lifecycle_status = 'active'
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.product_lines pl ON pl.id = p.product_line_id AND pl.brand_id = p.brand_id
    WHERE p.id = v_rosemary_id
      AND p.brand_id = v_brand_id
      AND p.name = v_rosemary_name
      AND pl.canonical_name = v_refreshing_scalp_line
      AND p.category_key = 'shampoo'
      AND p.is_active = true
      AND p.lifecycle_status = 'active'
  ) THEN
    RAISE EXCEPTION 'OGX search identity repair postcondition failed' USING ERRCODE = '22000';
  END IF;
END
$repair$;

COMMIT;

-- One reviewed image-only correction for the already-applied Scalp v1 batch.
-- The frozen Scalp launch package and its shared applied-items ledger remain
-- immutable; this separate receipt makes the correction independently auditable.
CREATE TABLE IF NOT EXISTS public.catalog_enrichment_image_corrections (
  correction_id text PRIMARY KEY,
  correction_fingerprint text NOT NULL CHECK (correction_fingerprint ~ '^[a-f0-9]{64}$'),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_key text NOT NULL,
  source_batch_id text NOT NULL,
  source_content_fingerprint text NOT NULL CHECK (source_content_fingerprint ~ '^[a-f0-9]{64}$'),
  old_storage_bucket text NOT NULL,
  old_storage_path text NOT NULL,
  old_public_url text NOT NULL,
  old_asset_sha256 text NOT NULL CHECK (old_asset_sha256 ~ '^[a-f0-9]{64}$'),
  new_storage_bucket text NOT NULL,
  new_storage_path text NOT NULL,
  new_public_url text NOT NULL,
  new_asset_sha256 text NOT NULL CHECK (new_asset_sha256 ~ '^[a-f0-9]{64}$'),
  reviewed_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_enrichment_image_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.catalog_enrichment_image_corrections FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.catalog_enrichment_image_corrections FROM service_role;
GRANT SELECT ON TABLE public.catalog_enrichment_image_corrections TO service_role;

COMMENT ON TABLE public.catalog_enrichment_image_corrections IS
  'Append-only reviewed image corrections for frozen catalog-enrichment packages.';

CREATE OR REPLACE FUNCTION public.apply_catalog_enrichment_scalp_image_correction_v1(
  p_expected_correction_fingerprint text,
  p_reviewed_by text
) RETURNS TABLE(product_id uuid, correction_id text, apply_state text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_product public.products%ROWTYPE;
  v_asset public.product_image_assets%ROWTYPE;
  v_existing public.catalog_enrichment_image_corrections%ROWTYPE;
  v_has_existing boolean;
  v_product_id constant uuid := '58aa2f19-b23a-4e09-ab0f-68c359371c9e';
  v_product_key constant text := 'the-ordinary-multi-peptide-hair-density-serum';
  v_correction_id constant text := 'personal-plan-scalp-the-ordinary-image-correction-v1';
  v_source_batch_id constant text := 'personal-plan-launch-v1';
  v_source_content_fingerprint constant text := '10fbf543434519912f702856b25742c418df5782f5de06472be27a79d51fb6e7';
  v_old_storage_bucket constant text := 'product-images';
  v_old_storage_path constant text := 'catalog-enrichment/personal-plan-launch-v1/scalp/the-ordinary-multi-peptide-hair-density-serum/the-ordinary-multi-peptide-hair-density-serum-6bb9be89b327.webp';
  v_old_public_url constant text := 'https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-enrichment/personal-plan-launch-v1/scalp/the-ordinary-multi-peptide-hair-density-serum/the-ordinary-multi-peptide-hair-density-serum-6bb9be89b327.webp';
  v_old_asset_sha256 constant text := '6bb9be89b327984d4fe8f95c8009896bfec386f04dbf544a208e78268079dd5c';
  v_new_storage_bucket constant text := 'product-images';
  v_new_storage_path constant text := 'catalog-enrichment/personal-plan-launch-v1/scalp/the-ordinary-multi-peptide-hair-density-serum/the-ordinary-multi-peptide-hair-density-serum-1a79af996795.webp';
  v_new_public_url constant text := 'https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-enrichment/personal-plan-launch-v1/scalp/the-ordinary-multi-peptide-hair-density-serum/the-ordinary-multi-peptide-hair-density-serum-1a79af996795.webp';
  v_new_asset_sha256 constant text := '1a79af996795ea031e0a28b0220d37109950e0aed1a1175bb358e944efdbbc66';
  v_new_source_page_url constant text := 'https://theordinary.com/de-de/multi-peptide-serum-for-hair-density-hair-scalp-treatment-100434.html';
  v_new_source_image_url constant text := 'https://theordinary.com/dw/image/v2/BFKJ_PRD/on/demandware.static/-/Sites-deciem-master/default/dwe085e4f9/Images/products/The%20Ordinary/rdn-multi-peptide-serum-for-hair-density-60ml.png?sw=1200&sh=1200&sm=fit';
  v_new_processing_method constant text := 'local';
  v_new_notes constant text := 'Nick approved the final shadow-free image on 2026-08-11; official alpha source with deterministic symmetric shadow mask.';
  v_approved_correction_fingerprint constant text := '31211abbdd19464bd9d2d151c59e239279909769e2f1ea8e2737bf60d6e29828';
BEGIN
  IF p_reviewed_by <> 'nick' THEN
    RAISE EXCEPTION 'Scalp image correction reviewer must be nick';
  END IF;
  IF p_expected_correction_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Scalp image correction fingerprint must be lowercase sha256';
  END IF;
  IF p_expected_correction_fingerprint <> v_approved_correction_fingerprint THEN
    RAISE EXCEPTION 'Scalp image correction fingerprint is not approved';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-enrichment:' || v_correction_id, 0)
  );

  IF NOT EXISTS (
    SELECT 1
    FROM public.catalog_enrichment_applied_items applied
    WHERE applied.batch_id = 'personal-plan-scalp-launch-v1'
      AND applied.product_key = v_product_key
      AND applied.product_id = v_product_id
      AND applied.batch_fingerprint = 'e6cbbe9ce2dc3d3b29655741cfe7572dd29d8b5bb5bea1a7225fd58359328e50'
      AND applied.content_fingerprint = v_source_content_fingerprint
      AND applied.reviewed_by = 'nick'
  ) THEN
    RAISE EXCEPTION 'Scalp image correction prerequisite launch receipt is missing or divergent';
  END IF;

  SELECT correction.* INTO v_existing
  FROM public.catalog_enrichment_image_corrections correction
  WHERE correction.correction_id = v_correction_id;
  v_has_existing := FOUND;

  SELECT p.* INTO v_product
  FROM public.products p
  WHERE p.id = v_product_id
  FOR UPDATE;
  IF NOT FOUND
     OR v_product.name <> 'Multi-Peptide Serum for Hair Density'
     OR v_product.brand <> 'The Ordinary'
     OR v_product.category_key <> 'scalp_care'
     OR v_product.origin <> 'curated' THEN
    RAISE EXCEPTION 'Scalp image correction target product is missing or divergent';
  END IF;

  SELECT image.* INTO v_asset
  FROM public.product_image_assets image
  WHERE image.product_id = v_product_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Scalp image correction target provenance is missing';
  END IF;

  IF v_has_existing THEN
    IF v_existing.correction_fingerprint <> v_approved_correction_fingerprint
       OR v_existing.product_id <> v_product_id
       OR v_existing.product_key <> v_product_key
       OR v_existing.source_batch_id <> v_source_batch_id
       OR v_existing.source_content_fingerprint <> v_source_content_fingerprint
       OR v_existing.old_storage_bucket <> v_old_storage_bucket
       OR v_existing.old_storage_path <> v_old_storage_path
       OR v_existing.old_public_url <> v_old_public_url
       OR v_existing.old_asset_sha256 <> v_old_asset_sha256
       OR v_existing.new_storage_bucket <> v_new_storage_bucket
       OR v_existing.new_storage_path <> v_new_storage_path
       OR v_existing.new_public_url <> v_new_public_url
       OR v_existing.new_asset_sha256 <> v_new_asset_sha256
       OR v_existing.reviewed_by <> 'nick'
       OR v_product.image_url <> v_new_public_url
       OR v_asset.storage_bucket <> v_new_storage_bucket
       OR v_asset.storage_path <> v_new_storage_path
       OR v_asset.public_url <> v_new_public_url
       OR v_asset.asset_sha256 <> v_new_asset_sha256
       OR v_asset.source_page_url <> v_new_source_page_url
       OR v_asset.source_image_url <> v_new_source_image_url
       OR v_asset.source_type <> 'brand'
       OR v_asset.quality_confidence <> 'high'
       OR v_asset.processing_method <> v_new_processing_method
       OR v_asset.manifest_batch_id <> v_correction_id
       OR v_asset.user_approved IS NOT TRUE THEN
      RAISE EXCEPTION 'Scalp image correction conflicting or partial replay';
    END IF;

    product_id := v_product_id;
    correction_id := v_correction_id;
    apply_state := 'already_applied';
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_product.image_url <> v_old_public_url
     OR v_asset.storage_bucket <> v_old_storage_bucket
     OR v_asset.storage_path <> v_old_storage_path
     OR v_asset.public_url <> v_old_public_url
     OR v_asset.asset_sha256 <> v_old_asset_sha256
     OR v_asset.manifest_batch_id <> v_source_batch_id
     OR v_asset.user_approved IS NOT TRUE THEN
    RAISE EXCEPTION 'Scalp image correction target state is not the approved old asset';
  END IF;

  UPDATE public.products
  SET image_url = v_new_public_url
  WHERE id = v_product_id;

  UPDATE public.product_image_assets AS target_asset
  SET storage_bucket = v_new_storage_bucket,
      storage_path = v_new_storage_path,
      public_url = v_new_public_url,
      asset_sha256 = v_new_asset_sha256,
      source_page_url = v_new_source_page_url,
      source_image_url = v_new_source_image_url,
      source_type = 'brand',
      quality_confidence = 'high',
      processing_method = v_new_processing_method,
      manifest_batch_id = v_correction_id,
      user_approved = true,
      notes = v_new_notes,
      published_at = now()
  WHERE target_asset.product_id = v_product_id;

  INSERT INTO public.catalog_enrichment_image_corrections (
    correction_id, correction_fingerprint, product_id, product_key,
    source_batch_id, source_content_fingerprint,
    old_storage_bucket, old_storage_path, old_public_url, old_asset_sha256,
    new_storage_bucket, new_storage_path, new_public_url, new_asset_sha256,
    reviewed_by
  ) VALUES (
    v_correction_id, v_approved_correction_fingerprint, v_product_id, v_product_key,
    v_source_batch_id, v_source_content_fingerprint,
    v_old_storage_bucket, v_old_storage_path, v_old_public_url, v_old_asset_sha256,
    v_new_storage_bucket, v_new_storage_path, v_new_public_url, v_new_asset_sha256,
    'nick'
  );

  product_id := v_product_id;
  correction_id := v_correction_id;
  apply_state := 'applied';
  RETURN NEXT;
END;
$fn$;

REVOKE ALL ON FUNCTION public.apply_catalog_enrichment_scalp_image_correction_v1(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_catalog_enrichment_scalp_image_correction_v1(text, text)
  TO service_role;

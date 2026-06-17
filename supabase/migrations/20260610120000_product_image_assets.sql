-- Product image pilot storage + flat provenance metadata.
-- Final product images are public catalog assets. Messy candidate research
-- stays local; this table stores only approved published assets.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152,
  ARRAY['image/webp', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
CREATE TABLE IF NOT EXISTS public.product_image_assets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'product-images',
  storage_path text NOT NULL,
  public_url text NOT NULL,
  source_page_url text NOT NULL,
  source_image_url text,
  source_type text NOT NULL CHECK (
    source_type IN ('brand', 'retailer', 'marketplace', 'search_result', 'unknown')
  ),
  quality_confidence text NOT NULL CHECK (
    quality_confidence IN ('high', 'medium')
  ),
  processing_method text NOT NULL CHECK (
    processing_method IN ('local', 'third_party', 'manual')
  ),
  asset_sha256 text NOT NULL CHECK (asset_sha256 ~ '^[a-f0-9]{64}$'),
  manifest_batch_id text NOT NULL,
  user_approved boolean NOT NULL DEFAULT false,
  notes text,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_image_assets_storage_path_idx
  ON public.product_image_assets(storage_path);
CREATE UNIQUE INDEX IF NOT EXISTS product_image_assets_product_id_idx
  ON public.product_image_assets(product_id);
CREATE INDEX IF NOT EXISTS product_image_assets_manifest_batch_id_idx
  ON public.product_image_assets(manifest_batch_id);
DROP TRIGGER IF EXISTS set_updated_at_product_image_assets ON public.product_image_assets;
CREATE TRIGGER set_updated_at_product_image_assets
  BEFORE UPDATE ON public.product_image_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.publish_product_image_asset(
  p_product_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_public_url text,
  p_source_page_url text,
  p_source_image_url text,
  p_source_type text,
  p_quality_confidence text,
  p_processing_method text,
  p_asset_sha256 text,
  p_manifest_batch_id text,
  p_user_approved boolean,
  p_notes text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET image_url = p_public_url
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found: %', p_product_id;
  END IF;

  INSERT INTO public.product_image_assets (
    product_id,
    storage_bucket,
    storage_path,
    public_url,
    source_page_url,
    source_image_url,
    source_type,
    quality_confidence,
    processing_method,
    asset_sha256,
    manifest_batch_id,
    user_approved,
    notes
  )
  VALUES (
    p_product_id,
    p_storage_bucket,
    p_storage_path,
    p_public_url,
    p_source_page_url,
    p_source_image_url,
    p_source_type,
    p_quality_confidence,
    p_processing_method,
    p_asset_sha256,
    p_manifest_batch_id,
    p_user_approved,
    p_notes
  )
  ON CONFLICT (product_id) DO UPDATE
  SET
    storage_bucket = EXCLUDED.storage_bucket,
    storage_path = EXCLUDED.storage_path,
    public_url = EXCLUDED.public_url,
    source_page_url = EXCLUDED.source_page_url,
    source_image_url = EXCLUDED.source_image_url,
    source_type = EXCLUDED.source_type,
    quality_confidence = EXCLUDED.quality_confidence,
    processing_method = EXCLUDED.processing_method,
    asset_sha256 = EXCLUDED.asset_sha256,
    manifest_batch_id = EXCLUDED.manifest_batch_id,
    user_approved = EXCLUDED.user_approved,
    notes = EXCLUDED.notes;
END;
$$;
ALTER TABLE public.product_image_assets ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.product_image_assets IS
  'Flat provenance table for approved published product image assets. Messy candidate research stays local.';

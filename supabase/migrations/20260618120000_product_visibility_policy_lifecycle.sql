-- Phase 5 product visibility boundary.
-- General authenticated product reads must expose only active, current,
-- Chaarlie-recommended products. User-owned non-recommended product
-- assessment may read only the exact active products matched into that
-- user's own routine.

CREATE INDEX IF NOT EXISTS user_product_usage_user_product_matched_idx
  ON public.user_product_usage (user_id, product_id)
  WHERE match_status = 'matched'
    AND product_id IS NOT NULL;

GRANT SELECT ON TABLE public.product_lines TO anon, authenticated;

DROP POLICY IF EXISTS "products_select_active"
  ON public.products;

DROP POLICY IF EXISTS "products_select_owned_matched"
  ON public.products;

DROP POLICY IF EXISTS product_lines_select_public
  ON public.product_lines;

CREATE POLICY "products_select_active"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND lifecycle_status = 'active'
    AND is_chaarlie_recommended = true
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "products_select_owned_matched"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND lifecycle_status = 'active'
    AND auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1
      FROM public.user_product_usage AS usage
      WHERE usage.user_id = (SELECT auth.uid())
        AND usage.product_id = products.id
        AND usage.match_status = 'matched'
    )
  );

CREATE POLICY product_lines_select_public
  ON public.product_lines
  FOR SELECT
  TO anon, authenticated
  USING (true);

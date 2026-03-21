-- Make product_shampoo_specs the canonical shampoo eligibility source.
-- Shampoo rows are now managed via source data ingest instead of product-row triggers.

DROP TRIGGER IF EXISTS trg_sync_product_shampoo_specs ON public.products;

DROP FUNCTION IF EXISTS public.sync_product_shampoo_specs_from_products();
DROP FUNCTION IF EXISTS public.expand_shampoo_eligibility(text[], text[]);

COMMENT ON TABLE public.product_shampoo_specs IS
  'Canonical shampoo eligibility pairs managed via source data ingest.';

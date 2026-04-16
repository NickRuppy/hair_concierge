DROP INDEX IF EXISTS idx_product_mask_specs_benefits;
DROP INDEX IF EXISTS idx_product_mask_specs_ingredient_flags;

ALTER TABLE public.product_mask_specs
  DROP COLUMN IF EXISTS format,
  DROP COLUMN IF EXISTS benefits,
  DROP COLUMN IF EXISTS ingredient_flags,
  DROP COLUMN IF EXISTS leave_on_minutes;

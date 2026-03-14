-- Mask recommendation schema cleanup:
-- Remove fields deferred to later routine-level logic.

DROP INDEX IF EXISTS idx_product_mask_specs_scalp_allowed;

ALTER TABLE product_mask_specs
  DROP COLUMN IF EXISTS apply_on_scalp_allowed,
  DROP COLUMN IF EXISTS max_uses_per_week,
  DROP COLUMN IF EXISTS dose_fine_ml,
  DROP COLUMN IF EXISTS dose_normal_ml,
  DROP COLUMN IF EXISTS dose_coarse_ml;

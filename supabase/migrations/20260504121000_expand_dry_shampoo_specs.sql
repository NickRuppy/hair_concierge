ALTER TABLE public.product_dry_shampoo_specs
  ADD COLUMN IF NOT EXISTS primary_effect text,
  ADD COLUMN IF NOT EXISTS hair_color_fit text,
  ADD COLUMN IF NOT EXISTS scalp_sensitivity_fit text,
  ADD COLUMN IF NOT EXISTS format text;

UPDATE public.product_dry_shampoo_specs
SET
  primary_effect = COALESCE(primary_effect, 'classic_refresh'),
  hair_color_fit = COALESCE(hair_color_fit, 'universal'),
  scalp_sensitivity_fit = COALESCE(scalp_sensitivity_fit, 'normal_only'),
  format = COALESCE(format, 'aerosol_spray');

ALTER TABLE public.product_dry_shampoo_specs
  ALTER COLUMN primary_effect SET NOT NULL,
  ALTER COLUMN hair_color_fit SET NOT NULL,
  ALTER COLUMN scalp_sensitivity_fit SET NOT NULL,
  ALTER COLUMN format SET NOT NULL;

ALTER TABLE public.product_dry_shampoo_specs
  DROP CONSTRAINT IF EXISTS product_dry_shampoo_specs_primary_effect_check,
  DROP CONSTRAINT IF EXISTS product_dry_shampoo_specs_hair_color_fit_check,
  DROP CONSTRAINT IF EXISTS product_dry_shampoo_specs_scalp_sensitivity_fit_check,
  DROP CONSTRAINT IF EXISTS product_dry_shampoo_specs_format_check;

ALTER TABLE public.product_dry_shampoo_specs
  ADD CONSTRAINT product_dry_shampoo_specs_primary_effect_check CHECK (
    primary_effect IN ('classic_refresh', 'volume_texture', 'sensitive_refresh')
  ),
  ADD CONSTRAINT product_dry_shampoo_specs_hair_color_fit_check CHECK (
    hair_color_fit IN ('universal', 'blonde_light', 'brown', 'dark')
  ),
  ADD CONSTRAINT product_dry_shampoo_specs_scalp_sensitivity_fit_check CHECK (
    scalp_sensitivity_fit IN ('sensitive_ok', 'normal_only')
  ),
  ADD CONSTRAINT product_dry_shampoo_specs_format_check CHECK (
    format IN ('aerosol_spray', 'powder', 'foam_or_liquid')
  );

DROP INDEX IF EXISTS public.idx_product_dry_shampoo_specs_scalp_type_focus;

ALTER TABLE public.product_dry_shampoo_specs
  DROP COLUMN IF EXISTS scalp_type_focus;

CREATE INDEX IF NOT EXISTS idx_product_dry_shampoo_specs_primary_effect
  ON public.product_dry_shampoo_specs (primary_effect);

CREATE INDEX IF NOT EXISTS idx_product_dry_shampoo_specs_hair_color_fit
  ON public.product_dry_shampoo_specs (hair_color_fit);

CREATE INDEX IF NOT EXISTS idx_product_dry_shampoo_specs_scalp_sensitivity_fit
  ON public.product_dry_shampoo_specs (scalp_sensitivity_fit);

CREATE INDEX IF NOT EXISTS idx_product_dry_shampoo_specs_format
  ON public.product_dry_shampoo_specs (format);

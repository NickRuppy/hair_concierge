ALTER TABLE public.product_deep_cleansing_shampoo_specs
  ADD COLUMN IF NOT EXISTS reset_intensity text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS reset_focus text NOT NULL DEFAULT 'general_buildup',
  ADD COLUMN IF NOT EXISTS color_treated_suitability text NOT NULL DEFAULT 'unsuitable_or_unknown';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_deep_cleansing_shampoo_specs_reset_intensity_check'
  ) THEN
    ALTER TABLE public.product_deep_cleansing_shampoo_specs
      ADD CONSTRAINT product_deep_cleansing_shampoo_specs_reset_intensity_check
      CHECK (reset_intensity IN ('gentle', 'medium', 'strong'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_deep_cleansing_shampoo_specs_reset_focus_check'
  ) THEN
    ALTER TABLE public.product_deep_cleansing_shampoo_specs
      ADD CONSTRAINT product_deep_cleansing_shampoo_specs_reset_focus_check
      CHECK (reset_focus IN ('general_buildup', 'mineral_chlorine', 'broad_spectrum'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_deep_cleansing_shampoo_specs_color_treated_suitability_check'
  ) THEN
    ALTER TABLE public.product_deep_cleansing_shampoo_specs
      ADD CONSTRAINT product_deep_cleansing_shampoo_specs_color_treated_suitability_check
      CHECK (color_treated_suitability IN ('suitable', 'unsuitable_or_unknown'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_deep_cleansing_shampoo_specs_reset_focus
  ON public.product_deep_cleansing_shampoo_specs (reset_focus);

CREATE INDEX IF NOT EXISTS idx_product_deep_cleansing_shampoo_specs_reset_intensity
  ON public.product_deep_cleansing_shampoo_specs (reset_intensity);

CREATE INDEX IF NOT EXISTS idx_product_deep_cleansing_shampoo_specs_color_treated
  ON public.product_deep_cleansing_shampoo_specs (color_treated_suitability);

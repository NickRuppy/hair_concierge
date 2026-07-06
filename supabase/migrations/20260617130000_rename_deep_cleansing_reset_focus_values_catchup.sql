ALTER TABLE public.product_deep_cleansing_shampoo_specs
  DROP CONSTRAINT IF EXISTS product_deep_cleansing_shampoo_specs_reset_focus_check;

ALTER TABLE public.product_deep_cleansing_shampoo_specs
  ALTER COLUMN reset_focus SET DEFAULT 'product_sebum_buildup';

UPDATE public.product_deep_cleansing_shampoo_specs
SET reset_focus = CASE reset_focus
  WHEN 'general_buildup' THEN 'product_sebum_buildup'
  WHEN 'mineral_chlorine' THEN 'metal_mineral_hard_water'
  WHEN 'broad_spectrum' THEN 'broad_spectrum_detox'
  ELSE reset_focus
END
WHERE reset_focus IN ('general_buildup', 'mineral_chlorine', 'broad_spectrum');

ALTER TABLE public.product_deep_cleansing_shampoo_specs
  ADD CONSTRAINT product_deep_cleansing_shampoo_specs_reset_focus_check
  CHECK (
    reset_focus IN (
      'product_sebum_buildup',
      'metal_mineral_hard_water',
      'broad_spectrum_detox'
    )
  );

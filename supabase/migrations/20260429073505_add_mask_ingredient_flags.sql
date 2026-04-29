ALTER TABLE public.product_mask_specs
  ADD COLUMN ingredient_flags text[] NOT NULL DEFAULT '{}'
  CHECK (
    ingredient_flags <@ ARRAY['silicones','polymers','oils','proteins','humectants']
  );

CREATE INDEX IF NOT EXISTS idx_product_mask_specs_ingredient_flags
  ON public.product_mask_specs USING gin (ingredient_flags);

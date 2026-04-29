ALTER TABLE public.product_oil_eligibility
  ADD COLUMN ingredient_flags text[] NOT NULL DEFAULT '{}'
  CHECK (
    ingredient_flags <@ ARRAY['silicones','polymers','oils','proteins','humectants']
  );

CREATE INDEX IF NOT EXISTS idx_product_oil_eligibility_ingredient_flags
  ON public.product_oil_eligibility USING gin (ingredient_flags);

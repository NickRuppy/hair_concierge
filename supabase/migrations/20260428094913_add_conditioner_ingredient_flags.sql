ALTER TABLE public.product_conditioner_rerank_specs
  ADD COLUMN ingredient_flags text[] NOT NULL DEFAULT '{}'
  CHECK (
    ingredient_flags <@ ARRAY['silicones','polymers','oils','proteins','humectants']
  );

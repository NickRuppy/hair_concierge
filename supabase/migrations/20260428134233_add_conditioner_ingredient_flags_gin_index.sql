CREATE INDEX IF NOT EXISTS idx_product_conditioner_rerank_specs_ingredient_flags
  ON public.product_conditioner_rerank_specs USING gin (ingredient_flags);

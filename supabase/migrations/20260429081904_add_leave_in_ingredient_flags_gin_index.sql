CREATE INDEX IF NOT EXISTS idx_product_leave_in_specs_ingredient_flags
  ON public.product_leave_in_specs USING gin (ingredient_flags);

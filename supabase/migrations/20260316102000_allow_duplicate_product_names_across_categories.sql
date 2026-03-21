-- Allow the same product name to exist in multiple categories
-- (for example shampoo + conditioner variants that share a retail name).

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_name_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_name_category_unique'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_name_category_unique UNIQUE (name, category);
  END IF;
END
$$;

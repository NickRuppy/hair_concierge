DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_conditioner_rerank_specs'
      AND column_name = 'balance_direction'
  ) THEN
    ALTER TABLE public.product_conditioner_rerank_specs
      ADD COLUMN balance_direction text;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.product_conditioner_rerank_specs
    DROP CONSTRAINT IF EXISTS product_conditioner_rerank_specs_balance_direction_check;

  ALTER TABLE public.product_conditioner_rerank_specs
    ADD CONSTRAINT product_conditioner_rerank_specs_balance_direction_check
    CHECK (
      balance_direction IS NULL
      OR balance_direction IN ('protein', 'moisture', 'balanced')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_conditioner_rerank_specs_balance
  ON public.product_conditioner_rerank_specs (balance_direction);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'product_mask_specs'
      AND column_name = 'balance_direction'
  ) THEN
    ALTER TABLE public.product_mask_specs
      ADD COLUMN balance_direction text;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.product_mask_specs
    DROP CONSTRAINT IF EXISTS product_mask_specs_balance_direction_check;

  ALTER TABLE public.product_mask_specs
    ADD CONSTRAINT product_mask_specs_balance_direction_check
    CHECK (
      balance_direction IS NULL
      OR balance_direction IN ('protein', 'moisture', 'balanced')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_mask_specs_balance
  ON public.product_mask_specs (balance_direction);

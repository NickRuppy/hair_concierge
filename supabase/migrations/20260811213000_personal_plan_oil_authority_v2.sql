-- Add exact Oil authority fields for Personal Plan Stage 3.
-- Nullable by design: existing products remain unchanged until source-backed
-- catalog research populates canonical facts.

ALTER TABLE public.product_oil_specs
  ADD COLUMN IF NOT EXISTS weight text,
  ADD COLUMN IF NOT EXISTS role_support text[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_oil_specs_weight_check'
  ) THEN
    ALTER TABLE public.product_oil_specs
      ADD CONSTRAINT product_oil_specs_weight_check
      CHECK (
        weight IS NULL
        OR weight IN ('light', 'medium', 'rich')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_oil_specs_role_support_check'
  ) THEN
    ALTER TABLE public.product_oil_specs
      ADD CONSTRAINT product_oil_specs_role_support_check
      CHECK (
        role_support IS NULL
        OR role_support <@ ARRAY[
          'pre_wash_fibre_treatment',
          'leave_on_fibre_conditioning',
          'dry_finish',
          'pre_heat_protection'
        ]::text[]
      );
  END IF;
END $$;

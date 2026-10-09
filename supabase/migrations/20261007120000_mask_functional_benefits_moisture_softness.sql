-- Additive: masks get the non-specialized care chip `moisture_softness`
-- (ruled 2026-10-07). Existing values stay allowed.
ALTER TABLE public.product_mask_specs
  DROP CONSTRAINT IF EXISTS product_mask_specs_functional_benefits_check;

ALTER TABLE public.product_mask_specs
  ADD CONSTRAINT product_mask_specs_functional_benefits_check
  CHECK (
    functional_benefits IS NULL
    OR functional_benefits <@ ARRAY[
      'smoothing_frizz_control',
      'detangling_slip',
      'shine',
      'moisture_softness'
    ]::text[]
  );

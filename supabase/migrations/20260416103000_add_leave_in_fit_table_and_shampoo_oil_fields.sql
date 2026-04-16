CREATE TABLE IF NOT EXISTS public.product_leave_in_fit_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text NOT NULL CHECK (weight IN ('light', 'medium', 'rich')),
  conditioner_relationship text NOT NULL CHECK (
    conditioner_relationship IN ('replacement_capable', 'booster_only')
  ),
  care_benefits text[] NOT NULL DEFAULT '{}'
    CHECK (
      care_benefits <@ ARRAY[
        'heat_protect',
        'curl_definition',
        'repair',
        'detangle_smooth'
      ]::text[]
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_fit_specs_weight
  ON public.product_leave_in_fit_specs (weight);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_fit_specs_conditioner_relationship
  ON public.product_leave_in_fit_specs (conditioner_relationship);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_fit_specs_care_benefits
  ON public.product_leave_in_fit_specs USING gin (care_benefits);

DROP TRIGGER IF EXISTS set_updated_at_product_leave_in_fit_specs ON public.product_leave_in_fit_specs;
CREATE TRIGGER set_updated_at_product_leave_in_fit_specs
  BEFORE UPDATE ON public.product_leave_in_fit_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_leave_in_fit_specs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.product_shampoo_specs
  ADD COLUMN IF NOT EXISTS scalp_route text,
  ADD COLUMN IF NOT EXISTS cleansing_intensity text;

ALTER TABLE public.product_shampoo_specs
  DROP CONSTRAINT IF EXISTS product_shampoo_specs_scalp_route_check;

ALTER TABLE public.product_shampoo_specs
  ADD CONSTRAINT product_shampoo_specs_scalp_route_check
  CHECK (
    scalp_route IS NULL
    OR scalp_route IN ('oily', 'balanced', 'dry', 'dandruff', 'dry_flakes', 'irritated')
  );

ALTER TABLE public.product_shampoo_specs
  DROP CONSTRAINT IF EXISTS product_shampoo_specs_cleansing_intensity_check;

ALTER TABLE public.product_shampoo_specs
  ADD CONSTRAINT product_shampoo_specs_cleansing_intensity_check
  CHECK (
    cleansing_intensity IS NULL
    OR cleansing_intensity IN ('gentle', 'regular', 'clarifying')
  );

CREATE INDEX IF NOT EXISTS idx_product_shampoo_specs_scalp_route
  ON public.product_shampoo_specs (scalp_route);

CREATE INDEX IF NOT EXISTS idx_product_shampoo_specs_cleansing_intensity
  ON public.product_shampoo_specs (cleansing_intensity);

ALTER TABLE public.product_oil_eligibility
  ADD COLUMN IF NOT EXISTS oil_purpose text;

ALTER TABLE public.product_oil_eligibility
  DROP CONSTRAINT IF EXISTS product_oil_eligibility_oil_purpose_check;

ALTER TABLE public.product_oil_eligibility
  ADD CONSTRAINT product_oil_eligibility_oil_purpose_check
  CHECK (
    oil_purpose IS NULL
    OR oil_purpose IN ('pre_wash_oiling', 'styling_finish', 'light_finish')
  );

CREATE INDEX IF NOT EXISTS idx_product_oil_eligibility_oil_purpose
  ON public.product_oil_eligibility (oil_purpose);

ALTER TABLE public.product_mask_specs
  ADD COLUMN IF NOT EXISTS repair_support_level text,
  ADD COLUMN IF NOT EXISTS functional_benefits text[];

ALTER TABLE public.product_mask_specs
  DROP CONSTRAINT IF EXISTS product_mask_specs_repair_support_level_check;

ALTER TABLE public.product_mask_specs
  ADD CONSTRAINT product_mask_specs_repair_support_level_check
  CHECK (
    repair_support_level IS NULL
    OR repair_support_level IN ('low', 'medium', 'high')
  );

ALTER TABLE public.product_mask_specs
  DROP CONSTRAINT IF EXISTS product_mask_specs_functional_benefits_check;

ALTER TABLE public.product_mask_specs
  ADD CONSTRAINT product_mask_specs_functional_benefits_check
  CHECK (
    functional_benefits IS NULL
    OR functional_benefits <@ ARRAY[
      'smoothing_frizz_control',
      'detangling_slip',
      'shine'
    ]::text[]
  );

CREATE INDEX IF NOT EXISTS idx_product_mask_specs_repair_support_level
  ON public.product_mask_specs (repair_support_level);

CREATE INDEX IF NOT EXISTS idx_product_mask_specs_functional_benefits
  ON public.product_mask_specs USING gin (functional_benefits);

ALTER TABLE public.product_leave_in_specs
  ADD COLUMN IF NOT EXISTS care_direction text,
  ADD COLUMN IF NOT EXISTS repair_support_level text,
  ADD COLUMN IF NOT EXISTS plan_roles text[],
  ADD COLUMN IF NOT EXISTS functional_benefits text[];

ALTER TABLE public.product_leave_in_specs
  DROP CONSTRAINT IF EXISTS product_leave_in_specs_care_direction_check;

ALTER TABLE public.product_leave_in_specs
  ADD CONSTRAINT product_leave_in_specs_care_direction_check
  CHECK (
    care_direction IS NULL
    OR care_direction IN ('moisture', 'balanced', 'protein')
  );

ALTER TABLE public.product_leave_in_specs
  DROP CONSTRAINT IF EXISTS product_leave_in_specs_repair_support_level_check;

ALTER TABLE public.product_leave_in_specs
  ADD CONSTRAINT product_leave_in_specs_repair_support_level_check
  CHECK (
    repair_support_level IS NULL
    OR repair_support_level IN ('low', 'medium', 'high')
  );

ALTER TABLE public.product_leave_in_specs
  DROP CONSTRAINT IF EXISTS product_leave_in_specs_plan_roles_check;

ALTER TABLE public.product_leave_in_specs
  ADD CONSTRAINT product_leave_in_specs_plan_roles_check
  CHECK (
    plan_roles IS NULL
    OR plan_roles <@ ARRAY[
      'post_wash_leave_in',
      'pre_heat_application'
    ]::text[]
  );

ALTER TABLE public.product_leave_in_specs
  DROP CONSTRAINT IF EXISTS product_leave_in_specs_functional_benefits_plan_check;

ALTER TABLE public.product_leave_in_specs
  ADD CONSTRAINT product_leave_in_specs_functional_benefits_plan_check
  CHECK (
    functional_benefits IS NULL
    OR functional_benefits <@ ARRAY[
      'detangle',
      'moisture_softness',
      'smooth_anti_frizz',
      'heat_protect',
      'repair_support',
      'curl_shape_support',
      'shine_support'
    ]::text[]
  );

CREATE INDEX IF NOT EXISTS idx_product_leave_in_specs_care_direction
  ON public.product_leave_in_specs (care_direction);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_specs_repair_support_level
  ON public.product_leave_in_specs (repair_support_level);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_specs_plan_roles
  ON public.product_leave_in_specs USING gin (plan_roles);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_specs_functional_benefits_plan
  ON public.product_leave_in_specs USING gin (functional_benefits);

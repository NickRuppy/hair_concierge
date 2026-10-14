-- Catalogue authority Task 3, structural repair slice.
--
-- This migration promotes only semantics that are already deterministic in
-- the canonical Leave-in row and adds the four indexes demonstrated by the
-- live FK advisor. It does not apply evidence-sensitive product repairs and it
-- deliberately leaves Task 2's historical constraints NOT VALID until every
-- reviewed repair manifest has a clean receipt.

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.product_leave_in_fit_specs AS legacy
    JOIN public.product_leave_in_specs AS canonical USING (product_id)
    WHERE legacy.weight IS DISTINCT FROM canonical.weight
  ) THEN
    RAISE EXCEPTION
      'catalogue authority repair: legacy Leave-in weight conflicts with canonical authority';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.product_leave_in_fit_specs AS legacy
    JOIN public.product_leave_in_specs AS canonical USING (product_id)
    WHERE legacy.conditioner_relationship IS DISTINCT FROM
      CASE
        WHEN 'replacement_conditioner' = ANY (canonical.roles)
          THEN 'replacement_capable'
        ELSE 'booster_only'
      END
  ) THEN
    RAISE EXCEPTION
      'catalogue authority repair: legacy Leave-in conditioner relationship conflicts with canonical roles';
  END IF;
END;
$preflight$;

-- Existing contradictory rows are repaired through reviewed manifests. New
-- writes cannot create another product that is simultaneously recommendable
-- and unavailable to every canonical catalogue reader.
ALTER TABLE public.products
  ADD CONSTRAINT products_recommendable_requires_active_check
    CHECK (
      NOT is_chaarlie_recommended
      OR (is_active AND lifecycle_status = 'active')
    ) NOT VALID;

ALTER TABLE public.product_leave_in_specs
  ADD COLUMN conditioner_relationship text
    GENERATED ALWAYS AS (
      CASE
        WHEN 'replacement_conditioner' = ANY (roles)
          THEN 'replacement_capable'
        ELSE 'booster_only'
      END
    ) STORED,
  ADD CONSTRAINT product_leave_in_specs_conditioner_relationship_check
    CHECK (conditioner_relationship IN ('replacement_capable', 'booster_only'));

COMMENT ON COLUMN public.product_leave_in_specs.conditioner_relationship IS
  'Canonical projection derived from roles. The legacy fit table remains compatibility-only until contract removal.';

CREATE INDEX product_shampoo_specs_identity_thickness_idx
  ON public.product_shampoo_specs (product_id, category_key, thickness);

CREATE INDEX product_conditioner_specs_identity_thickness_idx
  ON public.product_conditioner_specs (product_id, category_key, thickness);

CREATE INDEX product_leave_in_eligibility_identity_thickness_idx
  ON public.product_leave_in_eligibility (product_id, category_key, thickness);

CREATE INDEX product_oil_eligibility_identity_thickness_idx
  ON public.product_oil_eligibility (product_id, category_key, thickness);

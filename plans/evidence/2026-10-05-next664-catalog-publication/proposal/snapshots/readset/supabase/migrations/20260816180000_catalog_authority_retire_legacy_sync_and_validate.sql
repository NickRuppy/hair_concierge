-- Catalogue authority Task 3 closure: retire destructive legacy-derivation
-- triggers, align the last diverging legacy projection (Neqi Rosemary Oil),
-- and validate the deferred structural constraints on the now-clean catalogue.
--
-- The retired triggers rebuilt canonical category facts by DELETE + re-derive
-- from the legacy products arrays. Canonical facts are authoritative and are
-- written directly by intake/enrichment; a legacy-array write must never be
-- able to destroy them. The transitional aa_/zz_ compat triggers from the
-- Task 2 migration remain: they only maintain the shared normalized
-- eligibility tables and never delete fact-backed rows.

-- 1. Retire the destructive legacy-derivation triggers and their functions.

DROP TRIGGER IF EXISTS trg_sync_product_oil_eligibility ON public.products;
DROP FUNCTION IF EXISTS public.sync_product_oil_eligibility_from_products();

DROP TRIGGER IF EXISTS trg_sync_product_conditioner_specs ON public.products;
DROP FUNCTION IF EXISTS public.sync_product_conditioner_specs_from_products();

DROP TRIGGER IF EXISTS trg_sync_product_leave_in_eligibility_from_products ON public.products;
DROP FUNCTION IF EXISTS public.sync_product_leave_in_eligibility_from_products();

DROP TRIGGER IF EXISTS trg_sync_product_leave_in_eligibility_from_specs ON public.product_leave_in_specs;
DROP FUNCTION IF EXISTS public.sync_product_leave_in_eligibility_from_specs();

DROP FUNCTION IF EXISTS public.rebuild_product_leave_in_eligibility(uuid);

-- 2. Align the last diverging legacy projection with canonical authority.
-- Canonical eligibility (fine/normal/coarse) is the reviewed source of truth;
-- the legacy array on the product row was empty. Guarded and idempotent.

DO $neqi$
DECLARE
  oil_rows integer;
BEGIN
  UPDATE public.products
  SET suitable_thicknesses = ARRAY['fine', 'normal', 'coarse']
  WHERE id = '010cf825-4892-4f78-bf20-26ad72122c60'
    AND category_key = 'oil'
    AND suitable_thicknesses IS DISTINCT FROM ARRAY['fine', 'normal', 'coarse'];

  IF NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE id = '010cf825-4892-4f78-bf20-26ad72122c60'
      AND category_key = 'oil'
      AND suitable_thicknesses = ARRAY['fine', 'normal', 'coarse']
  ) THEN
    RAISE EXCEPTION 'catalogue authority: Neqi legacy projection sync failed';
  END IF;

  SELECT count(*) INTO oil_rows
  FROM public.product_oil_eligibility
  WHERE product_id = '010cf825-4892-4f78-bf20-26ad72122c60';
  IF oil_rows <> 3 THEN
    RAISE EXCEPTION
      'catalogue authority: canonical Oil eligibility was altered (% rows, expected 3)', oil_rows;
  END IF;
END;
$neqi$;

-- 3. Validate the deferred structural constraints. Each VALIDATE scans the
-- historical rows and aborts the migration if any violation remains, so this
-- only succeeds on the audited-clean catalogue.

ALTER TABLE public.products
  VALIDATE CONSTRAINT products_recommendable_requires_active_check;
ALTER TABLE public.products
  VALIDATE CONSTRAINT products_category_key_not_null_check;

ALTER TABLE public.product_thickness_eligibility
  VALIDATE CONSTRAINT product_thickness_eligibility_product_category_fkey;
ALTER TABLE public.product_concern_eligibility
  VALIDATE CONSTRAINT product_concern_eligibility_product_category_fkey;

ALTER TABLE public.product_shampoo_specs
  VALIDATE CONSTRAINT product_shampoo_specs_thickness_eligibility_fkey;
ALTER TABLE public.product_conditioner_specs
  VALIDATE CONSTRAINT product_conditioner_specs_thickness_eligibility_fkey;
ALTER TABLE public.product_leave_in_eligibility
  VALIDATE CONSTRAINT product_leave_in_eligibility_thickness_eligibility_fkey;
ALTER TABLE public.product_oil_eligibility
  VALIDATE CONSTRAINT product_oil_eligibility_thickness_eligibility_fkey;

-- 4. Promote category identity to a column contract and drop the now
-- redundant validated check, per the Task 3 completion contract.

ALTER TABLE public.products
  ALTER COLUMN category_key SET NOT NULL;
ALTER TABLE public.products
  DROP CONSTRAINT products_category_key_not_null_check;

-- Data-only cleanup: keep the internal key `conditioner`, but use the active
-- user-facing German category label `Conditioner`.

UPDATE public.product_categories
SET
  display_name_de = 'Conditioner',
  updated_at = now()
WHERE key = 'conditioner'
  AND display_name_de IS DISTINCT FROM 'Conditioner';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products legacy
    JOIN public.products existing
      ON existing.name = legacy.name
      AND existing.category = 'Conditioner'
      AND existing.id <> legacy.id
    WHERE legacy.category = 'Conditioner (Drogerie)'
      AND legacy.is_active = true
      AND legacy.lifecycle_status = 'active'
  ) THEN
    RAISE EXCEPTION 'Cannot rename active conditioner products because the target category would violate products_name_category_unique';
  END IF;
END $$;

UPDATE public.products
SET
  category = 'Conditioner',
  updated_at = now()
WHERE category = 'Conditioner (Drogerie)'
  AND is_active = true
  AND lifecycle_status = 'active';

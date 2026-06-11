ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_link_status text,
  ADD COLUMN IF NOT EXISTS purchase_link_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS price_checked_at timestamptz;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_purchase_link_status_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_purchase_link_status_check
  CHECK (
    purchase_link_status IS NULL
    OR purchase_link_status IN ('available', 'unavailable')
  );

-- Minimal non-customer reference data required by the Personal Plan pgTAP
-- fixtures. Product and user rows remain synthetic and test-owned.
INSERT INTO public.product_categories (
  key,
  display_name_de,
  is_catalog_supported,
  is_intake_supported,
  sort_order
)
VALUES
  ('shampoo', 'Shampoo', true, true, 10),
  ('conditioner', 'Conditioner (Drogerie)', true, true, 20),
  ('heat_protectant', 'Hitzeschutz', false, false, 90)
ON CONFLICT (key) DO UPDATE
SET
  display_name_de = EXCLUDED.display_name_de,
  is_catalog_supported = EXCLUDED.is_catalog_supported,
  is_intake_supported = EXCLUDED.is_intake_supported,
  sort_order = EXCLUDED.sort_order;

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

-- Canonical parents required by the catalog-enrichment migration's exact
-- child-line seeds. Production already owns these IDs; the frozen test baseline
-- intentionally contains no production catalog rows, so the harness supplies
-- only the two parent identities needed to exercise the fail-closed migration.
INSERT INTO public.brands (id, canonical_name, normalized_name)
VALUES
  (
    '525123e1-1376-4fca-91b0-4eeb99c0bc50'::uuid,
    'L''Oréal Paris',
    'loreal paris'
  ),
  (
    '354b561c-5a0f-400c-8d89-39bc7231876b'::uuid,
    'Head & Shoulders',
    'head shoulders'
  )
ON CONFLICT (id) DO UPDATE
SET
  canonical_name = EXCLUDED.canonical_name,
  normalized_name = EXCLUDED.normalized_name;

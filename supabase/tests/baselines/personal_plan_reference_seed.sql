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
  ('mask', 'Maske', true, true, 30),
  ('heat_protectant', 'Hitzeschutz', false, false, 90)
ON CONFLICT (key) DO UPDATE
SET
  display_name_de = EXCLUDED.display_name_de,
  is_catalog_supported = EXCLUDED.is_catalog_supported,
  is_intake_supported = EXCLUDED.is_intake_supported,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.products (
  id,
  name,
  brand,
  category,
  affiliate_link,
  is_active,
  lifecycle_status,
  category_key,
  origin,
  is_chaarlie_recommended,
  purchase_link_status
)
VALUES
  (
    'c4b9eaef-dfeb-41ea-9d28-9901660406b7',
    'Bali Curls Haarkur Bonding Repair Overnight Elixir',
    'Bali Curls',
    'Maske',
    'https://www.dm.de/p/d/3120062/bali-curls-haarkur-bonding-repair-overnight-elixir',
    true,
    'active',
    'mask',
    'curated',
    true,
    'available'
  ),
  (
    'd0e4bc78-2aeb-4e88-8abf-08aa28fbfba4',
    'Bali Curls Deep Hydration Mask',
    'Bali Curls',
    'Maske',
    'https://www.rossmann.de/de/pflege-und-duft-bali-curls-deep-hydration-mask/p/4262391990001',
    true,
    'active',
    'mask',
    'curated',
    true,
    'available'
  ),
  (
    '29fc985e-3b7e-4567-b7bc-b416583139fe',
    'Balea Natural Beauty reparierend',
    'Balea',
    'Maske',
    'https://www.dm.de/p/d/1674120/balea-natural-beauty-haarmaske-reparierend',
    true,
    'active',
    'mask',
    'curated',
    true,
    'available'
  ),
  (
    '077a94ae-fede-4773-9435-17022c2b89c0',
    'Pantene Keratin Repair & Care',
    'Pantene',
    'Maske',
    'https://www.dm.de/p/d/1523350/pantene-pro-v-haarmaske-keratin-repair-und-care',
    true,
    'active',
    'mask',
    'curated',
    true,
    'available'
  ),
  (
    'b2e7e679-a6ba-4ba3-93d7-1fd35f6e6c75',
    'Wahre Schätze Avocado',
    'Wahre Schätze',
    'Maske',
    'https://www.dm.de/p/d/1679236/wahre-schaetze-haarkur-1-minute-avocado-oel-und-sheabutter',
    true,
    'active',
    'mask',
    'curated',
    true,
    'available'
  ),
  (
    '1568b623-f411-4ed6-a89f-e797bb1b48f5',
    'Alterra Haarkur Bio-Granatapfel & Bio-Aloe Vera',
    'Alterra',
    'Maske',
    'https://www.rossmann.de/de/pflege-und-duft-alterra-haarkur-bio-granatapfel/p/4305615307794',
    true,
    'active',
    'mask',
    'curated',
    true,
    'available'
  );

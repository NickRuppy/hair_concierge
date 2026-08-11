-- Correct the Mask identities that drifted from their current exact
-- commercial products. The Bali overnight elixir is deliberately retained as
-- an inactive historical row: it is a leave-on treatment, not a rinse-out Mask.

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.products
    WHERE category_key = 'mask'
      AND id IN (
        'c4b9eaef-dfeb-41ea-9d28-9901660406b7',
        'd0e4bc78-2aeb-4e88-8abf-08aa28fbfba4',
        '29fc985e-3b7e-4567-b7bc-b416583139fe',
        '077a94ae-fede-4773-9435-17022c2b89c0',
        'b2e7e679-a6ba-4ba3-93d7-1fd35f6e6c75',
        '1568b623-f411-4ed6-a89f-e797bb1b48f5'
      )
  ) <> 6 THEN
    RAISE EXCEPTION 'mask_catalog_identity_precondition_failed: expected six reviewed Mask rows';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.product_identifiers identifier
    JOIN (
      VALUES
        ('d0e4bc78-2aeb-4e88-8abf-08aa28fbfba4'::uuid, '4262391990001'::text),
        ('29fc985e-3b7e-4567-b7bc-b416583139fe'::uuid, '4070765053357'::text),
        ('077a94ae-fede-4773-9435-17022c2b89c0'::uuid, '8700216502672'::text),
        ('b2e7e679-a6ba-4ba3-93d7-1fd35f6e6c75'::uuid, '3600542510127'::text),
        ('1568b623-f411-4ed6-a89f-e797bb1b48f5'::uuid, '4068134014122'::text)
    ) AS expected(product_id, gtin) ON expected.product_id = identifier.product_id
    WHERE identifier.identifier_type IN ('gtin', 'ean', 'barcode')
      AND identifier.normalized_identifier_value <> expected.gtin
  ) THEN
    RAISE EXCEPTION 'mask_catalog_identity_precondition_failed: unexpected existing GTIN';
  END IF;
END;
$$;

UPDATE public.products
SET
  is_active = false,
  lifecycle_status = 'active',
  is_chaarlie_recommended = false,
  purchase_link_status = 'available',
  purchase_link_checked_at = now(),
  updated_at = now()
WHERE id = 'c4b9eaef-dfeb-41ea-9d28-9901660406b7'
  AND category_key = 'mask';

UPDATE public.products
SET
  name = 'Bali Curls Deep Repair Mask',
  brand = 'Bali Curls',
  affiliate_link = 'https://www.dm.de/p/d/3106327/bali-curls-haarmaske-deep-repair',
  purchase_link_status = 'available',
  purchase_link_checked_at = now(),
  updated_at = now()
WHERE id = 'd0e4bc78-2aeb-4e88-8abf-08aa28fbfba4'
  AND category_key = 'mask';

UPDATE public.products
SET
  name = 'Balea Haarkur reparierend',
  affiliate_link = 'https://www.dm.de/p/d/1674120/balea-haarkur-reparierend',
  price_eur = 2.45,
  purchase_link_status = 'available',
  purchase_link_checked_at = now(),
  price_checked_at = now(),
  updated_at = now()
WHERE id = '29fc985e-3b7e-4567-b7bc-b416583139fe'
  AND category_key = 'mask';

UPDATE public.products
SET
  name = 'PANTENE PRO-V Haarmaske Keratin Repair & Care',
  affiliate_link = 'https://www.dm.de/p/d/1523350/pantene-pro-v-haarmaske-keratin-repair-und-care',
  price_eur = 4.45,
  purchase_link_status = 'available',
  purchase_link_checked_at = now(),
  price_checked_at = now(),
  updated_at = now()
WHERE id = '077a94ae-fede-4773-9435-17022c2b89c0'
  AND category_key = 'mask';

UPDATE public.products
SET
  name = 'Wahre Schätze Haarkur 1-Minute Avocado-Öl & Sheabutter',
  affiliate_link = 'https://www.dm.de/p/d/1679236/wahre-schaetze-haarkur-1-minute-avocado-oel-und-sheabutter',
  price_eur = 4.95,
  purchase_link_status = 'available',
  purchase_link_checked_at = now(),
  price_checked_at = now(),
  updated_at = now()
WHERE id = 'b2e7e679-a6ba-4ba3-93d7-1fd35f6e6c75'
  AND category_key = 'mask';

UPDATE public.products
SET
  name = 'Alterra Intensiv Repair Haarmaske Feuchtigkeit',
  affiliate_link = 'https://www.rossmann.de/de/pflege-und-duft-alterra-haarmaske/p/4068134014122',
  purchase_link_status = 'available',
  purchase_link_checked_at = now(),
  updated_at = now()
WHERE id = '1568b623-f411-4ed6-a89f-e797bb1b48f5'
  AND category_key = 'mask';

INSERT INTO public.product_identifiers (
  product_id,
  identifier_type,
  identifier_value,
  source
)
SELECT
  identity.product_id,
  'gtin',
  identity.gtin,
  identity.source
FROM (
  VALUES
    (
      'd0e4bc78-2aeb-4e88-8abf-08aa28fbfba4'::uuid,
      '4262391990001'::text,
      'https://www.dm.de/p/d/3106327/bali-curls-haarmaske-deep-repair'::text
    ),
    (
      '29fc985e-3b7e-4567-b7bc-b416583139fe'::uuid,
      '4070765053357'::text,
      'https://www.dm.de/p/d/1674120/balea-haarkur-reparierend'::text
    ),
    (
      '077a94ae-fede-4773-9435-17022c2b89c0'::uuid,
      '8700216502672'::text,
      'https://www.dm.de/p/d/1523350/pantene-pro-v-haarmaske-keratin-repair-und-care'::text
    ),
    (
      'b2e7e679-a6ba-4ba3-93d7-1fd35f6e6c75'::uuid,
      '3600542510127'::text,
      'https://www.dm.de/p/d/1679236/wahre-schaetze-haarkur-1-minute-avocado-oel-und-sheabutter'::text
    ),
    (
      '1568b623-f411-4ed6-a89f-e797bb1b48f5'::uuid,
      '4068134014122'::text,
      'https://www.rossmann.de/de/pflege-und-duft-alterra-haarmaske/p/4068134014122'::text
    )
) AS identity(product_id, gtin, source)
JOIN public.products product ON product.id = identity.product_id
ON CONFLICT (product_id, identifier_type, normalized_identifier_value)
DO UPDATE SET
  identifier_value = EXCLUDED.identifier_value,
  source = EXCLUDED.source,
  updated_at = now();

BEGIN;

UPDATE public.products
SET
  name = 'Guhl Panthenol + Reparatur 2in1 Kur & Spülung',
  affiliate_link = 'https://www.mueller.de/p/guhl-panthenol-reparatur-2in1-kur-spuelung-IPN3052207/',
  price_eur = 4.95,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = '11d42d9d-b8d8-42ae-a432-9a3d0f9d3504';

UPDATE public.products
SET
  price_eur = 34.00,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = '4827c174-92e9-4121-ab70-843d5c037ad0';

DELETE FROM public.product_conditioner_specs
WHERE product_id = '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0';

DELETE FROM public.product_conditioner_rerank_specs
WHERE product_id = '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0';

UPDATE public.products
SET
  name = 'Gliss Ultimate Repair Sprüh-Conditioner',
  category = 'Leave-in',
  affiliate_link = 'https://www.rossmann.de/de/pflege-und-duft-gliss-ultimate-repair-express-repair-spuelung/p/4015100813494',
  price_eur = 4.49,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  tags = (
    SELECT array_agg(DISTINCT tag ORDER BY tag)
    FROM unnest(
      COALESCE(public.products.tags, ARRAY[]::text[])
      || ARRAY['leave-in', 'spray', 'hitzeschutz', 'repair']::text[]
    ) AS merged_tags(tag)
  ),
  updated_at = now()
WHERE id = '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0';

INSERT INTO public.product_leave_in_fit_specs (
  product_id,
  weight,
  conditioner_relationship,
  care_benefits,
  updated_at
)
VALUES (
  '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0',
  'light',
  'booster_only',
  ARRAY['heat_protect', 'repair', 'detangle_smooth']::text[],
  now()
)
ON CONFLICT (product_id) DO UPDATE
SET
  weight = EXCLUDED.weight,
  conditioner_relationship = EXCLUDED.conditioner_relationship,
  care_benefits = EXCLUDED.care_benefits,
  updated_at = now();

INSERT INTO public.product_leave_in_specs (
  product_id,
  format,
  weight,
  roles,
  provides_heat_protection,
  heat_protection_max_c,
  heat_activation_required,
  care_benefits,
  ingredient_flags,
  application_stage,
  updated_at
)
VALUES (
  '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0',
  'spray',
  'light',
  ARRAY['styling_prep']::text[],
  true,
  230,
  false,
  ARRAY['repair', 'detangling', 'anti_frizz']::text[],
  ARRAY['silicones', 'polymers']::text[],
  ARRAY['towel_dry', 'pre_heat']::text[],
  now()
)
ON CONFLICT (product_id) DO UPDATE
SET
  format = EXCLUDED.format,
  weight = EXCLUDED.weight,
  roles = EXCLUDED.roles,
  provides_heat_protection = EXCLUDED.provides_heat_protection,
  heat_protection_max_c = EXCLUDED.heat_protection_max_c,
  heat_activation_required = EXCLUDED.heat_activation_required,
  care_benefits = EXCLUDED.care_benefits,
  ingredient_flags = EXCLUDED.ingredient_flags,
  application_stage = EXCLUDED.application_stage,
  updated_at = now();

UPDATE public.products
SET
  price_eur = missing_prices.price_eur,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
FROM (
  VALUES
    ('a1d705b4-b973-486d-b853-2c795b6db681'::uuid, 26.99),
    ('514ffd65-e4a5-4f7f-96c5-0f194e3b3b36'::uuid, 34.19),
    ('6513692a-b54f-4acc-9c77-5799d3dd200c'::uuid, 32.20),
    ('6d6c3ff2-9d12-4f27-a56f-b5b72cf53318'::uuid, 25.67)
) AS missing_prices(id, price_eur)
WHERE public.products.id = missing_prices.id;

UPDATE public.products
SET
  affiliate_link = 'https://www.notino.de/moroccanoil/clarify-tiefenreinigendes-shampoo-fur-strapaziertes-und-beschdigtes-haar/',
  price_eur = 29.00,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = 'caa94951-57d9-441d-bd46-5d7debbf365f';

UPDATE public.products
SET
  affiliate_link = 'https://www.rossmann.de/de/pflege-und-duft-got2b-trockenshampoo-trocken-waesche-extra-volumen/p/4015100800227',
  price_eur = 3.99,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = '2b2161a2-6c09-435f-adbb-49da44d434ae';

UPDATE public.products
SET
  purchase_link_status = 'unavailable',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = '3c769f60-283f-48c3-9549-cf84b73115d7';

UPDATE public.products
SET
  affiliate_link = olaplex_updates.affiliate_link,
  price_eur = olaplex_updates.price_eur,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
FROM (
  VALUES
    (
      'aadbbab5-bcf5-4b46-b38a-5533648bcb1d'::uuid,
      'https://olaplex.de/products/olaplex-no-0-intensive-bond-building-hair-treatment',
      30.00
    ),
    (
      '3dc24d67-e6c0-4239-a273-058a87d13553'::uuid,
      'https://olaplex.de/products/original-olaplex-n-3plus-complete-repair-treatment',
      34.00
    ),
    (
      '4827c174-92e9-4121-ab70-843d5c037ad0'::uuid,
      'https://olaplex.de/products/original-olaplex-n-5leave-in-conditioner',
      34.00
    ),
    (
      '4e99706a-2232-4ee6-ba1b-9ca1029a7364'::uuid,
      'https://olaplex.de/products/olaplex-no-6-bond-smoother',
      32.00
    ),
    (
      '7d8c0150-778d-4cb9-abf5-bfc16ad93b12'::uuid,
      'https://olaplex.de/products/olaplex-no-7-bonding-oil',
      32.00
    )
) AS olaplex_updates(id, affiliate_link, price_eur)
WHERE public.products.id = olaplex_updates.id;

UPDATE public.products
SET
  affiliate_link = 'https://www.douglas.de/de/p/m001643012',
  price_eur = 29.99,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = '7f5207e6-d281-416e-922c-3135dd9a8cc8';

UPDATE public.products
SET
  affiliate_link = 'https://de.davines.com/products/solu-shampoo',
  price_eur = 25.00,
  price_checked_at = '2026-06-09T00:00:00Z',
  purchase_link_status = 'unavailable',
  purchase_link_checked_at = '2026-06-09T00:00:00Z',
  updated_at = now()
WHERE id = 'd0936238-7412-40bc-ba7a-3c268f17d0f4';

UPDATE public.products
SET
  affiliate_link = bucket_3b_updates.affiliate_link,
  price_eur = bucket_3b_updates.price_eur,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  updated_at = now()
FROM (
  VALUES
    (
      '50951ef2-e16a-4a51-85c5-a709aa64c03a'::uuid,
      'https://www.flaconi.de/haare/maria-nila/coils-and-curls/maria-nila-coils-and-curls-oil-in-cream-leave-in-treatment.html',
      31.00
    ),
    (
      '695414e1-3435-4304-943b-76677408980c'::uuid,
      'https://www.flaconi.de/haare/maria-nila/structure-repair/maria-nila-structure-repair-leave-in-treatment.html',
      32.00
    ),
    (
      '648ba537-5180-440e-81ad-2b310b447d87'::uuid,
      'https://eu.curlsmith.com/products/hydrate-plump-leave-in',
      25.00
    ),
    (
      '8715f0f5-9104-46ec-b450-e73f1441c1fa'::uuid,
      'https://eu.curlsmith.com/products/weightless-air-dry-cream',
      25.00
    ),
    (
      '5767f7a6-757c-40fa-b990-8e0a1abaea17'::uuid,
      'https://de.nuxe.com/products/wichtiger-ol%C2%AE-1',
      38.90
    ),
    (
      'a7ff335a-7e81-4cf4-9c20-9209bff4386b'::uuid,
      'https://www.rossmann.de/de/pflege-und-duft-neqi-moisture-mystery-shampoo/p/4063528078285',
      8.99
    )
) AS bucket_3b_updates(id, affiliate_link, price_eur)
WHERE public.products.id = bucket_3b_updates.id;

UPDATE public.products
SET
  affiliate_link = bondbuilder_updates.affiliate_link,
  price_eur = bondbuilder_updates.price_eur,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  updated_at = now()
FROM (
  VALUES
    (
      '38dace91-0fba-49ee-a93f-ac36e488fe4b'::uuid,
      'https://www.douglas.de/de/p/5010334127',
      75.00
    ),
    (
      '917786d2-cf02-43d4-8a9f-7f872528d581'::uuid,
      'https://www.douglas.de/de/p/5011245021',
      30.00
    ),
    (
      'f8a63590-9d80-454a-8008-e2a56321e64c'::uuid,
      'https://epres-hair.de/artikeldetails/CONSUMERKIT.aspx',
      48.00
    )
) AS bondbuilder_updates(id, affiliate_link, price_eur)
WHERE public.products.id = bondbuilder_updates.id;

UPDATE public.products
SET
  price_eur = deep_cleansing_updates.price_eur,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  updated_at = now()
FROM (
  VALUES
    ('3f9328d8-1f6a-44e9-affd-fc219d1e691a'::uuid, 44.00),
    ('d105d245-5993-4b89-b45d-1bf0a86650e3'::uuid, 36.00),
    ('1a6e731e-8fb2-43b4-9f4c-2d7f6dd06dca'::uuid, 34.00),
    ('e937c8aa-fc99-4731-b848-e5bd988fcc17'::uuid, 32.00)
) AS deep_cleansing_updates(id, price_eur)
WHERE public.products.id = deep_cleansing_updates.id;

UPDATE public.products
SET
  price_eur = dry_shampoo_available_updates.price_eur,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  updated_at = now()
FROM (
  VALUES
    ('41e09958-5a1f-4997-b99b-f8384b7a8c0c'::uuid, 1.95),
    ('27fe4310-c1b8-4b02-a59e-cb9aa1f3314a'::uuid, 1.45),
    ('ff309c8a-ecd5-415c-9016-1b726c9fb3a4'::uuid, 3.95),
    ('d28643c8-c340-4514-826a-6c1ac8419fe9'::uuid, 3.95),
    ('6a1116a0-731f-46bb-9dd6-a0db89de5a13'::uuid, 3.95),
    ('786a1396-914e-4739-a32c-1c3ead39a3d1'::uuid, 3.75),
    ('57ec7a8e-aa1b-4260-81d6-7ec3dbc899b8'::uuid, 3.95),
    ('b5b595d2-9ba3-4c99-8f99-b2b79d29eb56'::uuid, 1.99)
) AS dry_shampoo_available_updates(id, price_eur)
WHERE public.products.id = dry_shampoo_available_updates.id;

UPDATE public.products
SET
  price_eur = 3.95,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'unavailable',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  updated_at = now()
WHERE id = 'dc8b8d4a-8ca9-452c-8d04-03b785b63275';

UPDATE public.products
SET
  name = mask_available_updates.name,
  brand = mask_available_updates.brand,
  affiliate_link = mask_available_updates.affiliate_link,
  price_eur = mask_available_updates.price_eur,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  is_active = true,
  updated_at = now()
FROM (
  VALUES
    (
      '1568b623-f411-4ed6-a89f-e797bb1b48f5'::uuid,
      'Alterra',
      'Alterra Haarkur Bio-Granatapfel & Bio-Aloe Vera',
      'https://www.rossmann.de/de/pflege-und-duft-alterra-haarkur-bio-granatapfel-und-bio-aloe-vera/p/4305615307794',
      2.79
    ),
    (
      'd5d67009-7aac-4299-938b-7218b8635a0c'::uuid,
      'Balea',
      'Balea 3 in 1 Intensivmaske',
      'https://www.dm.de/balea-haarmaske-3in1-intensivpflege-p4066447237443.html',
      1.95
    ),
    (
      'f212a8ff-0a03-404a-aad5-773d5bb6f7c9'::uuid,
      'Balea',
      'Balea Natural Beauty 3in1 Locken',
      'https://www.dm.de/p/d/1457506/balea-haarmaske-3in1-natural-beauty-locken',
      2.45
    ),
    (
      '29fc985e-3b7e-4567-b7bc-b416583139fe'::uuid,
      'Balea',
      'Balea Natural Beauty reparierend',
      'https://www.dm.de/balea-natural-beauty-haarmaske-reparierend-p4066447239072.html',
      2.45
    ),
    (
      '9d7141bf-bb7e-41e8-a206-38ee5c42fdc6'::uuid,
      'Balea',
      'Balea Professional Plex Care 2in1',
      'https://www.dm.de/p/d/1690411/balea-professional-haarmaske-plex-care-2in1',
      2.75
    ),
    (
      '1f3920fe-c91e-4298-a40e-99dccd13ea30'::uuid,
      'Balea',
      'Balea Professional Glow & Shine',
      'https://www.dm.de/balea-professional-haarkur-glow-und-shine-p4067796166453.html',
      2.75
    ),
    (
      '55727898-2a5e-4f01-ace1-bd91521d98ab'::uuid,
      'Balea Aqua',
      'Balea Aqua Hyaluron 3 in 1',
      'https://www.dm.de/balea-professional-haarmaske-3in1-aqua-hyaluron-p4066447668315.html',
      2.75
    ),
    (
      'd0e4bc78-2aeb-4e88-8abf-08aa28fbfba4'::uuid,
      'Bali Curls',
      'Bali Curls Deep Hydration Mask',
      'https://www.rossmann.de/de/pflege-und-duft-bali-curls-deep-hydration-mask/p/4262391990001',
      8.99
    ),
    (
      '43232fe6-28b6-4f45-a09f-b1354e47b0be'::uuid,
      'Bali Curls',
      'Bali Curls SOS Protein Treatment',
      'https://www.rossmann.de/de/pflege-und-duft-bali-curls-total-repair-sos-protein-treatment/p/4262391991114',
      2.79
    ),
    (
      'c4b9eaef-dfeb-41ea-9d28-9901660406b7'::uuid,
      'Bali Curls',
      'Bali Curls Haarkur Bonding Repair Overnight Elixir',
      'https://www.dm.de/p/d/3120062/bali-curls-haarkur-bonding-repair-overnight-elixir',
      9.95
    ),
    (
      '52264c47-f339-49db-9fb2-207d1ad3b470'::uuid,
      'Fructis',
      'Fructis Hair Food Aloe Vera',
      'https://www.dm.de/garnier-fructis-haarmaske-aloe-vera-hair-food-3in1-trockenes-haar-p3600542511049.html',
      5.95
    ),
    (
      '9e1442c9-4ab8-4819-a851-66859a98ed80'::uuid,
      'Fructis',
      'Fructis Hair Food Papaya',
      'https://www.dm.de/garnier-fructis-haarkur-papaya-hair-food-3in1-maske-p3600542511100.html',
      5.95
    ),
    (
      'd9825ad6-f549-4b02-a62a-eaa3bf917936'::uuid,
      'Gliss',
      'Gliss Liquid Silk Glanz 4-in-1 Bonding Haarmaske',
      'https://www.dm.de/p/d/1431893/schwarzkopf-gliss-haarmaske-4in1-liquid-silk',
      5.75
    ),
    (
      'c7326c6b-6175-4ec2-865f-68baf476c986'::uuid,
      'Guhl',
      'Guhl 30 sec. Feuchtigkeit',
      'https://www.dm.de/guhl-haarkur-30-sek-feuchtigkeit-p4072600720097.html',
      2.95
    ),
    (
      '8ef172f7-8e95-4ac7-a6a9-235ad760155b'::uuid,
      'Guhl',
      'Guhl Panthenol + Reparatur 2in1 Kur & Spülung',
      'https://www.mueller.de/p/guhl-panthenol-reparatur-2in1-kur-spuelung-IPN3052207/',
      4.95
    ),
    (
      '7c057f58-3e9b-4347-b4c1-f04cc4213f94'::uuid,
      'Hask',
      'Hask Argan Oil Repairing Deep Conditioner',
      'https://www.hagel-shop.de/hask-argan-oil-repairing-deep-conditioner-sachet-50-ml.html',
      2.95
    ),
    (
      'b3932c84-d6e1-453d-b52e-bed1df190fed'::uuid,
      'Jean&Len',
      'Jean&Len Tiefenreparatur Haarkur',
      'https://www.rossmann.de/de/pflege-und-duft-jeanundlen-tiefenreparatur-haarkur/p/4262401737824',
      6.99
    ),
    (
      'bc6ab308-7b6e-4d72-92aa-313a43c9c77d'::uuid,
      'Neqi',
      'Neqi Build Boost',
      'https://www.dm.de/p/d/2972777/neqi-haarkur-treatment-treasures-build-boost',
      9.99
    ),
    (
      'b281d528-b312-4e44-98be-3e01f7e56644'::uuid,
      'Neqi',
      'Neqi Gloss Glaze',
      'https://www.dm.de/neqi-haarkur-treatment-treasures-gloss-glaze-p4063528086327.html',
      9.99
    ),
    (
      '22d41784-5fc6-40bb-a4dc-92841322f933'::uuid,
      'Neqi',
      'Neqi Peptide Power',
      'https://www.dm.de/neqi-haarkur-treatment-treasures-peptide-power-p4063528086297.html',
      9.99
    ),
    (
      'd33543b0-6011-45f1-9bb2-125289ac849a'::uuid,
      'Neqi',
      'Neqi Repair Reveal',
      'https://www.dm.de/neqi-haarkur-repair-reveal-p4063528078254.html',
      9.99
    ),
    (
      '7c1f2f42-3729-49fe-9f0d-e007b93a05c8'::uuid,
      'Pantene',
      'Pantene Bond Repair',
      'https://www.dm.de/pantene-pro-v-haarkur-miracles-bond-repair-intensive-haarmaske-p8700216173476.html',
      9.25
    ),
    (
      'a17d3783-2854-4911-bbfa-b2f3ef7f95a8'::uuid,
      'Pantene',
      'Pantene Hydra Glow',
      'https://www.dm.de/pantene-pro-v-haarmaske-miracles-hydra-glow-deep-hydration-p8700216173261.html',
      3.99
    ),
    (
      '077a94ae-fede-4773-9435-17022c2b89c0'::uuid,
      'Pantene',
      'Pantene Keratin Repair & Care',
      'https://www.dm.de/pantene-pro-v-haarmaske-keratin-repair-und-care-p5410076529674.html',
      4.55
    ),
    (
      '8df49303-e1c9-4519-9a5f-4f9bc276ab5a'::uuid,
      'Pomélo+Co',
      'Pomélo+Co Shine Therapy',
      'https://www.dm.de/p/d/3110549/pomelo-co-haarmaske-shine-therapy',
      9.99
    ),
    (
      '869abd97-a499-4f39-97e5-2722773e46ae'::uuid,
      'Sante',
      'Sante Intense Hydration',
      'https://www.rossmann.de/de/pflege-und-duft-sante-intense-hydration-haarmaske/p/4025089005896',
      6.99
    ),
    (
      '3ce9a9da-4d58-4a66-a424-f8818960b5dc'::uuid,
      'Schaebens',
      'Schaebens Argan-Öl Haarmaske',
      'https://www.dm.de/schaebens-haarmaske-arganoel-p4003573025018.html',
      1.49
    ),
    (
      'cce6346c-8c92-4a17-b39b-cc7f300e84de'::uuid,
      'Syoss',
      'Syoss Haarkur Lamination Intense Glaze',
      'https://www.dm.de/syoss-haarkur-lamination-intense-glaze-p4015100867213.html',
      7.95
    ),
    (
      '961e3935-f823-44e7-8601-900c62855d3d'::uuid,
      'Syoss',
      'Syoss Intense Keratin',
      'https://www.dm.de/syoss-haarmaske-intense-keratin-p4015100860863.html',
      4.49
    ),
    (
      'ea353b65-544d-48a8-a057-c3e733b66326'::uuid,
      'Wahre Schätze',
      'Wahre Schätze 1-Minute Haarkur Argan & Camelia Öl',
      'https://www.dm.de/wahre-schaetze-haarkur-1-minute-argan-und-camelia-oel-p3600542509572.html',
      4.95
    ),
    (
      'b2e7e679-a6ba-4ba3-93d7-1fd35f6e6c75'::uuid,
      'Wahre Schätze',
      'Wahre Schätze Avocado',
      'https://www.dm.de/wahre-schaetze-haarkur-avocado-p3600542369091.html',
      4.95
    )
) AS mask_available_updates(id, brand, name, affiliate_link, price_eur)
WHERE public.products.id = mask_available_updates.id;

UPDATE public.products
SET
  name = mask_unavailable_updates.name,
  price_eur = mask_unavailable_updates.price_eur,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'unavailable',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  is_active = true,
  updated_at = now()
FROM (
  VALUES
    (
      '7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9'::uuid,
      'Gliss Aqua Revive',
      4.75
    ),
    (
      '47795618-40e7-4ef6-8034-0fd8eb747575'::uuid,
      'Isana 3in1 Milchprotein & Mandel',
      0.69
    )
) AS mask_unavailable_updates(id, name, price_eur)
WHERE public.products.id = mask_unavailable_updates.id;

UPDATE public.products
SET
  affiliate_link = mask_merged_duplicates.affiliate_link,
  price_eur = mask_merged_duplicates.price_eur,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  is_active = false,
  updated_at = now()
FROM (
  VALUES
    (
      '4417217b-2843-47aa-8815-04a125b08341'::uuid,
      'https://www.dm.de/p/d/1690411/balea-professional-haarmaske-plex-care-2in1',
      2.75
    ),
    (
      '4e76bb70-b521-48e1-9708-4edc48b17c73'::uuid,
      'https://www.dm.de/p/d/1431893/schwarzkopf-gliss-haarmaske-4in1-liquid-silk',
      5.75
    )
) AS mask_merged_duplicates(id, affiliate_link, price_eur)
WHERE public.products.id = mask_merged_duplicates.id;

UPDATE public.product_mask_specs
SET
  balance_direction = 'protein',
  ingredient_flags = ARRAY['silicones']::text[],
  updated_at = now()
WHERE product_id = 'd9825ad6-f549-4b02-a62a-eaa3bf917936';

-- Reviewed Leave-in null-status bucket, based on the 2026-06-10 sheet
-- comparison and manual source review.
UPDATE public.products
SET
  name = 'Cantu Leave-In Repair Cream (legacy duplicate)',
  affiliate_link = 'https://www.dm.de/p/d/1685686/cantu-leave-in-haarkur-repair-creme',
  price_eur = 6.95,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  is_active = false,
  updated_at = now()
WHERE id = '7db2bb60-0af6-4198-adec-28fad13251a6';

UPDATE public.products
SET
  brand = leave_in_available_updates.brand,
  name = leave_in_available_updates.name,
  affiliate_link = leave_in_available_updates.affiliate_link,
  price_eur = leave_in_available_updates.price_eur,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  is_active = true,
  updated_at = now()
FROM (
  VALUES
    (
      '9b664b11-fd11-47e3-9b7e-76e34736b43e'::uuid,
      'Alcina',
      'Alcina Hyaluron 2.0',
      'https://www.hagel-shop.de/alcina-hyaluron-2-0-spray-125-ml.html',
      14.90
    ),
    (
      'f9595d2c-d86d-4bdb-9758-c98d1e213f3c'::uuid,
      'alverde',
      'alverde Leave-In Sprühkur Express 7in1',
      'https://www.dm.de/alverde-naturkosmetik-leave-in-spruehkur-express-7in1-p4067796199635.html',
      2.95
    ),
    (
      '43cb9fbf-4b04-4554-a86a-7cb168536233'::uuid,
      'Authentic Beauty Concept',
      'Authentic Beauty Concept Hydrate Spray',
      'https://www.hagel-shop.de/authentic-beauty-concept-hydrate-spray-conditioner-250-ml.html',
      36.60
    ),
    (
      'c6e80f39-20ba-401e-b041-6ee7c89a5996'::uuid,
      'Balea Aqua',
      'Balea Aqua Hyaluron 3in1',
      'https://www.dm.de/balea-professional-haarmaske-3in1-aqua-hyaluron-p4066447668315.html',
      2.75
    ),
    (
      'e3c4b607-8f81-462c-8a2b-e45c8b3a2976'::uuid,
      'Cantu',
      'Cantu Leave-In Repair Cream',
      'https://www.dm.de/p/d/1685686/cantu-leave-in-haarkur-repair-creme',
      6.95
    ),
    (
      '11a099f7-eabe-4bdb-bfd3-995f35cb6ee4'::uuid,
      'Color WOW',
      'Color WOW Money Mist',
      'https://www.douglas.de/de/p/5011499127',
      26.60
    ),
    (
      '2bafeb7e-6610-4efc-a8e8-a402071b2ed9'::uuid,
      'Curlsmith',
      'Curlsmith Multitasking Conditioner 3 in 1',
      'https://www.douglas.de/de/p/5011693052',
      20.95
    ),
    (
      '6b01025d-9e72-4514-b42e-bbb6065fbe1c'::uuid,
      'Elvital',
      'Elvital Öl Magique Midnight Serum',
      'https://www.dm.de/l-oreal-paris-elvital-haarserum-oel-magique-midnight-serum-p3600524135805.html',
      7.99
    ),
    (
      'b139d4e8-6f26-4096-a1b9-d9efcb02d2ec'::uuid,
      'EVO',
      'EVO Day of Grace Leave-In',
      'https://www.hagel-shop.de/evo-day-of-grace-pre-style-primer-200-ml-5826168.html',
      28.00
    ),
    (
      '42b9eba7-d0e3-4d02-ae2b-7a1612a561fe'::uuid,
      'EVO',
      'EVO Happy Campers',
      'https://www.douglas.de/de/p/5010334176',
      23.31
    ),
    (
      '118ebae1-b7a9-4a89-a2ff-6c31df28c4dc'::uuid,
      'EVO',
      'EVO Head Mistress',
      'https://www.douglas.de/de/p/5010334174',
      23.94
    ),
    (
      '0307c903-84f9-46b4-8f1f-a51c2b1f38ff'::uuid,
      'Garnier',
      'Garnier Hair Food Aloe Vera',
      'https://www.dm.de/garnier-fructis-haarmaske-aloe-vera-hair-food-3in1-trockenes-haar-p3600542511049.html',
      5.95
    ),
    (
      'a72d630d-547a-465f-9846-3006b38af0a2'::uuid,
      'Garnier',
      'Garnier Hair Food Macadamia',
      'https://www.dm.de/garnier-fructis-haarkur-macadamia-hair-food-3in1-maske-p3600542511612.html',
      5.95
    ),
    (
      '5a9f4b7b-69d9-4e9a-8bbd-2dfbae9a5df3'::uuid,
      'HASK',
      'HASK Keratin 5-in-1 Spray',
      'https://www.hagel-shop.de/hask-keratin-protein-smoothing-5in1-leave-in-conditioner-175-ml.html',
      7.95
    ),
    (
      '0b21f996-bb42-4b10-89bd-4881c4346d53'::uuid,
      'Isana',
      'Isana Feuchtigkeits Leave-In (Hyaluron)',
      'https://www.rossmann.de/de/pflege-und-duft-isana-professional-leave-in-conditioner-hyaluron-und-care/p/4305615946733',
      2.49
    ),
    (
      '696401be-16b5-4261-836f-28b57c1ecd59'::uuid,
      'It’s',
      'It’s a 10 Miracle Leave-In',
      'https://www.hagel-shop.de/it-s-a-10-miracle-leave-in-product-295-7-ml.html',
      44.00
    ),
    (
      '7d65ed50-898c-40c3-8865-ebe5688774c8'::uuid,
      'It’s',
      'It’s a 10 Miracle Leave-In Lite',
      'https://www.hagel-shop.de/it-s-a-10-miracle-leave-in-conditioner-lite-120-ml.html',
      23.00
    ),
    (
      '8f84eae5-222d-4bbf-9ab0-f30361882a95'::uuid,
      'K18',
      'K18 Hair Professional Molecular Repair Hair Mist',
      'https://www.douglas.de/de/p/m001995632',
      33.17
    ),
    (
      '6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid,
      'Kevin Murphy',
      'Kevin Murphy Young Again',
      'https://www.hagel-shop.de/kevin-murphy-young-again-leave-in-treatment-100-ml.html',
      43.00
    ),
    (
      '0756a919-5fab-4b6c-a5da-8cb810869b6f'::uuid,
      'Living Proof',
      'Living Proof Restore Repair Leave-In',
      'https://www.douglas.de/de/p/5011050022',
      25.00
    ),
    (
      '7a3d1d99-2ff4-49b9-b021-d5ec2bdb0fe6'::uuid,
      'Moroccanoil',
      'Moroccanoil All In One Leave In Conditioner',
      'https://www.douglas.de/de/p/5011481841',
      28.80
    ),
    (
      'e6896862-523b-42b3-967d-41cbd16acf64'::uuid,
      'Neqi',
      'Neqi Moisture Mystery',
      'https://www.dm.de/neqi-leave-in-creme-moisture-mystery-p4063528078346.html',
      9.95
    ),
    (
      '993f0e55-2450-4557-853d-e6e23ec0d1a9'::uuid,
      'OUAI',
      'OUAI Leave In Conditioner',
      'https://www.douglas.de/de/p/5002560059',
      25.25
    ),
    (
      '35a372b6-c7ef-45cb-be0b-99cef476f247'::uuid,
      'Pantene',
      'Pantene Bonding Leave-In',
      'https://www.dm.de/pantene-pro-v-miracles-molecular-bond-repair-wunder-haarcreme-leave-in-p8700216637374.html',
      9.99
    ),
    (
      'e781ca9e-886d-40a1-bfe1-48177cfbf381'::uuid,
      'Pantene',
      'Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW',
      'https://www.dm.de/p/d/3088304/pantene-pro-v-leave-in-moisture-boost-heat-und-glow',
      8.95
    ),
    (
      'f8f3b51d-8e64-487d-bad5-4a47c58862ed'::uuid,
      'Pantene',
      'Pantene Pro-V Miracles 7in1 Haaröl Spray',
      'https://www.rossmann.de/de/pflege-und-duft-pantene-pro-v-miracles-schwereloses-7in1-haaroel-spray/p/8700216178402',
      8.99
    ),
    (
      '915aa362-6479-41f2-bb59-0260493b3d58'::uuid,
      'Paul Mitchell',
      'Paul Mitchell Full Circle Leave-In',
      'https://www.hagel-shop.de/paul-mitchell-full-circle-leave-in-cream-150-ml.html',
      26.45
    ),
    (
      'a3b21686-fe35-46f1-b560-b8a563dc96ae'::uuid,
      'Redken',
      'Redken Acidic Color Gloss Leave-In',
      'https://www.douglas.de/de/p/5011356068',
      29.40
    ),
    (
      '0d5a4af5-d046-4378-b608-515c9d1d66ec'::uuid,
      'Redken',
      'Redken All Soft Mega Curls Leave-In',
      'https://www.douglas.de/de/p/5010905038',
      24.44
    ),
    (
      '2b7db7e3-2058-4178-8a03-7d05f4a1d447'::uuid,
      'Redken',
      'Redken Extreme Anti-Snap',
      'https://www.douglas.de/de/p/5010083018',
      23.15
    ),
    (
      '39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid,
      'Redken',
      'Redken One United',
      'https://www.douglas.de/de/p/5002537033',
      20.45
    ),
    (
      '45f4fe15-c439-476d-8a86-3b2aac5053bd'::uuid,
      'Urban Alchemy',
      'Urban Alchemy Repair & Revive Leave-In Spray',
      'https://urban-alchemy.com/products/repair-revive-leave-in-spray-150-ml',
      22.90
    ),
    (
      '94cf6959-a53b-421b-9f0f-05efc239171c'::uuid,
      'Wella Professionals',
      'Wella Ultimate Repair Protective Leave-In',
      'https://www.wella.com/professional/de-DE/products/haarpflege/ultimate-repair/ultimate-repair-protective-leave-in',
      18.51
    )
) AS leave_in_available_updates(id, brand, name, affiliate_link, price_eur)
WHERE public.products.id = leave_in_available_updates.id;

UPDATE public.products
SET
  affiliate_link = 'https://www.flaconi.de/haare/maria-nila/structure-repair/maria-nila-structure-repair-leave-in-treatment.html',
  price_eur = 32.00,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  is_active = false,
  updated_at = now()
WHERE id = '996eaa2a-ea4c-4dfb-b455-2782e82d9a44';

INSERT INTO public.products (
  id,
  name,
  brand,
  description,
  category,
  affiliate_link,
  price_eur,
  tags,
  suitable_thicknesses,
  suitable_concerns,
  sort_order,
  purchase_link_status,
  purchase_link_checked_at,
  price_checked_at
)
VALUES (
  '9f94c225-61ec-455d-b303-f39e885e222a'::uuid,
  'Neqi Build Boost Leave-In Balm',
  'Neqi',
  'Neqi Build Boost Leave-In Balm ist ein Leave-in von Neqi, empfohlen für feines, mittelstarkes und dickes Haar bei Feuchtigkeitsbedarf.',
  'Leave-in',
  'https://neqi-hair.com/products/build-boost-balm',
  9.95,
  ARRAY['leave-in']::text[],
  ARRAY['fine', 'normal', 'coarse']::text[],
  ARRAY['feuchtigkeit', 'dryness', 'tangling']::text[],
  68,
  'available',
  '2026-06-10T00:00:00Z',
  '2026-06-10T00:00:00Z'
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  affiliate_link = EXCLUDED.affiliate_link,
  price_eur = EXCLUDED.price_eur,
  tags = EXCLUDED.tags,
  suitable_thicknesses = EXCLUDED.suitable_thicknesses,
  suitable_concerns = EXCLUDED.suitable_concerns,
  sort_order = EXCLUDED.sort_order,
  purchase_link_status = EXCLUDED.purchase_link_status,
  purchase_link_checked_at = EXCLUDED.purchase_link_checked_at,
  price_checked_at = EXCLUDED.price_checked_at,
  is_active = true,
  updated_at = now();

INSERT INTO public.product_leave_in_fit_specs (
  product_id,
  weight,
  conditioner_relationship,
  care_benefits
)
VALUES (
  '9f94c225-61ec-455d-b303-f39e885e222a'::uuid,
  'medium',
  'booster_only',
  ARRAY['detangle_smooth']::text[]
)
ON CONFLICT (product_id) DO UPDATE
SET
  weight = EXCLUDED.weight,
  conditioner_relationship = EXCLUDED.conditioner_relationship,
  care_benefits = EXCLUDED.care_benefits,
  updated_at = now();

UPDATE public.products
SET
  brand = oil_available_updates.brand,
  name = oil_available_updates.name,
  description = COALESCE(oil_available_updates.description, public.products.description),
  affiliate_link = oil_available_updates.affiliate_link,
  price_eur = oil_available_updates.price_eur,
  price_checked_at = '2026-06-10T00:00:00Z',
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-10T00:00:00Z',
  updated_at = now()
FROM (VALUES
    (
      '4f373d4f-fef8-4434-91c7-055133d8427f'::uuid,
      'Balea',
      'Balea Pflegeöl Natural Beauty',
      'https://www.dm.de/p/d/1610163/balea-pflegeoel-natural-beauty',
      2.45,
      'Balea Pflegeöl Natural Beauty ist ein Öl von Balea, empfohlen für feines und mittelstarkes Haar bei Styling-Öl.'
    ),
    (
      '1c43bc07-e3c6-4b8a-9b62-943147052e07'::uuid,
      'Balea',
      'Balea Oil Repair Haaröl',
      'https://www.dm.de/p/d/1700841/balea-professional-haaroel-oil-repair-intensiv',
      2.75,
      NULL
    ),
    (
      'fd83b493-f7be-4071-9642-3d5b92e30dc2'::uuid,
      'Balea',
      'Balea Traumlocken Öl',
      'https://www.dm.de/p/d/1635760/balea-professional-haaroel-traumlocken',
      2.75,
      'Balea Traumlocken Öl ist ein Öl von Balea, empfohlen für dickes Haar bei Styling-Öl.'
    ),
    (
      '78e6f1b2-7262-46af-b689-a92af6702739'::uuid,
      'NUTREEOIL',
      'NUTREEOIL Cacay Öl',
      'https://www.nutreeoil.com/products/nutreeoil-cacay-ol-30ml',
      34.99,
      'Cacayöl ist ein natürliches Öl, empfohlen für dickes Haar bei natürliche Ölpflege.'
    ),
    (
      '9bfe0a67-72ad-4951-bb99-9f2f5d5c724a'::uuid,
      'dmBio',
      'dmBio natives Olivenöl extra',
      'https://www.dm.de/dmbio-natives-olivenoel-extra-p4066447423761.html',
      3.75,
      NULL
    ),
    (
      '4a95e1de-54e9-4fcd-b227-72a5824d13c1'::uuid,
      'Dr. Scheller',
      'Dr. Scheller Jojobaöl',
      'https://www.dm.de/p/d/1675203/dr-scheller-koerperoel-jojoba',
      8.95,
      NULL
    ),
    (
      'c574ee6f-ad22-45c0-b936-57b847d93433'::uuid,
      'Garnier',
      'Garnier Fructis Sleek & Stay Heat-Activated Serum',
      'https://www.rossmann.de/de/pflege-und-duft-garnier-fructis-sleek-und-stay-heat-activated-serum/p/3600542638852',
      7.99,
      NULL
    ),
    (
      'e6b87909-6104-4a9a-a3ef-e1c64a1b15b1'::uuid,
      'Garnier',
      'Garnier Fructis Wunderöl',
      'https://www.dm.de/p/d/1499815/garnier-fructis-haaroel-oil-repair-wunder-oel',
      5.95,
      NULL
    ),
    (
      'ea9d38a1-25ce-4c01-868b-960cc5ee4397'::uuid,
      'Garnier',
      'Garnier Wahre Schätze Curl Revival Öl',
      'https://www.dm.de/wahre-schaetze-haaroel-curl-revival-elixir-p3600542624336.html',
      6.99,
      NULL
    ),
    (
      '3acd3c18-0a4b-45f8-9178-5bd2f4e0a38b'::uuid,
      'benecos',
      'benecos BIO Körperöl Wunderbaumsamenöl',
      'https://www.mueller.de/p/benecos-bio-koerperoel-wunderbaumsamenoel-IPN2878448/',
      4.99,
      'Rizinusöl ist ein natürliches Öl, empfohlen für dickes Haar bei natürliche Ölpflege.'
    ),
    (
      'b916efff-8b80-47d4-82cf-d8148d1eff53'::uuid,
      'HASK',
      'HASK Argan Oil Repairing Shine Oil',
      'https://www.hagel-shop.de/hask-argan-oil-repairing-shine-oil-18-ml-5815315.html',
      2.95,
      NULL
    ),
    (
      '7f5207e6-d281-416e-922c-3135dd9a8cc8'::uuid,
      'Innersense',
      'Innersense Harmonic Treatment Oil',
      'https://www.douglas.de/de/p/m001643012',
      29.99,
      NULL
    ),
    (
      '05e68c32-f096-457f-8b88-5cd3c0934873'::uuid,
      'Jean&Len',
      'Jean&Len Repair Keratin & Mandel',
      'https://www.dm.de/jean-und-len-haaroel-repair-keratin-und-mandel-p4262401733253.html',
      6.95,
      NULL
    ),
    (
      '3eb198a5-9aab-4f28-9df1-c4869c6a12db'::uuid,
      'KoRo',
      'KoRo MCT Öl',
      'https://www.dm.de/koro-mct-oel-p4260718296232.html',
      16.95,
      NULL
    ),
    (
      'a11855eb-64e5-438f-8880-1d3573efa9fa'::uuid,
      'benecos',
      'benecos BIO Körperöl Aprikosenkernöl',
      'https://www.mueller.de/p/benecos-bio-koerperoel-aprikosenkernoel-IPN2878067/',
      6.99,
      'Aprikosenkernöl ist ein natürliches Öl, empfohlen für feines Haar bei natürliche Ölpflege.'
    ),
    (
      'ff13bc3a-8bc6-49df-85a0-7a67add26926'::uuid,
      'NANOIL',
      'NANOIL Avocadoöl',
      'https://www.rossmann.de/de/pflege-und-duft-nanoil-avocadooel/p/5905669547130',
      12.99,
      'Avocadoöl ist ein natürliches Öl, empfohlen für mittelstarkes Haar bei natürliche Ölpflege.'
    ),
    (
      'c05773dd-9656-4381-a0ab-8e9fc310c520'::uuid,
      'L’Oréal',
      'L’Oréal Elvital Öl Magique Jojoba',
      'https://www.rossmann.de/de/pflege-und-duft-loreal-paris-elvital-oel-magique-jojoba-haaroel/p/3600523749188',
      6.95,
      NULL
    ),
    (
      '21a94166-3813-4c0f-8912-508fb8f704f1'::uuid,
      'L’Oréal',
      'L’Oréal Öl Magique Midnight Serum',
      'https://www.dm.de/l-oreal-paris-elvital-haarserum-oel-magique-midnight-serum-p3600524135805.html',
      7.99,
      NULL
    ),
    (
      '7b5ff358-1b3b-411d-9220-5e6d30543235'::uuid,
      'Maria Nila',
      'Maria Nila True Soft Argan Oil',
      'https://www.hagel-shop.de/maria-nila-true-soft-argan-oil-100-ml.html',
      37.00,
      NULL
    ),
    (
      '70ea52bc-2194-4bb3-82a8-3f4a2aede041'::uuid,
      'Dr. Scheller',
      'Dr. Scheller Reines Arganöl',
      'https://www.mueller.de/p/dr-scheller-reines-arganoel-2859166/',
      8.95,
      'Arganöl ist ein natürliches Öl, empfohlen für mittelstarkes Haar bei natürliche Ölpflege.'
    ),
    (
      '38886b62-2c45-4b34-9a24-7d831e97946e'::uuid,
      'MoriVeda',
      'MoriVeda Premium Moringaöl',
      'https://www.shop-apotheke.com/ernaehrung/upmLDFZ4H/moriveda-moringa-oel-premium-erstpressung-aus-geschaelten-oleifera-samen-schoten.htm',
      16.99,
      NULL
    ),
    (
      'ca4ae209-79d2-4f4d-8e44-46e586cec62d'::uuid,
      'benecos',
      'benecos BIO Körperöl Mandelöl',
      'https://www.mueller.de/p/benecos-bio-koerperoel-mandeloel-IPN2878446/',
      8.99,
      'Mandelöl ist ein natürliches Öl, empfohlen für feines Haar bei natürliche Ölpflege.'
    ),
    (
      '2ffeae68-c625-4df5-be02-0c1b620aa0fc'::uuid,
      'nedura',
      'nedura Schwarzkümmelöl ungefiltert',
      'https://www.dm.de/nedura-schwarzkuemmeloel-ungefiltert-p4262490410776.html',
      12.49,
      NULL
    ),
    (
      '27a2dd61-6e54-4746-8e24-a698dbafbf91'::uuid,
      'Neqi',
      'Neqi Opulent Oil',
      'https://www.dm.de/neqi-haarserum-opulent-oil-p4063528078520.html',
      9.95,
      NULL
    ),
    (
      '5767f7a6-757c-40fa-b990-8e0a1abaea17'::uuid,
      'Nuxe',
      'Nuxe Huile Prodigieuse Öl',
      'https://de.nuxe.com/products/wichtiger-ol%C2%AE-1',
      38.90,
      NULL
    ),
    (
      '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf'::uuid,
      'OGX',
      'OGX Argan Oil',
      'https://www.dm.de/ogx-haaroel-moroccan-argan-penetrating-oil-p3574661563312.html',
      8.95,
      NULL
    ),
    (
      'aa349c07-1add-44d4-9161-d99190182e5c'::uuid,
      'OGX',
      'OGX Argan weightless Öl',
      'https://www.dm.de/ogx-haaroel-moroccan-argan-oil-weightless-dry-out-oil-p22796976208.html',
      8.95,
      NULL
    ),
    (
      'c320750f-6a1e-420d-8594-409f04e05319'::uuid,
      'OGX',
      'OGX Bond Protein Repair',
      'https://www.amazon.de/OGX-Spr%C3%BChnebel-besch%C3%A4digtes-Technology-Dual-Action-Reparaturtechnologie/dp/B0DQLHGGYJ',
      8.95,
      NULL
    ),
    (
      '2858a8b6-018b-4949-ae58-eedc348d20b4'::uuid,
      'OGX',
      'OGX Miracle Coconut Oil',
      'https://www.dm.de/ogx-haaroel-coconut-miracle-oil-p3574661563398.html',
      8.95,
      NULL
    ),
    (
      '7d8c0150-778d-4cb9-abf5-bfc16ad93b12'::uuid,
      'Olaplex',
      'Olaplex No.7 Bonding Oil',
      'https://olaplex.de/products/olaplex-no-7-bonding-oil',
      32.00,
      NULL
    ),
    (
      '517dca50-5d55-4038-ba1d-f9b745708327'::uuid,
      'Allgäuer Ölmühle',
      'Allgäuer Ölmühle Bio Traubenkernöl',
      'https://www.mueller.de/p/allgaeuer-oelmuehle-bio-traubenkernoel-223549/',
      7.99,
      'Traubenkernöl ist ein natürliches Öl, empfohlen für feines Haar bei natürliche Ölpflege.'
    ),
    (
      '1a6d62c7-c5e5-45aa-a45f-2cfba4aeccb5'::uuid,
      'Pantene',
      'Pantene Pro-V Coconut Oil',
      'https://www.dm.de/p/d/1612745/pantene-pro-v-haaroel-coconut-infused-oil',
      4.95,
      NULL
    ),
    (
      'fe974387-b487-470e-9799-69bb4249070b'::uuid,
      'Pantene',
      'Pantene Pro-V Keratin Protect Öl',
      'https://www.rossmann.de/de/pflege-und-duft-pantene-pro-v-repair-und-care-keratin-protect-oel/p/4084500084971',
      4.95,
      NULL
    ),
    (
      '5827a3b9-a488-4c74-b13a-4d655f94f1c3'::uuid,
      'Pantene',
      'Pantene Pro-V Miracles 7in1 Öl-Spray',
      'https://www.mueller.de/p/pantene-pro-v-miracles-oel-spray-7-in-1-IPN2992303/',
      8.95,
      NULL
    ),
    (
      '1dce2c18-6a45-4017-a748-e3a7f1cba36f'::uuid,
      'Primavera',
      'Primavera Calendulaöl Bio',
      'https://www.mueller.de/p/primavera-calendulaoel-bio-IPN2893577/',
      15.90,
      NULL
    ),
    (
      '29e36443-93ff-4b62-9cf0-55ad9f89f530'::uuid,
      'BioGourmet',
      'BioGourmet Distelöl',
      'https://www.mueller.de/p/biogourmet-disteloel-2529149/',
      5.99,
      'Distelöl ist ein natürliches Öl, empfohlen für feines Haar bei natürliche Ölpflege.'
    ),
    (
      'acf9d5cd-76e4-49c7-9c04-0af1f20506ad'::uuid,
      'dmBio',
      'dmBio Kokosöl nativ',
      'https://www.dm.de/p/d/1544928/dmbio-kokosoel-nativ',
      2.85,
      'Kokosöl ist ein natürliches Öl, empfohlen für dickes Haar bei natürliche Ölpflege.'
    ),
    (
      '663acf09-7090-40d8-9411-71154b9d60f3'::uuid,
      'Shiseido Fino',
      'Shiseido Fino Premium Touch Penetrating Hair Oil Essence',
      'https://www.amazon.de/Fino-Premium-Touch-Penetrating-Essence/dp/B0GVFQP34X',
      11.00,
      NULL
    ),
    (
      '5ad6c978-fd27-469e-9f26-ff3f05b9f67a'::uuid,
      'Urban Alchemy',
      'Urban Alchemy Smooth Supreme Öl Serum',
      'https://urban-alchemy.com/products/smooth-supreme-ol-serum-75ml',
      22.90,
      NULL
    ),
    (
      '07120c73-0171-4a2a-9d07-facd9ce90d8c'::uuid,
      'Weleda',
      'Weleda Hydra Shine Gloss Drops Alpen-Lein',
      'https://www.mueller.de/p/weleda-hydrashine-gloss-drops-haaroel-alpen-lein-PPN3138905/',
      9.59,
      NULL
    ),
    (
      '19aea9c4-4b90-4ec4-8cb6-90cb270010f7'::uuid,
      'benecos',
      'benecos BIO Körperöl Macadamianussöl',
      'https://www.mueller.de/p/benecos-bio-koerperoel-macadamianussoel-IPN2878442/',
      8.99,
      'Macadamiaöl ist ein natürliches Öl, empfohlen für mittelstarkes Haar bei natürliche Ölpflege.'
    )
) AS oil_available_updates(id, brand, name, affiliate_link, price_eur, description)
WHERE public.products.id = oil_available_updates.id;

UPDATE public.product_oil_eligibility
SET
  ingredient_flags = ARRAY[]::text[],
  updated_at = now()
WHERE product_id = 'fd83b493-f7be-4071-9642-3d5b92e30dc2';

-- Reviewed Conditioner (Drogerie) updates approved through HAI-124.
-- Cantu's 3-in-1 repair cream is intentionally kept as both a Leave-in row
-- and a Conditioner row because the catalog model stores one primary category
-- per product row.
UPDATE public.products
SET
  brand = conditioner_updates.brand,
  name = conditioner_updates.name,
  description = COALESCE(conditioner_updates.description, public.products.description),
  affiliate_link = conditioner_updates.affiliate_link,
  price_eur = conditioner_updates.price_eur,
  purchase_link_status = conditioner_updates.purchase_link_status,
  purchase_link_checked_at = '2026-06-11T00:00:00Z',
  price_checked_at = CASE
    WHEN conditioner_updates.purchase_link_status = 'available'
      THEN '2026-06-11T00:00:00Z'
    ELSE public.products.price_checked_at
  END,
  suitable_thicknesses = conditioner_updates.suitable_thicknesses,
  suitable_concerns = conditioner_updates.suitable_concerns,
  sort_order = conditioner_updates.sort_order,
  is_active = conditioner_updates.is_active,
  updated_at = now()
FROM (VALUES
    (
      '11d42d9d-b8d8-42ae-a432-9a3d0f9d3504'::uuid,
      'Guhl',
      'Guhl Panthenol + Reparatur 2in1 Kur & Spülung',
      'https://www.mueller.de/p/guhl-panthenol-reparatur-2in1-kur-spuelung-IPN3052207/',
      4.95,
      'available',
      ARRAY['fine']::text[],
      ARRAY['protein', 'hair_damage']::text[],
      0,
      true,
      'Guhl Panthenol + Reparatur 2in1 Kur & Spülung ist ein Conditioner von Guhl, empfohlen für feines Haar bei Reparaturbedarf.'
    ),
    (
      '970aff48-a7a7-46e8-bad5-4f0600631329'::uuid,
      'Pomélo+Co',
      'Pomélo+Co Molecular Repair Conditioner',
      'https://www.dm.de/p/d/2971600/pomelo-co-conditioner-molecular-repair',
      9.95,
      'available',
      ARRAY['fine']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      1,
      true,
      NULL
    ),
    (
      'e1ad37be-9330-49b4-8add-872a30324122'::uuid,
      'Jean&Len',
      'Jean&Len Conditioner Keratin/Mandel',
      'https://www.dm.de/p/d/1551254/jean-und-len-conditioner-keratin-mandel',
      3.95,
      'available',
      ARRAY['fine']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      2,
      true,
      NULL
    ),
    (
      '215522e5-95a6-469f-bc34-1fa74b311a23'::uuid,
      'Nivea',
      'Nivea Power Repair Conditioner',
      'https://www.dm.de/p/d/1620990/nivea-conditioner-power-repair',
      2.95,
      'available',
      ARRAY['fine']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      4,
      true,
      NULL
    ),
    (
      'd2bb79a8-add1-4b74-9d4f-c03449175147'::uuid,
      'Sante',
      'Sante Intense Hydration Conditioner',
      'https://www.dm.de/p/d/1334054/sante-naturally-conditioner-intense-hydration',
      3.95,
      'available',
      ARRAY['fine', 'normal']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      5,
      true,
      NULL
    ),
    (
      '007a0b35-2372-4836-9aa5-fd089cd588d4'::uuid,
      'Balea',
      'Balea Natural Beauty Hibiskus',
      'https://www.dm.de/p/d/1625969/balea-conditioner-natural-beauty-hibiskus-extrakt-und-kokosmilch',
      1.45,
      'available',
      ARRAY['fine']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      6,
      true,
      NULL
    ),
    (
      '98d08c22-97d2-4e06-872f-9f9447530452'::uuid,
      'Pantene',
      'Pantene Pro-V Miracles Hydra Glow Conditioner',
      'https://www.dm.de/p/d/1647565/pantene-pro-v-conditioner-miracles-hydra-glow',
      3.95,
      'available',
      ARRAY['fine']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      7,
      true,
      NULL
    ),
    (
      '02113cc7-80c4-45a5-a56b-738ac96f4f02'::uuid,
      'Gliss',
      'Gliss Kur Aqua Revive Conditioner',
      'https://www.dm.de/p/d/1633094/schwarzkopf-gliss-conditioner-aqua-revive',
      2.95,
      'available',
      ARRAY['fine']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      8,
      true,
      NULL
    ),
    (
      '5516009a-eecb-42dd-87f6-07c560161136'::uuid,
      'Garnier Fructis',
      'Garnier Fructis Hair Food Aloe Vera Feuchtigkeits-Spülung',
      'https://www.rossmann.de/de/pflege-und-duft-garnier-fructis-feuchtigkeits-aloe-vera-hair-food-spuelung/p/3600542398022',
      3.99,
      'available',
      ARRAY['fine']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      9,
      true,
      NULL
    ),
    (
      '483b41d6-632c-4efe-9bcc-488c80bf5bb7'::uuid,
      'Balea',
      'Balea Med Ultra Sensitive Conditioner',
      'https://www.dm.de/p/d/1587731/balea-med-conditioner-ultra-sensitive',
      1.75,
      'available',
      ARRAY['fine']::text[],
      ARRAY['performance']::text[],
      10,
      true,
      NULL
    ),
    (
      '3901b2cf-6888-4363-9d5b-a695c0b3170b'::uuid,
      'Dejan Garz',
      'Dejan Garz The Foundation Conditioner',
      'https://www.dm.de/p/d/3063725/dejan-garz-conditioner-the-foundation',
      9.95,
      'available',
      ARRAY['fine']::text[],
      ARRAY['performance']::text[],
      11,
      true,
      NULL
    ),
    (
      'a6730d6f-df2f-4ebf-8013-eb39162f15df'::uuid,
      'Balea',
      'Balea Professional Aqua Hyaluron Conditioner',
      'https://www.dm.de/balea-professional-conditioner-aqua-hyaluron-p4066447342055.html',
      1.25,
      'available',
      ARRAY['fine']::text[],
      ARRAY['performance']::text[],
      12,
      true,
      NULL
    ),
    (
      '952a4834-e451-4dc3-ba19-ebb8927eb5e4'::uuid,
      'Neqi',
      'Neqi Volume Victory Conditioner',
      'https://www.rossmann.de/de/pflege-und-duft-neqi-nq-volume-victory-conditioner-250ml/p/4063528078407',
      9.95,
      'available',
      ARRAY['fine']::text[],
      ARRAY['performance']::text[],
      13,
      true,
      NULL
    ),
    (
      '79ce764e-7acf-48ba-b0be-c6d977a81cd0'::uuid,
      'Alverde',
      'Alverde Conditioner Glanz',
      'https://www.dm.de/p/d/1714048/alverde-naturkosmetik-conditioner-glanz-rosenbluetenwasser-und-pflanzlichem-protein',
      1.35,
      'available',
      ARRAY['fine']::text[],
      ARRAY['performance']::text[],
      14,
      true,
      NULL
    ),
    (
      '71d9bccb-74c7-499c-b5de-13ceef57ecde'::uuid,
      'Pantene',
      'Pantene Pro-V Miracles Bond Repair Conditioner',
      'https://www.dm.de/p/d/1336165/pantene-pro-v-conditioner-miracles-bond-repair',
      5.95,
      'available',
      ARRAY['normal']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      15,
      true,
      NULL
    ),
    (
      '01b11043-5c87-43d2-95b5-f1cabd845423'::uuid,
      'Sante',
      'SANTE Deep Repair Conditioner',
      'https://www.dm.de/p/d/1335946/sante-naturally-conditioner-deep-repair',
      3.95,
      'available',
      ARRAY['normal']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      16,
      true,
      NULL
    ),
    (
      '9f8da740-87b6-45e0-ab86-d77d63f2e22b'::uuid,
      'Guhl',
      'Guhl Bond+ Reparatur Spülung',
      'https://www.amazon.de/Guhl-BOND-REPARATUR-Sp%C3%BClung-Rotalgenextrakt/dp/B0CWJHVKV5',
      5.99,
      'available',
      ARRAY['normal']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      17,
      true,
      'Guhl Bond+ Reparatur Spülung ist ein Conditioner von Guhl, empfohlen für mittelstarkes Haar bei Reparaturbedarf.'
    ),
    (
      'ed382d40-6166-4d39-be2d-eab5a24793a6'::uuid,
      'Syoss',
      'Syoss Intense Keratin Conditioner',
      'https://www.dm.de/p/d/1666649/syoss-conditioner-intense-keratin',
      3.99,
      'available',
      ARRAY['normal']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      18,
      true,
      NULL
    ),
    (
      '35ae622e-1458-42bf-a44d-1b23ecfd5516'::uuid,
      'Neqi',
      'Neqi Repair Reveal Conditioner',
      'https://www.dm.de/neqi-conditioner-repair-reveal-p4063528078223.html',
      9.95,
      'available',
      ARRAY['normal']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      19,
      true,
      NULL
    ),
    (
      '4e9428b9-8cc9-4db2-89b1-cb272aa9a4d6'::uuid,
      'Herbal Essences',
      'Herbal Essences Aloe Vera Conditioner',
      'https://www.dm.de/p/d/1409620/herbal-essences-conditioner-feuchtigkeit-aloe-vera',
      3.95,
      'available',
      ARRAY['normal']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      20,
      true,
      NULL
    ),
    (
      'c2d7eb89-9a2e-4476-bb89-c0f33a2aa501'::uuid,
      'OGX',
      'OGX Renewing Argan Oil of Morocco Conditioner',
      'https://www.dm.de/p/d/1442294/ogx-conditioner-renewing-argan-oil-of-marocco',
      6.95,
      'available',
      ARRAY['normal', 'coarse']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      21,
      true,
      NULL
    ),
    (
      'ffd37427-0cb6-4d6a-8b83-ea904bf2b1d7'::uuid,
      'Monday',
      'Monday Moisture Conditioner',
      'https://www.dm.de/p/d/1893701/monday-conditioner-moisture-feuchtigkeit',
      5.95,
      'available',
      ARRAY['normal']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      22,
      true,
      NULL
    ),
    (
      '95e47992-b45b-4847-ba87-b8c3e608fc63'::uuid,
      'Neqi',
      'Neqi Moisture Mystery Conditioner',
      'https://www.rossmann.de/de/pflege-und-duft-neqi-moisture-mystery-conditioner/p/4063528078315',
      9.95,
      'available',
      ARRAY['normal']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      23,
      true,
      NULL
    ),
    (
      '4fca59e5-fbc4-4132-a821-dac6ff0cdb68'::uuid,
      'OGX',
      'OGX Biotin & Collagen Conditioner',
      'https://www.dm.de/p/d/1443632/ogx-conditioner-thick-und-full-biotin-und-collagen',
      6.95,
      'available',
      ARRAY['normal']::text[],
      ARRAY['performance']::text[],
      24,
      true,
      NULL
    ),
    (
      '99de5b38-3e80-4360-889c-2505f46a7243'::uuid,
      'Garnier Wahre Schätze',
      'Garnier Wahre Schätze Argan-Mandelcreme Spülung',
      'https://www.rossmann.de/de/pflege-und-duft-garnier-wahre-schaetze-reichhaltige-creme-spuelung-argan-mandelcreme/p/3600542462594',
      2.49,
      'available',
      ARRAY['normal']::text[],
      ARRAY['performance']::text[],
      25,
      true,
      NULL
    ),
    (
      '2a159694-6799-4be7-a0aa-572757c94801'::uuid,
      'Langhaarmädchen',
      'Langhaarmädchen Lovely Long Conditioner',
      'https://www.dm.de/langhaarmaedchen-conditioner-lovely-long-p4058172702136.html',
      4.95,
      'available',
      ARRAY['normal']::text[],
      ARRAY['performance']::text[],
      26,
      true,
      NULL
    ),
    (
      '25931499-63ac-4076-b88c-8c23a38f0fa5'::uuid,
      'Pomélo+Co',
      'Pomélo+Co Shine Therapy Conditioner',
      'https://www.rossmann.de/de/pflege-und-duft-pomeloco-shine-therapy-conditioner/p/4260625261989',
      8.99,
      'available',
      ARRAY['normal']::text[],
      ARRAY['performance']::text[],
      27,
      true,
      NULL
    ),
    (
      '26985fdd-1b41-46e3-9c9a-94b98f92310a'::uuid,
      'Nivea',
      'Nivea Volumen & Kraft',
      'https://www.dm.de/nivea-conditioner-volumen-und-kraft-p4005900918031.html',
      2.25,
      'unavailable',
      ARRAY['normal']::text[],
      ARRAY['performance']::text[],
      28,
      true,
      NULL
    ),
    (
      '7539ab79-f4f6-49d7-9269-08034ef4de96'::uuid,
      'Cantu',
      'Cantu Leave-In Repair Cream',
      'https://www.dm.de/p/d/1685686/cantu-leave-in-haarkur-repair-creme',
      6.95,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      29,
      true,
      'Cantu Leave-In Repair Cream ist eine 3in1-Haarkur von Cantu, die in der Conditioner-Matrix für dickes Haar bei Reparaturbedarf geführt wird.'
    ),
    (
      'b4bcb392-22a7-4642-bcdf-1949ca959f67'::uuid,
      'Hask',
      'Hask Argan Oil Repairing Conditioner',
      'https://www.dm.de/p/d/1475001/hask-conditioner-repairing-argan-oil',
      6.95,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      30,
      true,
      NULL
    ),
    (
      'e7cde77e-e9d5-4976-a8ed-830c8a30c62a'::uuid,
      'Balea',
      'Balea Professional Oil Repair Intensiv Spülung',
      'https://www.dm.de/balea-professional-spuelung-oil-repair-intensiv-p4066447365443.html',
      1.25,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      31,
      true,
      NULL
    ),
    (
      '1bfa5b02-26d9-457b-a5e6-445cc2284490'::uuid,
      'OGX',
      'OGX Bond Protein Repair Conditioner',
      'https://www.dm.de/p/d/3068101/ogx-conditioner-bond-protein-repair',
      6.95,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['protein', 'hair_damage', 'breakage']::text[],
      32,
      true,
      NULL
    ),
    (
      '37c65daf-cc2e-44ba-a976-ac0239c11f7d'::uuid,
      'Hask',
      'Hask Curl Care Conditioner',
      'https://www.dm.de/p/d/1622385/hask-conditioner-curl-care',
      6.95,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      33,
      true,
      NULL
    ),
    (
      '35d81c4a-dbb0-474b-a068-2e1562adb0a8'::uuid,
      'Langhaarmädchen',
      'Langhaarmädchen Beautiful Curls Conditioner',
      'https://www.dm.de/p/d/1678991/langhaarmaedchen-conditioner-beautiful-curls',
      4.95,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      34,
      true,
      NULL
    ),
    (
      '7bd5f94a-fb02-4505-a53a-2b100c265a5b'::uuid,
      'OGX',
      'OGX Renewing Argan Oil of Morocco Conditioner (legacy duplicate)',
      'https://www.dm.de/p/d/1442294/ogx-conditioner-renewing-argan-oil-of-marocco',
      6.95,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      35,
      false,
      'Merged into the active OGX Renewing Argan Oil of Morocco Conditioner row for normal and thick hair.'
    ),
    (
      'a62ae91c-69c6-466e-827e-350f518d73b5'::uuid,
      'Syoss',
      'Syoss Intense Curls Conditioner',
      'https://www.dm.de/p/d/1666690/syoss-conditioner-intense-curls',
      3.99,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      36,
      true,
      NULL
    ),
    (
      '8c3eda97-5009-40bb-959b-1a7d90f48b09'::uuid,
      'Garnier Wahre Schätze',
      'Garnier Wahre Schätze Kokosmilch & Macadamia Nährende Spülung',
      'https://www.rossmann.de/de/pflege-und-duft-garnier-wahre-schaetze-spuelung-kokosmilch-und-macadamia-normales-und-trockenes-haar/p/3600542462327',
      2.49,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['feuchtigkeit', 'dryness']::text[],
      37,
      true,
      NULL
    ),
    (
      'd0180955-c3a0-4f53-8744-fbeb2c241688'::uuid,
      'L''Oréal Paris Elvital',
      'Elvital Fiber Booster Conditioner',
      'https://www.dm.de/p/d/2976313/l-oreal-paris-elvital-conditioner-fiber-booster-anti-haarverlust',
      6.95,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['performance']::text[],
      38,
      true,
      NULL
    ),
    (
      '63239c38-5633-4062-9e8d-d528ee71502a'::uuid,
      'Bali Curls',
      'Bali Curls Moisturising Conditioner',
      'https://www.dm.de/p/d/3070316/bali-curls-conditioner-moisturising',
      8.95,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['performance']::text[],
      39,
      true,
      NULL
    ),
    (
      '4506954b-128a-473c-866f-54a300ff23f4'::uuid,
      'Hair Biology',
      'Hair Biology Full & Shining Conditioner',
      'https://www.dm.de/p/d/1585350/hair-biology-conditioner-full-und-shining',
      4.99,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['performance']::text[],
      40,
      true,
      NULL
    ),
    (
      'd8ac8909-91a1-46b3-9fa6-2ff66b78fb66'::uuid,
      'Cantu',
      'Cantu Conditioner Cream',
      'https://www.dm.de/p/d/1675021/cantu-conditioner-cream',
      6.95,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['performance']::text[],
      41,
      true,
      NULL
    ),
    (
      '7964b930-7e88-4f93-89d3-fa437f8e753c'::uuid,
      'Isana',
      'Isana Professional Arganöl & Pflege Spülung',
      'https://www.rossmann.de/de/pflege-und-duft-isana-professional-spuelung-arganoel-und-pflege/p/4305615624945',
      1.39,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['performance']::text[],
      42,
      true,
      NULL
    )
) AS conditioner_updates(
  id,
  brand,
  name,
  affiliate_link,
  price_eur,
  purchase_link_status,
  suitable_thicknesses,
  suitable_concerns,
  sort_order,
  is_active,
  description
)
WHERE public.products.id = conditioner_updates.id;

INSERT INTO public.products (
  id,
  name,
  brand,
  description,
  category,
  affiliate_link,
  image_url,
  price_eur,
  tags,
  suitable_thicknesses,
  suitable_concerns,
  sort_order,
  purchase_link_status,
  purchase_link_checked_at,
  price_checked_at,
  is_active
)
VALUES (
  '4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,
  'Garnier Hair Food Macadamia',
  'Garnier',
  'Garnier Hair Food Macadamia ist eine 3in1-Haarkur von Garnier, die in der Conditioner-Matrix für dickes Haar bei Feuchtigkeitsbedarf geführt wird.',
  'Conditioner (Drogerie)',
  'https://www.dm.de/garnier-fructis-haarkur-macadamia-hair-food-3in1-maske-p3600542511612.html',
  'https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-2026-06-10-01/a72d630d-547a-465f-9846-3006b38af0a2/19-a72d630d-547a-465f-9846-3006b38af0a2-garnier-garnier-hair-food-macadamia-0de6095b715d.webp',
  5.95,
  ARRAY['conditioner']::text[],
  ARRAY['coarse']::text[],
  ARRAY['feuchtigkeit', 'dryness']::text[],
  43,
  'available',
  '2026-06-11T00:00:00Z',
  '2026-06-11T00:00:00Z',
  true
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  affiliate_link = EXCLUDED.affiliate_link,
  image_url = EXCLUDED.image_url,
  price_eur = EXCLUDED.price_eur,
  tags = EXCLUDED.tags,
  suitable_thicknesses = EXCLUDED.suitable_thicknesses,
  suitable_concerns = EXCLUDED.suitable_concerns,
  sort_order = EXCLUDED.sort_order,
  purchase_link_status = EXCLUDED.purchase_link_status,
  purchase_link_checked_at = EXCLUDED.purchase_link_checked_at,
  price_checked_at = EXCLUDED.price_checked_at,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.product_conditioner_rerank_specs (
  product_id,
  weight,
  repair_level,
  balance_direction,
  ingredient_flags
)
VALUES (
  '4c3e1a63-4696-406a-be67-f2aacc678b0c'::uuid,
  'medium',
  'low',
  'moisture',
  ARRAY['oils']::text[]
)
ON CONFLICT (product_id) DO UPDATE
SET
  weight = EXCLUDED.weight,
  repair_level = EXCLUDED.repair_level,
  balance_direction = EXCLUDED.balance_direction,
  ingredient_flags = EXCLUDED.ingredient_flags,
  updated_at = now();

-- Reviewed Shampoo updates approved through HAI-124.
-- The Sheet alias "Head & Shoulder Derma X 0%" was previously mapped to a
-- non-shampoo scalp-mask SKU. Keep that row inactive as audit trail and let
-- the exact available Sensitive Pflege shampoo row cover the sheet placement.
UPDATE public.products
SET
  purchase_link_status = 'available',
  purchase_link_checked_at = '2026-06-11T00:00:00Z',
  price_checked_at = '2026-06-11T00:00:00Z',
  updated_at = now()
WHERE category = 'Shampoo'
  AND purchase_link_status IS NULL;

UPDATE public.products
SET
  brand = shampoo_updates.brand,
  name = shampoo_updates.name,
  description = COALESCE(shampoo_updates.description, public.products.description),
  affiliate_link = shampoo_updates.affiliate_link,
  price_eur = shampoo_updates.price_eur,
  purchase_link_status = shampoo_updates.purchase_link_status,
  purchase_link_checked_at = '2026-06-11T00:00:00Z',
  price_checked_at = CASE
    WHEN shampoo_updates.purchase_link_status = 'available'
      THEN '2026-06-11T00:00:00Z'
    ELSE public.products.price_checked_at
  END,
  suitable_thicknesses = shampoo_updates.suitable_thicknesses,
  suitable_concerns = shampoo_updates.suitable_concerns,
  is_active = shampoo_updates.is_active,
  updated_at = now()
FROM (VALUES
    (
      'e7bfd306-b128-4735-a9f8-0eeacdbd5013'::uuid,
      'Sebamed',
      'Sebamed Every-Day Shampoo',
      'https://www.rossmann.de/de/pflege-und-duft-sebamed-every-day-shampoo/p/4103040051752',
      3.99,
      'available',
      ARRAY['fine']::text[],
      ARRAY['irritationen']::text[],
      true,
      NULL
    ),
    (
      'a79513be-e34b-4a1e-b7eb-b3d4b58160be'::uuid,
      'Balea',
      'Balea Ultra Sensitive',
      'https://www.dm.de/balea-med-shampoo-ultra-sensitive-p4066447966008.html',
      1.75,
      'available',
      ARRAY['fine']::text[],
      ARRAY['irritationen']::text[],
      true,
      NULL
    ),
    (
      'ead1333b-6839-464d-b272-673d39bb95a4'::uuid,
      'Balea',
      'Balea Aqua Hyaluron',
      'https://www.dm.de/p/d/1675524/balea-professional-shampoo-aqua-hyaluron',
      1.25,
      'available',
      ARRAY['fine']::text[],
      ARRAY['normal']::text[],
      true,
      NULL
    ),
    (
      'd01de47e-e360-4b31-9924-e3e5bc31ccdc'::uuid,
      'Balea',
      'Balea Professional Ultimate Volume',
      'https://www.dm.de/balea-professional-shampoo-ultimate-volume-p4067796075021.html',
      1.25,
      'available',
      ARRAY['fine']::text[],
      ARRAY['normal']::text[],
      true,
      NULL
    ),
    (
      '0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c'::uuid,
      'Balea',
      'Balea Tiefenreinigung',
      'https://www.dm.de/balea-professional-shampoo-tiefenreinigung-p4010355426239.html',
      1.25,
      'available',
      ARRAY['fine']::text[],
      ARRAY['dehydriert-fettig']::text[],
      true,
      NULL
    ),
    (
      'eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d'::uuid,
      'Balea',
      'Balea Kopfhaut Sensitive Shampoo',
      'https://www.dm.de/p/d/1701109/balea-professional-shampoo-kopfhaut-sensitive',
      1.25,
      'available',
      ARRAY['normal']::text[],
      ARRAY['irritationen']::text[],
      true,
      NULL
    ),
    (
      '088b1427-ed22-424e-8cfd-ea2578120ae6'::uuid,
      'Head & Shoulders',
      'Head & Shoulders Derma X Pro Beruhigende Pflege',
      'https://www.dm.de/p/d/1343250/head-und-shoulders-shampoo-derma-x-pro-beruhigende-pflege',
      4.95,
      'available',
      ARRAY['fine']::text[],
      ARRAY['schuppen']::text[],
      true,
      NULL
    ),
    (
      '4fd5f4c3-83b2-4893-be8c-ada29b8ca718'::uuid,
      'Head & Shoulders',
      'Head & Shoulders DERMAXPRO Sanfte Kopfhautpflege',
      'https://www.rossmann.de/de/pflege-und-duft-head-und-shoulders-derma-x-pro-sanfte-kopfhautpflege/p/8700216496056',
      4.29,
      'unavailable',
      ARRAY['fine']::text[],
      ARRAY['schuppen']::text[],
      false,
      'Inactive audit row: the reviewed retailer identifier maps to a DermaXPro scalp mask / Kopfhautmaske rather than an exact shampoo. Covered by the active Sensitive Pflege shampoo row.'
    ),
    (
      '9bfad335-a086-45a0-9af7-f26b36b4ecff'::uuid,
      'Guhl',
      'Guhl Kraft & Fülle',
      'https://www.dm.de/p/d/3043222/guhl-shampoo-kraft-und-fuelle',
      4.99,
      'available',
      ARRAY['normal']::text[],
      ARRAY['dehydriert-fettig']::text[],
      true,
      NULL
    ),
    (
      '6dc65df2-2466-43e4-bdc2-3a05803f305c'::uuid,
      'Monday Haircare',
      'Monday Haircare Volume Kraft & Fülle Shampoo',
      'https://www.flaconi.de/haare/monday-haircare/volume/monday-haircare-volume-kraft-and-fuelle-haarshampoo.html',
      8.95,
      'available',
      ARRAY['normal']::text[],
      ARRAY['dehydriert-fettig']::text[],
      true,
      NULL
    ),
    (
      '716a4f4e-6ba4-4742-a1cf-75e90ae1da3f'::uuid,
      'Head & Shoulders',
      'Head & Shoulders Anti Schuppen Sensitive',
      'https://www.dm.de/p/d/3115868/head-und-shoulders-shampoo-anti-schuppen-sensitive-kopfhaut',
      3.95,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['schuppen']::text[],
      true,
      NULL
    ),
    (
      '686df4f6-4e8f-48e7-b823-5b1e89dd9cf2'::uuid,
      'Head & Shoulders',
      'Head & Shoulders Derma X Pro Beruhigend',
      'https://www.dm.de/p/d/1692274/head-und-shoulders-shampoo-derma-x-pro-beruhigend',
      7.75,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['schuppen']::text[],
      true,
      NULL
    ),
    (
      'd408aca9-cd16-4cb0-90e7-bab26a698000'::uuid,
      'Head & Shoulders',
      'Head & Shoulders DERMAXPRO Haarshampoo Sensitive Pflege',
      'https://www.rossmann.de/de/pflege-und-duft-head-und-shoulders-dermaxpro-haarshampoo-sensitive-pflege/p/8700216496032',
      4.99,
      'available',
      ARRAY['fine', 'coarse']::text[],
      ARRAY['schuppen', 'irritationen']::text[],
      true,
      'Head & Shoulders DERMAXPRO Haarshampoo Sensitive Pflege covers the reviewed sheet aliases Derma X 0% and Derma X Pro Sensitive.'
    )
) AS shampoo_updates(
  id,
  brand,
  name,
  affiliate_link,
  price_eur,
  purchase_link_status,
  suitable_thicknesses,
  suitable_concerns,
  is_active,
  description
)
WHERE public.products.id = shampoo_updates.id;

DELETE FROM public.product_shampoo_specs
WHERE product_id = '4fd5f4c3-83b2-4893-be8c-ada29b8ca718'::uuid;

INSERT INTO public.product_shampoo_specs (
  product_id,
  thickness,
  shampoo_bucket,
  scalp_route,
  cleansing_intensity
)
VALUES
  (
    'd408aca9-cd16-4cb0-90e7-bab26a698000'::uuid,
    'fine',
    'schuppen',
    'dandruff',
    'gentle'
  ),
  (
    'd408aca9-cd16-4cb0-90e7-bab26a698000'::uuid,
    'coarse',
    'irritationen',
    'irritated',
    'gentle'
  )
ON CONFLICT (product_id, thickness, shampoo_bucket) DO UPDATE
SET
  scalp_route = EXCLUDED.scalp_route,
  cleansing_intensity = EXCLUDED.cleansing_intensity,
  updated_at = now();

-- Correct reviewed DERMAXPRO Shampoo variant mapping after domain review.
-- Sheet aliases "Derma X Aloe" and "Derma X Pro Beruhigend" are the same
-- Beruhigende Pflege shampoo. "Derma X Pro Sensitive" is the separate
-- Sensitive Pflege shampoo.
UPDATE public.products
SET
  brand = dermaxpro_updates.brand,
  name = dermaxpro_updates.name,
  description = dermaxpro_updates.description,
  affiliate_link = dermaxpro_updates.affiliate_link,
  price_eur = dermaxpro_updates.price_eur,
  purchase_link_status = dermaxpro_updates.purchase_link_status,
  purchase_link_checked_at = '2026-06-11T00:00:00Z',
  price_checked_at = CASE
    WHEN dermaxpro_updates.purchase_link_status = 'available'
      THEN '2026-06-11T00:00:00Z'
    ELSE public.products.price_checked_at
  END,
  suitable_thicknesses = dermaxpro_updates.suitable_thicknesses,
  suitable_concerns = dermaxpro_updates.suitable_concerns,
  is_active = dermaxpro_updates.is_active,
  updated_at = now()
FROM (VALUES
    (
      '088b1427-ed22-424e-8cfd-ea2578120ae6'::uuid,
      'Head & Shoulders',
      'Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege',
      'https://www.dm.de/p/d/1343250/head-und-shoulders-shampoo-derma-x-pro-beruhigende-pflege',
      4.95,
      'available',
      ARRAY['fine', 'coarse']::text[],
      ARRAY['schuppen']::text[],
      true,
      'Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege covers the reviewed sheet aliases Derma X Aloe and Derma X Pro Beruhigend.'
    ),
    (
      '686df4f6-4e8f-48e7-b823-5b1e89dd9cf2'::uuid,
      'Head & Shoulders',
      'Head & Shoulders DERMAXPRO Shampoo Beruhigende Pflege (legacy duplicate)',
      'https://www.dm.de/p/d/1343250/head-und-shoulders-shampoo-derma-x-pro-beruhigende-pflege',
      4.95,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['schuppen']::text[],
      false,
      'Inactive duplicate: merged into the active DERMAXPRO Shampoo Beruhigende Pflege row after sheet review confirmed Derma X Aloe and Derma X Pro Beruhigend represent the same product.'
    ),
    (
      'd408aca9-cd16-4cb0-90e7-bab26a698000'::uuid,
      'Head & Shoulders',
      'Head & Shoulders DERMAXPRO Haarshampoo Sensitive Pflege',
      'https://www.rossmann.de/de/pflege-und-duft-head-und-shoulders-dermaxpro-haarshampoo-sensitive-pflege/p/8700216496032',
      4.99,
      'available',
      ARRAY['coarse']::text[],
      ARRAY['irritationen']::text[],
      true,
      'Head & Shoulders DERMAXPRO Haarshampoo Sensitive Pflege covers the reviewed sheet alias Derma X Pro Sensitive.'
    )
) AS dermaxpro_updates(
  id,
  brand,
  name,
  affiliate_link,
  price_eur,
  purchase_link_status,
  suitable_thicknesses,
  suitable_concerns,
  is_active,
  description
)
WHERE public.products.id = dermaxpro_updates.id;

DELETE FROM public.product_shampoo_specs
WHERE product_id IN (
  '088b1427-ed22-424e-8cfd-ea2578120ae6'::uuid,
  '686df4f6-4e8f-48e7-b823-5b1e89dd9cf2'::uuid,
  'd408aca9-cd16-4cb0-90e7-bab26a698000'::uuid
);

INSERT INTO public.product_shampoo_specs (
  product_id,
  thickness,
  shampoo_bucket,
  scalp_route,
  cleansing_intensity
)
VALUES
  (
    '088b1427-ed22-424e-8cfd-ea2578120ae6'::uuid,
    'fine',
    'schuppen',
    'dandruff',
    'gentle'
  ),
  (
    '088b1427-ed22-424e-8cfd-ea2578120ae6'::uuid,
    'coarse',
    'schuppen',
    'dandruff',
    'gentle'
  ),
  (
    'd408aca9-cd16-4cb0-90e7-bab26a698000'::uuid,
    'coarse',
    'irritationen',
    'irritated',
    'gentle'
  )
ON CONFLICT (product_id, thickness, shampoo_bucket) DO UPDATE
SET
  scalp_route = EXCLUDED.scalp_route,
  cleansing_intensity = EXCLUDED.cleansing_intensity,
  updated_at = now();

-- Apply reviewed full-catalog purchase-link statuses here.
-- Every product row must receive exactly one binary state before NOT NULL.
-- The NOT NULL gate belongs in the generated full-catalog status backfill
-- migration after the reviewed audit proposal has classified every row.

COMMIT;

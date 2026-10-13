-- Shampoo T7 weight check, Nick ruling 2026-10-13; informational in scalp cells (R19).
-- Source: sealed run-2-v1.6.2, conservative merged rows from consolidate_run2.py.
-- 73 Track A apply targets + held A50 Sebamed Anti Schuppen Plus. See plans/shampoo-weight-check/README.md.
-- Weight is product truth, repeated consistently on every contextual spec row.
-- No default: products without sealed research retain NULL.
BEGIN;

-- Serialize category/spec writers before the target guard and keep locks through assertions.
LOCK TABLE public.product_shampoo_specs, public.products IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.product_shampoo_specs
  ADD COLUMN weight text,
  ADD CONSTRAINT product_shampoo_specs_weight_check
    CHECK (weight IS NULL OR weight IN ('light', 'moderate', 'heavy'));

CREATE TEMP TABLE shampoo_weight_targets (
  product_id uuid PRIMARY KEY,
  weight text NOT NULL CHECK (weight IN ('light', 'moderate', 'heavy'))
) ON COMMIT DROP;
INSERT INTO shampoo_weight_targets (product_id, weight) VALUES
  ('b000d235-1fc6-434c-9ba1-f1207d36cded'::uuid, 'light'),
  ('ead1333b-6839-464d-b272-673d39bb95a4'::uuid, 'light'),
  ('eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d'::uuid, 'light'),
  ('1311e51c-7941-4d2c-b9b4-7a450ee37f15'::uuid, 'light'),
  ('a79513be-e34b-4a1e-b7eb-b3d4b58160be'::uuid, 'light'),
  ('f184aef4-d8f9-4956-bcd6-ba1bf1ebeace'::uuid, 'light'),
  ('4a45948b-53a6-48ac-9c02-20718c1d19c4'::uuid, 'moderate'),
  ('1f51a69f-c946-4898-9091-2fd2c59fb467'::uuid, 'moderate'),
  ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4'::uuid, 'light'),
  ('cd7461cc-7fde-40dd-8d39-fca1aa8f30bf'::uuid, 'light'),
  ('02afbd03-1c7d-467c-8a07-a8b226d6f535'::uuid, 'light'),
  ('9bfad335-a086-45a0-9af7-f26b36b4ecff'::uuid, 'light'),
  ('a06cfc4d-c4f5-457e-a94e-26559f96f0e9'::uuid, 'moderate'),
  ('c07a181b-3d55-4d47-ad68-9c1e324d4496'::uuid, 'moderate'),
  ('17b6d50e-ca5b-4f66-bdd7-39bd19afe748'::uuid, 'moderate'),
  ('716a4f4e-6ba4-4742-a1cf-75e90ae1da3f'::uuid, 'light'),
  ('d408aca9-cd16-4cb0-90e7-bab26a698000'::uuid, 'moderate'),
  ('2e887538-3b92-4344-9bbd-1761383ba4a6'::uuid, 'light'),
  ('a836ef4f-f406-4557-b908-0155919e2c4f'::uuid, 'light'),
  ('a1451c9b-fb55-406d-a81f-c513cc4ddcdf'::uuid, 'light'),
  ('8a90f0fa-9cb1-458a-93f3-c2374e6d8f16'::uuid, 'moderate'),
  ('94829f16-b21d-4061-9dcc-cbd43dcb4274'::uuid, 'light'),
  ('34697aec-761c-45e7-9a92-986f786dd022'::uuid, 'light'),
  ('86f44889-b2c9-40a1-9190-58d7f738b6ca'::uuid, 'light'),
  ('88c230c5-1020-4648-a10e-c2a1e8c87e0e'::uuid, 'light'),
  ('cc9318d2-13af-4c83-8b5e-7effb687c92f'::uuid, 'moderate'),
  ('1623a993-3ff4-43be-82c1-95a1ee57ec52'::uuid, 'light'),
  ('e76e0ed4-bd20-40cd-84ae-e93030610d40'::uuid, 'moderate'),
  ('6dc65df2-2466-43e4-bdc2-3a05803f305c'::uuid, 'moderate'),
  ('a7ff335a-7e81-4cf4-9c20-9209bff4386b'::uuid, 'light'),
  ('64fb44d5-8701-46ab-bcba-f1747f071e48'::uuid, 'light'),
  ('eb99d805-20d4-4dbb-9651-17c9e954a769'::uuid, 'moderate'),
  ('f033afbe-281a-419e-a245-3ad83d721bd0'::uuid, 'moderate'),
  ('3f3c7d89-9e7b-4e91-85f7-d3c58d304918'::uuid, 'moderate'),
  ('2ecd3c9d-90f6-45a3-a72c-daefed50be10'::uuid, 'heavy'),
  ('7b5ec424-d21f-4eb8-999e-7aed98e94b86'::uuid, 'moderate'),
  ('5effc311-25d7-44dd-8c16-b93c182068d3'::uuid, 'moderate'),
  ('fcbc469f-93c8-4be5-85db-e789b09189c7'::uuid, 'moderate'),
  ('6fde3fe2-3850-4502-b9f2-ebb17eb13bad'::uuid, 'light'),
  ('1ef2be82-259c-4a1f-af2e-3ac3403f9731'::uuid, 'light'),
  ('261e5c9f-d312-4206-82da-fbd0ab6f3614'::uuid, 'light'),
  ('57bae8c8-0ebd-4722-b955-c760d8ffcdbb'::uuid, 'light'),
  ('678119a0-9070-4faf-b9ed-7c0ac008767e'::uuid, 'light'),
  ('9d8d4709-4041-495e-98ee-e0261fa30e27'::uuid, 'moderate'),
  ('e4e4fd05-33fd-4048-9553-76815bff5d43'::uuid, 'heavy'),
  ('e859d6e0-e991-4081-84b5-b81862c82475'::uuid, 'light'),
  ('3405f33b-ae5f-4185-b72b-68c9a87f7c06'::uuid, 'moderate'),
  ('bb1b029f-a8fa-4276-8268-f6ce418128c7'::uuid, 'moderate'),
  ('303b4c0c-53a4-46de-883d-c29e448ee590'::uuid, 'light'),
  ('7e95671b-41a7-4f5c-9188-e535e46678ba'::uuid, 'light'),
  ('51a0b647-2794-49a3-96e1-e7695432561e'::uuid, 'light'),
  ('515de93c-1c77-465d-ae0d-2a8d6ddb3d73'::uuid, 'light'),
  ('b761256d-c0d2-4413-9fa5-8ab950ef69bf'::uuid, 'moderate'),
  ('f8a8fd56-aeb0-4096-8d9d-5af484e3889f'::uuid, 'light'),
  ('0ab645f9-d46d-4cf2-96a5-b5e00f74cae2'::uuid, 'moderate'),
  ('744de604-d266-453b-a56b-eea92c5ca565'::uuid, 'light'),
  ('088b1427-ed22-424e-8cfd-ea2578120ae6'::uuid, 'moderate'),
  ('e7bfd306-b128-4735-a9f8-0eeacdbd5013'::uuid, 'light'),
  ('7373656d-5fd7-46e8-81a3-2ef29e3c4c18'::uuid, 'moderate'),
  ('0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33'::uuid, 'moderate'),
  ('03b847e5-01b9-40e5-950a-98efc73abb3a'::uuid, 'light'),
  ('22f95dcb-12de-4d62-b206-f03dbd6e94a0'::uuid, 'light'),
  ('a1c3dc8d-2638-497f-8c7f-9b491c9003b0'::uuid, 'moderate'),
  ('4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946'::uuid, 'moderate'),
  ('286071ba-9c9a-4c60-979c-7e51df949fbf'::uuid, 'light'),
  ('16ebefbe-48d8-4c7f-9c81-b903651a6e03'::uuid, 'moderate'),
  ('d01de47e-e360-4b31-9924-e3e5bc31ccdc'::uuid, 'light'),
  ('3d94c017-9edb-4ba0-accd-4772e262f012'::uuid, 'moderate'),
  ('0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c'::uuid, 'light'),
  ('41b99629-5a1c-402f-a486-d41780e89e66'::uuid, 'light'),
  ('0d341836-96b3-4364-9319-a7f0884b3da9'::uuid, 'light'),
  ('7200bb0b-7463-433b-86c8-744f5c1431de'::uuid, 'moderate'),
  ('1e61a644-94b0-4356-ab55-f58572fa1e18'::uuid, 'moderate'),
  ('bef4f219-2c1f-4e02-8e3a-93056b95465a'::uuid, 'heavy');

DO $$
BEGIN
  IF (SELECT count(*) FROM shampoo_weight_targets) <> 74 THEN
    RAISE EXCEPTION 'shampoo weight: expected 74 sealed targets';
  END IF;
  IF EXISTS (
    SELECT 1 FROM shampoo_weight_targets t
    LEFT JOIN public.products p ON p.id = t.product_id
    WHERE p.id IS NULL OR p.category_key IS DISTINCT FROM 'shampoo'
  ) THEN
    RAISE EXCEPTION 'shampoo weight: target product missing or category is not shampoo';
  END IF;
  IF EXISTS (
    SELECT 1 FROM shampoo_weight_targets t
    WHERE NOT EXISTS (SELECT 1 FROM public.product_shampoo_specs s WHERE s.product_id = t.product_id)
  ) OR EXISTS (
    SELECT 1 FROM public.product_shampoo_specs s
    JOIN shampoo_weight_targets t ON t.product_id = s.product_id
    WHERE s.category_key IS DISTINCT FROM 'shampoo'
  ) THEN
    RAISE EXCEPTION 'shampoo weight: target specs missing or category is not shampoo';
  END IF;
END $$;

DO $$
DECLARE expected_rows integer; updated_rows integer;
BEGIN
  SELECT count(*) INTO expected_rows FROM public.product_shampoo_specs s
    JOIN shampoo_weight_targets t ON t.product_id = s.product_id;
  UPDATE public.product_shampoo_specs s SET weight = t.weight
    FROM shampoo_weight_targets t WHERE s.product_id = t.product_id;
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> expected_rows THEN
    RAISE EXCEPTION 'shampoo weight: expected % updated rows, got %', expected_rows, updated_rows;
  END IF;
  IF (SELECT count(DISTINCT s.product_id) FROM public.product_shampoo_specs s
      JOIN shampoo_weight_targets t ON t.product_id = s.product_id WHERE s.weight = t.weight) <> 74
    OR EXISTS (SELECT 1 FROM public.product_shampoo_specs s
      JOIN shampoo_weight_targets t ON t.product_id = s.product_id WHERE s.weight IS DISTINCT FROM t.weight)
    OR EXISTS (SELECT 1 FROM public.product_shampoo_specs s WHERE s.weight IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM shampoo_weight_targets t WHERE t.product_id = s.product_id)) THEN
    RAISE EXCEPTION 'shampoo weight: post-assertion failed (target coverage, weight or unresearched product)';
  END IF;
  IF (SELECT count(DISTINCT product_id) FROM public.product_shampoo_specs WHERE weight = 'light') <> 41
    OR (SELECT count(DISTINCT product_id) FROM public.product_shampoo_specs WHERE weight = 'moderate') <> 30
    OR (SELECT count(DISTINCT product_id) FROM public.product_shampoo_specs WHERE weight = 'heavy') <> 3 THEN
    RAISE EXCEPTION 'shampoo weight: expected product weight counts light=41, moderate=30, heavy=3';
  END IF;
END $$;

COMMIT;

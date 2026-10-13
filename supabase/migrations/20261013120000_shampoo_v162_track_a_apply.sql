-- Shampoo v1.6.2 Track A apply (73 live products + the Hask 473 ml successor), Nick 2026-10-12/13.
-- Source: data/research/shampoo-inci/v1.6-track-a/run-2-v1.6.2 (sealed two-lane research, locked v1.6.2),
-- plans/shampoo-v16-rollout/track-a/build_apply.py, rulings plans/shampoo-v16/rulings.md R18-R20.
-- Projection: no-scalp rows only for T7 full-fit thicknesses (distance gives Passt bedingt/nicht);
-- scalp rows for every researched thickness (thickness ignored in scalp cells, R19).
-- Guard: aborts unless the live rows of these products still match the reviewed snapshot.
-- Rollback: public.shampoo_v162_apply_backup_specs / _products hold the previous state.

LOCK TABLE public.product_shampoo_specs, public.products, public.product_thickness_eligibility,
  public.product_concern_eligibility, public.product_identifiers IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE fp text; n int;
BEGIN
  SELECT count(*), md5(string_agg(product_id::text||'|'||thickness||'|'||shampoo_bucket||'|'||coalesce(scalp_route,'')||'|'||coalesce(cleansing_intensity,''), E'\n'
         ORDER BY product_id::text COLLATE "C", thickness COLLATE "C", shampoo_bucket COLLATE "C", coalesce(scalp_route,'') COLLATE "C", coalesce(cleansing_intensity,'') COLLATE "C"))
    INTO n, fp FROM public.product_shampoo_specs WHERE product_id IN ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4','02afbd03-1c7d-467c-8a07-a8b226d6f535','03b847e5-01b9-40e5-950a-98efc73abb3a','088b1427-ed22-424e-8cfd-ea2578120ae6','0ab645f9-d46d-4cf2-96a5-b5e00f74cae2','0d341836-96b3-4364-9319-a7f0884b3da9','0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33','0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c','1311e51c-7941-4d2c-b9b4-7a450ee37f15','1623a993-3ff4-43be-82c1-95a1ee57ec52','16ebefbe-48d8-4c7f-9c81-b903651a6e03','17b6d50e-ca5b-4f66-bdd7-39bd19afe748','1e61a644-94b0-4356-ab55-f58572fa1e18','1ef2be82-259c-4a1f-af2e-3ac3403f9731','1f51a69f-c946-4898-9091-2fd2c59fb467','22f95dcb-12de-4d62-b206-f03dbd6e94a0','261e5c9f-d312-4206-82da-fbd0ab6f3614','286071ba-9c9a-4c60-979c-7e51df949fbf','2e887538-3b92-4344-9bbd-1761383ba4a6','2ecd3c9d-90f6-45a3-a72c-daefed50be10','303b4c0c-53a4-46de-883d-c29e448ee590','3405f33b-ae5f-4185-b72b-68c9a87f7c06','34697aec-761c-45e7-9a92-986f786dd022','3d94c017-9edb-4ba0-accd-4772e262f012','3f3c7d89-9e7b-4e91-85f7-d3c58d304918','41b99629-5a1c-402f-a486-d41780e89e66','4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946','4a45948b-53a6-48ac-9c02-20718c1d19c4','515de93c-1c77-465d-ae0d-2a8d6ddb3d73','51a0b647-2794-49a3-96e1-e7695432561e','57bae8c8-0ebd-4722-b955-c760d8ffcdbb','5effc311-25d7-44dd-8c16-b93c182068d3','64fb44d5-8701-46ab-bcba-f1747f071e48','678119a0-9070-4faf-b9ed-7c0ac008767e','6dc65df2-2466-43e4-bdc2-3a05803f305c','6fde3fe2-3850-4502-b9f2-ebb17eb13bad','716a4f4e-6ba4-4742-a1cf-75e90ae1da3f','7200bb0b-7463-433b-86c8-744f5c1431de','7373656d-5fd7-46e8-81a3-2ef29e3c4c18','744de604-d266-453b-a56b-eea92c5ca565','7b5ec424-d21f-4eb8-999e-7aed98e94b86','7e95671b-41a7-4f5c-9188-e535e46678ba','86f44889-b2c9-40a1-9190-58d7f738b6ca','88c230c5-1020-4648-a10e-c2a1e8c87e0e','8a90f0fa-9cb1-458a-93f3-c2374e6d8f16','94829f16-b21d-4061-9dcc-cbd43dcb4274','9bfad335-a086-45a0-9af7-f26b36b4ecff','9d8d4709-4041-495e-98ee-e0261fa30e27','a06cfc4d-c4f5-457e-a94e-26559f96f0e9','a1451c9b-fb55-406d-a81f-c513cc4ddcdf','a1c3dc8d-2638-497f-8c7f-9b491c9003b0','a79513be-e34b-4a1e-b7eb-b3d4b58160be','a7ff335a-7e81-4cf4-9c20-9209bff4386b','a836ef4f-f406-4557-b908-0155919e2c4f','b000d235-1fc6-434c-9ba1-f1207d36cded','b761256d-c0d2-4413-9fa5-8ab950ef69bf','bb1b029f-a8fa-4276-8268-f6ce418128c7','bef4f219-2c1f-4e02-8e3a-93056b95465a','c07a181b-3d55-4d47-ad68-9c1e324d4496','cc9318d2-13af-4c83-8b5e-7effb687c92f','cd7461cc-7fde-40dd-8d39-fca1aa8f30bf','d01de47e-e360-4b31-9924-e3e5bc31ccdc','d408aca9-cd16-4cb0-90e7-bab26a698000','e4e4fd05-33fd-4048-9553-76815bff5d43','e76e0ed4-bd20-40cd-84ae-e93030610d40','e7bfd306-b128-4735-a9f8-0eeacdbd5013','e859d6e0-e991-4081-84b5-b81862c82475','ead1333b-6839-464d-b272-673d39bb95a4','eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','eb99d805-20d4-4dbb-9651-17c9e954a769','f033afbe-281a-419e-a245-3ad83d721bd0','f184aef4-d8f9-4956-bcd6-ba1bf1ebeace','f8a8fd56-aeb0-4096-8d9d-5af484e3889f','fcbc469f-93c8-4be5-85db-e789b09189c7');
  IF n <> 102 OR fp <> 'b6885a73fac70975cd93d28c9ebc0665' THEN
    RAISE EXCEPTION 'shampoo v1.6.2 apply: live rows changed since review (n=%, fp=%)', n, fp;
  END IF;
END $$;

CREATE TABLE public.shampoo_v162_apply_backup_specs AS
  SELECT * FROM public.product_shampoo_specs WHERE product_id IN ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4','02afbd03-1c7d-467c-8a07-a8b226d6f535','03b847e5-01b9-40e5-950a-98efc73abb3a','088b1427-ed22-424e-8cfd-ea2578120ae6','0ab645f9-d46d-4cf2-96a5-b5e00f74cae2','0d341836-96b3-4364-9319-a7f0884b3da9','0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33','0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c','1311e51c-7941-4d2c-b9b4-7a450ee37f15','1623a993-3ff4-43be-82c1-95a1ee57ec52','16ebefbe-48d8-4c7f-9c81-b903651a6e03','17b6d50e-ca5b-4f66-bdd7-39bd19afe748','1e61a644-94b0-4356-ab55-f58572fa1e18','1ef2be82-259c-4a1f-af2e-3ac3403f9731','1f51a69f-c946-4898-9091-2fd2c59fb467','22f95dcb-12de-4d62-b206-f03dbd6e94a0','261e5c9f-d312-4206-82da-fbd0ab6f3614','286071ba-9c9a-4c60-979c-7e51df949fbf','2e887538-3b92-4344-9bbd-1761383ba4a6','2ecd3c9d-90f6-45a3-a72c-daefed50be10','303b4c0c-53a4-46de-883d-c29e448ee590','3405f33b-ae5f-4185-b72b-68c9a87f7c06','34697aec-761c-45e7-9a92-986f786dd022','3d94c017-9edb-4ba0-accd-4772e262f012','3f3c7d89-9e7b-4e91-85f7-d3c58d304918','41b99629-5a1c-402f-a486-d41780e89e66','4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946','4a45948b-53a6-48ac-9c02-20718c1d19c4','515de93c-1c77-465d-ae0d-2a8d6ddb3d73','51a0b647-2794-49a3-96e1-e7695432561e','57bae8c8-0ebd-4722-b955-c760d8ffcdbb','5effc311-25d7-44dd-8c16-b93c182068d3','64fb44d5-8701-46ab-bcba-f1747f071e48','678119a0-9070-4faf-b9ed-7c0ac008767e','6dc65df2-2466-43e4-bdc2-3a05803f305c','6fde3fe2-3850-4502-b9f2-ebb17eb13bad','716a4f4e-6ba4-4742-a1cf-75e90ae1da3f','7200bb0b-7463-433b-86c8-744f5c1431de','7373656d-5fd7-46e8-81a3-2ef29e3c4c18','744de604-d266-453b-a56b-eea92c5ca565','7b5ec424-d21f-4eb8-999e-7aed98e94b86','86f44889-b2c9-40a1-9190-58d7f738b6ca','88c230c5-1020-4648-a10e-c2a1e8c87e0e','8a90f0fa-9cb1-458a-93f3-c2374e6d8f16','94829f16-b21d-4061-9dcc-cbd43dcb4274','9bfad335-a086-45a0-9af7-f26b36b4ecff','9d8d4709-4041-495e-98ee-e0261fa30e27','a06cfc4d-c4f5-457e-a94e-26559f96f0e9','a1451c9b-fb55-406d-a81f-c513cc4ddcdf','a1c3dc8d-2638-497f-8c7f-9b491c9003b0','a79513be-e34b-4a1e-b7eb-b3d4b58160be','a7ff335a-7e81-4cf4-9c20-9209bff4386b','a836ef4f-f406-4557-b908-0155919e2c4f','b000d235-1fc6-434c-9ba1-f1207d36cded','b761256d-c0d2-4413-9fa5-8ab950ef69bf','bb1b029f-a8fa-4276-8268-f6ce418128c7','bef4f219-2c1f-4e02-8e3a-93056b95465a','c07a181b-3d55-4d47-ad68-9c1e324d4496','cc9318d2-13af-4c83-8b5e-7effb687c92f','cd7461cc-7fde-40dd-8d39-fca1aa8f30bf','d01de47e-e360-4b31-9924-e3e5bc31ccdc','d408aca9-cd16-4cb0-90e7-bab26a698000','e4e4fd05-33fd-4048-9553-76815bff5d43','e76e0ed4-bd20-40cd-84ae-e93030610d40','e7bfd306-b128-4735-a9f8-0eeacdbd5013','e859d6e0-e991-4081-84b5-b81862c82475','ead1333b-6839-464d-b272-673d39bb95a4','eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','eb99d805-20d4-4dbb-9651-17c9e954a769','f033afbe-281a-419e-a245-3ad83d721bd0','f184aef4-d8f9-4956-bcd6-ba1bf1ebeace','f8a8fd56-aeb0-4096-8d9d-5af484e3889f','fcbc469f-93c8-4be5-85db-e789b09189c7');
CREATE TABLE public.shampoo_v162_apply_backup_products AS
  SELECT id, name, suitable_thicknesses, is_chaarlie_recommended FROM public.products WHERE id IN ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4','02afbd03-1c7d-467c-8a07-a8b226d6f535','03b847e5-01b9-40e5-950a-98efc73abb3a','088b1427-ed22-424e-8cfd-ea2578120ae6','0ab645f9-d46d-4cf2-96a5-b5e00f74cae2','0d341836-96b3-4364-9319-a7f0884b3da9','0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33','0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c','1311e51c-7941-4d2c-b9b4-7a450ee37f15','1623a993-3ff4-43be-82c1-95a1ee57ec52','16ebefbe-48d8-4c7f-9c81-b903651a6e03','17b6d50e-ca5b-4f66-bdd7-39bd19afe748','1e61a644-94b0-4356-ab55-f58572fa1e18','1ef2be82-259c-4a1f-af2e-3ac3403f9731','1f51a69f-c946-4898-9091-2fd2c59fb467','22f95dcb-12de-4d62-b206-f03dbd6e94a0','261e5c9f-d312-4206-82da-fbd0ab6f3614','286071ba-9c9a-4c60-979c-7e51df949fbf','2e887538-3b92-4344-9bbd-1761383ba4a6','2ecd3c9d-90f6-45a3-a72c-daefed50be10','303b4c0c-53a4-46de-883d-c29e448ee590','3405f33b-ae5f-4185-b72b-68c9a87f7c06','34697aec-761c-45e7-9a92-986f786dd022','3d94c017-9edb-4ba0-accd-4772e262f012','3f3c7d89-9e7b-4e91-85f7-d3c58d304918','41b99629-5a1c-402f-a486-d41780e89e66','4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946','4a45948b-53a6-48ac-9c02-20718c1d19c4','515de93c-1c77-465d-ae0d-2a8d6ddb3d73','51a0b647-2794-49a3-96e1-e7695432561e','57bae8c8-0ebd-4722-b955-c760d8ffcdbb','5effc311-25d7-44dd-8c16-b93c182068d3','64fb44d5-8701-46ab-bcba-f1747f071e48','678119a0-9070-4faf-b9ed-7c0ac008767e','6dc65df2-2466-43e4-bdc2-3a05803f305c','6fde3fe2-3850-4502-b9f2-ebb17eb13bad','716a4f4e-6ba4-4742-a1cf-75e90ae1da3f','7200bb0b-7463-433b-86c8-744f5c1431de','7373656d-5fd7-46e8-81a3-2ef29e3c4c18','744de604-d266-453b-a56b-eea92c5ca565','7b5ec424-d21f-4eb8-999e-7aed98e94b86','86f44889-b2c9-40a1-9190-58d7f738b6ca','88c230c5-1020-4648-a10e-c2a1e8c87e0e','8a90f0fa-9cb1-458a-93f3-c2374e6d8f16','94829f16-b21d-4061-9dcc-cbd43dcb4274','9bfad335-a086-45a0-9af7-f26b36b4ecff','9d8d4709-4041-495e-98ee-e0261fa30e27','a06cfc4d-c4f5-457e-a94e-26559f96f0e9','a1451c9b-fb55-406d-a81f-c513cc4ddcdf','a1c3dc8d-2638-497f-8c7f-9b491c9003b0','a79513be-e34b-4a1e-b7eb-b3d4b58160be','a7ff335a-7e81-4cf4-9c20-9209bff4386b','a836ef4f-f406-4557-b908-0155919e2c4f','b000d235-1fc6-434c-9ba1-f1207d36cded','b761256d-c0d2-4413-9fa5-8ab950ef69bf','bb1b029f-a8fa-4276-8268-f6ce418128c7','bef4f219-2c1f-4e02-8e3a-93056b95465a','c07a181b-3d55-4d47-ad68-9c1e324d4496','cc9318d2-13af-4c83-8b5e-7effb687c92f','cd7461cc-7fde-40dd-8d39-fca1aa8f30bf','d01de47e-e360-4b31-9924-e3e5bc31ccdc','d408aca9-cd16-4cb0-90e7-bab26a698000','e4e4fd05-33fd-4048-9553-76815bff5d43','e76e0ed4-bd20-40cd-84ae-e93030610d40','e7bfd306-b128-4735-a9f8-0eeacdbd5013','e859d6e0-e991-4081-84b5-b81862c82475','ead1333b-6839-464d-b272-673d39bb95a4','eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','eb99d805-20d4-4dbb-9651-17c9e954a769','f033afbe-281a-419e-a245-3ad83d721bd0','f184aef4-d8f9-4956-bcd6-ba1bf1ebeace','f8a8fd56-aeb0-4096-8d9d-5af484e3889f','fcbc469f-93c8-4be5-85db-e789b09189c7');
CREATE TABLE public.shampoo_v162_apply_backup_thickness_elig AS
  SELECT * FROM public.product_thickness_eligibility WHERE category_key = 'shampoo' AND product_id IN ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4','02afbd03-1c7d-467c-8a07-a8b226d6f535','03b847e5-01b9-40e5-950a-98efc73abb3a','088b1427-ed22-424e-8cfd-ea2578120ae6','0ab645f9-d46d-4cf2-96a5-b5e00f74cae2','0d341836-96b3-4364-9319-a7f0884b3da9','0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33','0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c','1311e51c-7941-4d2c-b9b4-7a450ee37f15','1623a993-3ff4-43be-82c1-95a1ee57ec52','16ebefbe-48d8-4c7f-9c81-b903651a6e03','17b6d50e-ca5b-4f66-bdd7-39bd19afe748','1e61a644-94b0-4356-ab55-f58572fa1e18','1ef2be82-259c-4a1f-af2e-3ac3403f9731','1f51a69f-c946-4898-9091-2fd2c59fb467','22f95dcb-12de-4d62-b206-f03dbd6e94a0','261e5c9f-d312-4206-82da-fbd0ab6f3614','286071ba-9c9a-4c60-979c-7e51df949fbf','2e887538-3b92-4344-9bbd-1761383ba4a6','2ecd3c9d-90f6-45a3-a72c-daefed50be10','303b4c0c-53a4-46de-883d-c29e448ee590','3405f33b-ae5f-4185-b72b-68c9a87f7c06','34697aec-761c-45e7-9a92-986f786dd022','3d94c017-9edb-4ba0-accd-4772e262f012','3f3c7d89-9e7b-4e91-85f7-d3c58d304918','41b99629-5a1c-402f-a486-d41780e89e66','4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946','4a45948b-53a6-48ac-9c02-20718c1d19c4','515de93c-1c77-465d-ae0d-2a8d6ddb3d73','51a0b647-2794-49a3-96e1-e7695432561e','57bae8c8-0ebd-4722-b955-c760d8ffcdbb','5effc311-25d7-44dd-8c16-b93c182068d3','64fb44d5-8701-46ab-bcba-f1747f071e48','678119a0-9070-4faf-b9ed-7c0ac008767e','6dc65df2-2466-43e4-bdc2-3a05803f305c','6fde3fe2-3850-4502-b9f2-ebb17eb13bad','716a4f4e-6ba4-4742-a1cf-75e90ae1da3f','7200bb0b-7463-433b-86c8-744f5c1431de','7373656d-5fd7-46e8-81a3-2ef29e3c4c18','744de604-d266-453b-a56b-eea92c5ca565','7b5ec424-d21f-4eb8-999e-7aed98e94b86','86f44889-b2c9-40a1-9190-58d7f738b6ca','88c230c5-1020-4648-a10e-c2a1e8c87e0e','8a90f0fa-9cb1-458a-93f3-c2374e6d8f16','94829f16-b21d-4061-9dcc-cbd43dcb4274','9bfad335-a086-45a0-9af7-f26b36b4ecff','9d8d4709-4041-495e-98ee-e0261fa30e27','a06cfc4d-c4f5-457e-a94e-26559f96f0e9','a1451c9b-fb55-406d-a81f-c513cc4ddcdf','a1c3dc8d-2638-497f-8c7f-9b491c9003b0','a79513be-e34b-4a1e-b7eb-b3d4b58160be','a7ff335a-7e81-4cf4-9c20-9209bff4386b','a836ef4f-f406-4557-b908-0155919e2c4f','b000d235-1fc6-434c-9ba1-f1207d36cded','b761256d-c0d2-4413-9fa5-8ab950ef69bf','bb1b029f-a8fa-4276-8268-f6ce418128c7','bef4f219-2c1f-4e02-8e3a-93056b95465a','c07a181b-3d55-4d47-ad68-9c1e324d4496','cc9318d2-13af-4c83-8b5e-7effb687c92f','cd7461cc-7fde-40dd-8d39-fca1aa8f30bf','d01de47e-e360-4b31-9924-e3e5bc31ccdc','d408aca9-cd16-4cb0-90e7-bab26a698000','e4e4fd05-33fd-4048-9553-76815bff5d43','e76e0ed4-bd20-40cd-84ae-e93030610d40','e7bfd306-b128-4735-a9f8-0eeacdbd5013','e859d6e0-e991-4081-84b5-b81862c82475','ead1333b-6839-464d-b272-673d39bb95a4','eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','eb99d805-20d4-4dbb-9651-17c9e954a769','f033afbe-281a-419e-a245-3ad83d721bd0','f184aef4-d8f9-4956-bcd6-ba1bf1ebeace','f8a8fd56-aeb0-4096-8d9d-5af484e3889f','fcbc469f-93c8-4be5-85db-e789b09189c7');
CREATE TABLE public.shampoo_v162_apply_backup_concern_elig AS
  SELECT * FROM public.product_concern_eligibility WHERE category_key = 'shampoo' AND product_id IN ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4','02afbd03-1c7d-467c-8a07-a8b226d6f535','03b847e5-01b9-40e5-950a-98efc73abb3a','088b1427-ed22-424e-8cfd-ea2578120ae6','0ab645f9-d46d-4cf2-96a5-b5e00f74cae2','0d341836-96b3-4364-9319-a7f0884b3da9','0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33','0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c','1311e51c-7941-4d2c-b9b4-7a450ee37f15','1623a993-3ff4-43be-82c1-95a1ee57ec52','16ebefbe-48d8-4c7f-9c81-b903651a6e03','17b6d50e-ca5b-4f66-bdd7-39bd19afe748','1e61a644-94b0-4356-ab55-f58572fa1e18','1ef2be82-259c-4a1f-af2e-3ac3403f9731','1f51a69f-c946-4898-9091-2fd2c59fb467','22f95dcb-12de-4d62-b206-f03dbd6e94a0','261e5c9f-d312-4206-82da-fbd0ab6f3614','286071ba-9c9a-4c60-979c-7e51df949fbf','2e887538-3b92-4344-9bbd-1761383ba4a6','2ecd3c9d-90f6-45a3-a72c-daefed50be10','303b4c0c-53a4-46de-883d-c29e448ee590','3405f33b-ae5f-4185-b72b-68c9a87f7c06','34697aec-761c-45e7-9a92-986f786dd022','3d94c017-9edb-4ba0-accd-4772e262f012','3f3c7d89-9e7b-4e91-85f7-d3c58d304918','41b99629-5a1c-402f-a486-d41780e89e66','4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946','4a45948b-53a6-48ac-9c02-20718c1d19c4','515de93c-1c77-465d-ae0d-2a8d6ddb3d73','51a0b647-2794-49a3-96e1-e7695432561e','57bae8c8-0ebd-4722-b955-c760d8ffcdbb','5effc311-25d7-44dd-8c16-b93c182068d3','64fb44d5-8701-46ab-bcba-f1747f071e48','678119a0-9070-4faf-b9ed-7c0ac008767e','6dc65df2-2466-43e4-bdc2-3a05803f305c','6fde3fe2-3850-4502-b9f2-ebb17eb13bad','716a4f4e-6ba4-4742-a1cf-75e90ae1da3f','7200bb0b-7463-433b-86c8-744f5c1431de','7373656d-5fd7-46e8-81a3-2ef29e3c4c18','744de604-d266-453b-a56b-eea92c5ca565','7b5ec424-d21f-4eb8-999e-7aed98e94b86','86f44889-b2c9-40a1-9190-58d7f738b6ca','88c230c5-1020-4648-a10e-c2a1e8c87e0e','8a90f0fa-9cb1-458a-93f3-c2374e6d8f16','94829f16-b21d-4061-9dcc-cbd43dcb4274','9bfad335-a086-45a0-9af7-f26b36b4ecff','9d8d4709-4041-495e-98ee-e0261fa30e27','a06cfc4d-c4f5-457e-a94e-26559f96f0e9','a1451c9b-fb55-406d-a81f-c513cc4ddcdf','a1c3dc8d-2638-497f-8c7f-9b491c9003b0','a79513be-e34b-4a1e-b7eb-b3d4b58160be','a7ff335a-7e81-4cf4-9c20-9209bff4386b','a836ef4f-f406-4557-b908-0155919e2c4f','b000d235-1fc6-434c-9ba1-f1207d36cded','b761256d-c0d2-4413-9fa5-8ab950ef69bf','bb1b029f-a8fa-4276-8268-f6ce418128c7','bef4f219-2c1f-4e02-8e3a-93056b95465a','c07a181b-3d55-4d47-ad68-9c1e324d4496','cc9318d2-13af-4c83-8b5e-7effb687c92f','cd7461cc-7fde-40dd-8d39-fca1aa8f30bf','d01de47e-e360-4b31-9924-e3e5bc31ccdc','d408aca9-cd16-4cb0-90e7-bab26a698000','e4e4fd05-33fd-4048-9553-76815bff5d43','e76e0ed4-bd20-40cd-84ae-e93030610d40','e7bfd306-b128-4735-a9f8-0eeacdbd5013','e859d6e0-e991-4081-84b5-b81862c82475','ead1333b-6839-464d-b272-673d39bb95a4','eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','eb99d805-20d4-4dbb-9651-17c9e954a769','f033afbe-281a-419e-a245-3ad83d721bd0','f184aef4-d8f9-4956-bcd6-ba1bf1ebeace','f8a8fd56-aeb0-4096-8d9d-5af484e3889f','fcbc469f-93c8-4be5-85db-e789b09189c7');
ALTER TABLE public.shampoo_v162_apply_backup_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shampoo_v162_apply_backup_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shampoo_v162_apply_backup_thickness_elig ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shampoo_v162_apply_backup_concern_elig ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shampoo_v162_apply_backup_specs, public.shampoo_v162_apply_backup_products,
  public.shampoo_v162_apply_backup_thickness_elig, public.shampoo_v162_apply_backup_concern_elig FROM anon, authenticated;

DELETE FROM public.product_shampoo_specs WHERE product_id IN ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4','02afbd03-1c7d-467c-8a07-a8b226d6f535','03b847e5-01b9-40e5-950a-98efc73abb3a','088b1427-ed22-424e-8cfd-ea2578120ae6','0ab645f9-d46d-4cf2-96a5-b5e00f74cae2','0d341836-96b3-4364-9319-a7f0884b3da9','0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33','0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c','1311e51c-7941-4d2c-b9b4-7a450ee37f15','1623a993-3ff4-43be-82c1-95a1ee57ec52','16ebefbe-48d8-4c7f-9c81-b903651a6e03','17b6d50e-ca5b-4f66-bdd7-39bd19afe748','1e61a644-94b0-4356-ab55-f58572fa1e18','1ef2be82-259c-4a1f-af2e-3ac3403f9731','1f51a69f-c946-4898-9091-2fd2c59fb467','22f95dcb-12de-4d62-b206-f03dbd6e94a0','261e5c9f-d312-4206-82da-fbd0ab6f3614','286071ba-9c9a-4c60-979c-7e51df949fbf','2e887538-3b92-4344-9bbd-1761383ba4a6','2ecd3c9d-90f6-45a3-a72c-daefed50be10','303b4c0c-53a4-46de-883d-c29e448ee590','3405f33b-ae5f-4185-b72b-68c9a87f7c06','34697aec-761c-45e7-9a92-986f786dd022','3d94c017-9edb-4ba0-accd-4772e262f012','3f3c7d89-9e7b-4e91-85f7-d3c58d304918','41b99629-5a1c-402f-a486-d41780e89e66','4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946','4a45948b-53a6-48ac-9c02-20718c1d19c4','515de93c-1c77-465d-ae0d-2a8d6ddb3d73','51a0b647-2794-49a3-96e1-e7695432561e','57bae8c8-0ebd-4722-b955-c760d8ffcdbb','5effc311-25d7-44dd-8c16-b93c182068d3','64fb44d5-8701-46ab-bcba-f1747f071e48','678119a0-9070-4faf-b9ed-7c0ac008767e','6dc65df2-2466-43e4-bdc2-3a05803f305c','6fde3fe2-3850-4502-b9f2-ebb17eb13bad','716a4f4e-6ba4-4742-a1cf-75e90ae1da3f','7200bb0b-7463-433b-86c8-744f5c1431de','7373656d-5fd7-46e8-81a3-2ef29e3c4c18','744de604-d266-453b-a56b-eea92c5ca565','7b5ec424-d21f-4eb8-999e-7aed98e94b86','86f44889-b2c9-40a1-9190-58d7f738b6ca','88c230c5-1020-4648-a10e-c2a1e8c87e0e','8a90f0fa-9cb1-458a-93f3-c2374e6d8f16','94829f16-b21d-4061-9dcc-cbd43dcb4274','9bfad335-a086-45a0-9af7-f26b36b4ecff','9d8d4709-4041-495e-98ee-e0261fa30e27','a06cfc4d-c4f5-457e-a94e-26559f96f0e9','a1451c9b-fb55-406d-a81f-c513cc4ddcdf','a1c3dc8d-2638-497f-8c7f-9b491c9003b0','a79513be-e34b-4a1e-b7eb-b3d4b58160be','a7ff335a-7e81-4cf4-9c20-9209bff4386b','a836ef4f-f406-4557-b908-0155919e2c4f','b000d235-1fc6-434c-9ba1-f1207d36cded','b761256d-c0d2-4413-9fa5-8ab950ef69bf','bb1b029f-a8fa-4276-8268-f6ce418128c7','bef4f219-2c1f-4e02-8e3a-93056b95465a','c07a181b-3d55-4d47-ad68-9c1e324d4496','cc9318d2-13af-4c83-8b5e-7effb687c92f','cd7461cc-7fde-40dd-8d39-fca1aa8f30bf','d01de47e-e360-4b31-9924-e3e5bc31ccdc','d408aca9-cd16-4cb0-90e7-bab26a698000','e4e4fd05-33fd-4048-9553-76815bff5d43','e76e0ed4-bd20-40cd-84ae-e93030610d40','e7bfd306-b128-4735-a9f8-0eeacdbd5013','e859d6e0-e991-4081-84b5-b81862c82475','ead1333b-6839-464d-b272-673d39bb95a4','eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','eb99d805-20d4-4dbb-9651-17c9e954a769','f033afbe-281a-419e-a245-3ad83d721bd0','f184aef4-d8f9-4956-bcd6-ba1bf1ebeace','f8a8fd56-aeb0-4096-8d9d-5af484e3889f','fcbc469f-93c8-4be5-85db-e789b09189c7');

UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '0017381a-84ba-46dd-9b6e-7ef457e8b5b4';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '02afbd03-1c7d-467c-8a07-a8b226d6f535';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '03b847e5-01b9-40e5-950a-98efc73abb3a';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '088b1427-ed22-424e-8cfd-ea2578120ae6';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '0ab645f9-d46d-4cf2-96a5-b5e00f74cae2';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '0d341836-96b3-4364-9319-a7f0884b3da9';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '1311e51c-7941-4d2c-b9b4-7a450ee37f15';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '1623a993-3ff4-43be-82c1-95a1ee57ec52';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '16ebefbe-48d8-4c7f-9c81-b903651a6e03';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '17b6d50e-ca5b-4f66-bdd7-39bd19afe748';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '1e61a644-94b0-4356-ab55-f58572fa1e18';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '1ef2be82-259c-4a1f-af2e-3ac3403f9731';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '1f51a69f-c946-4898-9091-2fd2c59fb467';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '22f95dcb-12de-4d62-b206-f03dbd6e94a0';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '261e5c9f-d312-4206-82da-fbd0ab6f3614';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '286071ba-9c9a-4c60-979c-7e51df949fbf';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '2e887538-3b92-4344-9bbd-1761383ba4a6';
UPDATE public.products SET suitable_thicknesses = ARRAY['coarse']::text[] WHERE id = '2ecd3c9d-90f6-45a3-a72c-daefed50be10';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '303b4c0c-53a4-46de-883d-c29e448ee590';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '3405f33b-ae5f-4185-b72b-68c9a87f7c06';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '34697aec-761c-45e7-9a92-986f786dd022';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '3d94c017-9edb-4ba0-accd-4772e262f012';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '3f3c7d89-9e7b-4e91-85f7-d3c58d304918';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '41b99629-5a1c-402f-a486-d41780e89e66';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '4a45948b-53a6-48ac-9c02-20718c1d19c4';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '515de93c-1c77-465d-ae0d-2a8d6ddb3d73';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '51a0b647-2794-49a3-96e1-e7695432561e';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '57bae8c8-0ebd-4722-b955-c760d8ffcdbb';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '5effc311-25d7-44dd-8c16-b93c182068d3';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '64fb44d5-8701-46ab-bcba-f1747f071e48';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '678119a0-9070-4faf-b9ed-7c0ac008767e';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal','coarse']::text[] WHERE id = '6dc65df2-2466-43e4-bdc2-3a05803f305c';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '6fde3fe2-3850-4502-b9f2-ebb17eb13bad';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '716a4f4e-6ba4-4742-a1cf-75e90ae1da3f';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '7200bb0b-7463-433b-86c8-744f5c1431de';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '7373656d-5fd7-46e8-81a3-2ef29e3c4c18';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '744de604-d266-453b-a56b-eea92c5ca565';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '7b5ec424-d21f-4eb8-999e-7aed98e94b86';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '86f44889-b2c9-40a1-9190-58d7f738b6ca';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '88c230c5-1020-4648-a10e-c2a1e8c87e0e';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = '8a90f0fa-9cb1-458a-93f3-c2374e6d8f16';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '94829f16-b21d-4061-9dcc-cbd43dcb4274';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = '9bfad335-a086-45a0-9af7-f26b36b4ecff';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = '9d8d4709-4041-495e-98ee-e0261fa30e27';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = 'a06cfc4d-c4f5-457e-a94e-26559f96f0e9';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = 'a1451c9b-fb55-406d-a81f-c513cc4ddcdf';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = 'a1c3dc8d-2638-497f-8c7f-9b491c9003b0';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = 'a79513be-e34b-4a1e-b7eb-b3d4b58160be';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = 'a7ff335a-7e81-4cf4-9c20-9209bff4386b';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = 'a836ef4f-f406-4557-b908-0155919e2c4f';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = 'b000d235-1fc6-434c-9ba1-f1207d36cded';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = 'b761256d-c0d2-4413-9fa5-8ab950ef69bf';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = 'bb1b029f-a8fa-4276-8268-f6ce418128c7';
UPDATE public.products SET suitable_thicknesses = ARRAY['coarse']::text[] WHERE id = 'bef4f219-2c1f-4e02-8e3a-93056b95465a';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = 'c07a181b-3d55-4d47-ad68-9c1e324d4496';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = 'cc9318d2-13af-4c83-8b5e-7effb687c92f';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = 'cd7461cc-7fde-40dd-8d39-fca1aa8f30bf';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = 'd01de47e-e360-4b31-9924-e3e5bc31ccdc';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = 'd408aca9-cd16-4cb0-90e7-bab26a698000';
UPDATE public.products SET suitable_thicknesses = ARRAY['coarse']::text[] WHERE id = 'e4e4fd05-33fd-4048-9553-76815bff5d43';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = 'e76e0ed4-bd20-40cd-84ae-e93030610d40';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = 'e7bfd306-b128-4735-a9f8-0eeacdbd5013';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = 'e859d6e0-e991-4081-84b5-b81862c82475';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = 'ead1333b-6839-464d-b272-673d39bb95a4';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = 'eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = 'eb99d805-20d4-4dbb-9651-17c9e954a769';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = 'f033afbe-281a-419e-a245-3ad83d721bd0';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[] WHERE id = 'f184aef4-d8f9-4956-bcd6-ba1bf1ebeace';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal']::text[] WHERE id = 'f8a8fd56-aeb0-4096-8d9d-5af484e3889f';
UPDATE public.products SET suitable_thicknesses = ARRAY['normal']::text[] WHERE id = 'fcbc469f-93c8-4be5-85db-e789b09189c7';

INSERT INTO public.product_shampoo_specs (product_id, category_key, thickness, shampoo_bucket, scalp_route, cleansing_intensity) VALUES
  ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4','shampoo','fine','normal','balanced','regular'),
  ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4','shampoo','normal','normal','balanced','regular'),
  ('02afbd03-1c7d-467c-8a07-a8b226d6f535','shampoo','fine','irritationen','irritated','regular'),
  ('02afbd03-1c7d-467c-8a07-a8b226d6f535','shampoo','fine','trocken','dry','regular'),
  ('02afbd03-1c7d-467c-8a07-a8b226d6f535','shampoo','normal','irritationen','irritated','regular'),
  ('02afbd03-1c7d-467c-8a07-a8b226d6f535','shampoo','normal','trocken','dry','regular'),
  ('02afbd03-1c7d-467c-8a07-a8b226d6f535','shampoo','coarse','irritationen','irritated','regular'),
  ('02afbd03-1c7d-467c-8a07-a8b226d6f535','shampoo','coarse','trocken','dry','regular'),
  ('03b847e5-01b9-40e5-950a-98efc73abb3a','shampoo','fine','dehydriert-fettig','oily','regular'),
  ('03b847e5-01b9-40e5-950a-98efc73abb3a','shampoo','normal','dehydriert-fettig','oily','regular'),
  ('03b847e5-01b9-40e5-950a-98efc73abb3a','shampoo','coarse','dehydriert-fettig','oily','regular'),
  ('088b1427-ed22-424e-8cfd-ea2578120ae6','shampoo','fine','schuppen','dandruff','regular'),
  ('088b1427-ed22-424e-8cfd-ea2578120ae6','shampoo','normal','schuppen','dandruff','regular'),
  ('088b1427-ed22-424e-8cfd-ea2578120ae6','shampoo','coarse','schuppen','dandruff','regular'),
  ('0ab645f9-d46d-4cf2-96a5-b5e00f74cae2','shampoo','normal','normal','balanced','regular'),
  ('0d341836-96b3-4364-9319-a7f0884b3da9','shampoo','fine','normal','balanced','regular'),
  ('0d341836-96b3-4364-9319-a7f0884b3da9','shampoo','normal','normal','balanced','regular'),
  ('0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33','shampoo','fine','irritationen','irritated','regular'),
  ('0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33','shampoo','normal','irritationen','irritated','regular'),
  ('0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33','shampoo','coarse','irritationen','irritated','regular'),
  ('0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c','shampoo','fine','dehydriert-fettig','oily','regular'),
  ('0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c','shampoo','normal','dehydriert-fettig','oily','regular'),
  ('0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c','shampoo','coarse','dehydriert-fettig','oily','regular'),
  ('1311e51c-7941-4d2c-b9b4-7a450ee37f15','shampoo','fine','normal','balanced','regular'),
  ('1311e51c-7941-4d2c-b9b4-7a450ee37f15','shampoo','normal','normal','balanced','regular'),
  ('1623a993-3ff4-43be-82c1-95a1ee57ec52','shampoo','fine','normal','balanced','gentle'),
  ('1623a993-3ff4-43be-82c1-95a1ee57ec52','shampoo','normal','normal','balanced','gentle'),
  ('16ebefbe-48d8-4c7f-9c81-b903651a6e03','shampoo','normal','normal','balanced','regular'),
  ('17b6d50e-ca5b-4f66-bdd7-39bd19afe748','shampoo','normal','normal','balanced','regular'),
  ('1e61a644-94b0-4356-ab55-f58572fa1e18','shampoo','fine','schuppen','dandruff','regular'),
  ('1e61a644-94b0-4356-ab55-f58572fa1e18','shampoo','normal','schuppen','dandruff','regular'),
  ('1e61a644-94b0-4356-ab55-f58572fa1e18','shampoo','coarse','schuppen','dandruff','regular'),
  ('1ef2be82-259c-4a1f-af2e-3ac3403f9731','shampoo','fine','irritationen','irritated','regular'),
  ('1ef2be82-259c-4a1f-af2e-3ac3403f9731','shampoo','fine','trocken','dry','regular'),
  ('1ef2be82-259c-4a1f-af2e-3ac3403f9731','shampoo','normal','irritationen','irritated','regular'),
  ('1ef2be82-259c-4a1f-af2e-3ac3403f9731','shampoo','normal','trocken','dry','regular'),
  ('1ef2be82-259c-4a1f-af2e-3ac3403f9731','shampoo','coarse','irritationen','irritated','regular'),
  ('1ef2be82-259c-4a1f-af2e-3ac3403f9731','shampoo','coarse','trocken','dry','regular'),
  ('1f51a69f-c946-4898-9091-2fd2c59fb467','shampoo','normal','normal','balanced','regular'),
  ('22f95dcb-12de-4d62-b206-f03dbd6e94a0','shampoo','fine','normal','balanced','regular'),
  ('22f95dcb-12de-4d62-b206-f03dbd6e94a0','shampoo','normal','normal','balanced','regular'),
  ('261e5c9f-d312-4206-82da-fbd0ab6f3614','shampoo','fine','schuppen','dandruff','regular'),
  ('261e5c9f-d312-4206-82da-fbd0ab6f3614','shampoo','normal','schuppen','dandruff','regular'),
  ('261e5c9f-d312-4206-82da-fbd0ab6f3614','shampoo','coarse','schuppen','dandruff','regular'),
  ('286071ba-9c9a-4c60-979c-7e51df949fbf','shampoo','fine','normal','balanced','regular'),
  ('286071ba-9c9a-4c60-979c-7e51df949fbf','shampoo','normal','normal','balanced','regular'),
  ('2e887538-3b92-4344-9bbd-1761383ba4a6','shampoo','fine','normal','balanced','gentle'),
  ('2e887538-3b92-4344-9bbd-1761383ba4a6','shampoo','normal','normal','balanced','gentle'),
  ('2ecd3c9d-90f6-45a3-a72c-daefed50be10','shampoo','coarse','normal','balanced','gentle'),
  ('303b4c0c-53a4-46de-883d-c29e448ee590','shampoo','fine','schuppen','dandruff','regular'),
  ('303b4c0c-53a4-46de-883d-c29e448ee590','shampoo','normal','schuppen','dandruff','regular'),
  ('303b4c0c-53a4-46de-883d-c29e448ee590','shampoo','coarse','schuppen','dandruff','regular'),
  ('3405f33b-ae5f-4185-b72b-68c9a87f7c06','shampoo','normal','normal','balanced','regular'),
  ('34697aec-761c-45e7-9a92-986f786dd022','shampoo','fine','schuppen','dandruff','regular'),
  ('34697aec-761c-45e7-9a92-986f786dd022','shampoo','normal','schuppen','dandruff','regular'),
  ('34697aec-761c-45e7-9a92-986f786dd022','shampoo','coarse','schuppen','dandruff','regular'),
  ('3d94c017-9edb-4ba0-accd-4772e262f012','shampoo','normal','normal','balanced','regular'),
  ('3f3c7d89-9e7b-4e91-85f7-d3c58d304918','shampoo','normal','normal','balanced','gentle'),
  ('41b99629-5a1c-402f-a486-d41780e89e66','shampoo','fine','normal','balanced','clarifying'),
  ('41b99629-5a1c-402f-a486-d41780e89e66','shampoo','normal','normal','balanced','clarifying'),
  ('4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946','shampoo','normal','normal','balanced','regular'),
  ('4a45948b-53a6-48ac-9c02-20718c1d19c4','shampoo','normal','normal','balanced','regular'),
  ('515de93c-1c77-465d-ae0d-2a8d6ddb3d73','shampoo','fine','normal','balanced','regular'),
  ('515de93c-1c77-465d-ae0d-2a8d6ddb3d73','shampoo','normal','normal','balanced','regular'),
  ('51a0b647-2794-49a3-96e1-e7695432561e','shampoo','fine','irritationen','irritated','regular'),
  ('51a0b647-2794-49a3-96e1-e7695432561e','shampoo','fine','trocken','dry','regular'),
  ('51a0b647-2794-49a3-96e1-e7695432561e','shampoo','normal','irritationen','irritated','regular'),
  ('51a0b647-2794-49a3-96e1-e7695432561e','shampoo','normal','trocken','dry','regular'),
  ('51a0b647-2794-49a3-96e1-e7695432561e','shampoo','coarse','irritationen','irritated','regular'),
  ('51a0b647-2794-49a3-96e1-e7695432561e','shampoo','coarse','trocken','dry','regular'),
  ('57bae8c8-0ebd-4722-b955-c760d8ffcdbb','shampoo','fine','normal','balanced','regular'),
  ('57bae8c8-0ebd-4722-b955-c760d8ffcdbb','shampoo','normal','normal','balanced','regular'),
  ('5effc311-25d7-44dd-8c16-b93c182068d3','shampoo','fine','schuppen','dandruff','regular'),
  ('5effc311-25d7-44dd-8c16-b93c182068d3','shampoo','normal','schuppen','dandruff','regular'),
  ('5effc311-25d7-44dd-8c16-b93c182068d3','shampoo','coarse','schuppen','dandruff','regular'),
  ('64fb44d5-8701-46ab-bcba-f1747f071e48','shampoo','fine','normal','balanced','gentle'),
  ('64fb44d5-8701-46ab-bcba-f1747f071e48','shampoo','normal','normal','balanced','gentle'),
  ('678119a0-9070-4faf-b9ed-7c0ac008767e','shampoo','fine','normal','balanced','regular'),
  ('678119a0-9070-4faf-b9ed-7c0ac008767e','shampoo','normal','normal','balanced','regular'),
  ('6dc65df2-2466-43e4-bdc2-3a05803f305c','shampoo','normal','normal','balanced','gentle'),
  ('6dc65df2-2466-43e4-bdc2-3a05803f305c','shampoo','coarse','dehydriert-fettig','oily','regular'),
  ('6fde3fe2-3850-4502-b9f2-ebb17eb13bad','shampoo','fine','normal','balanced','regular'),
  ('6fde3fe2-3850-4502-b9f2-ebb17eb13bad','shampoo','normal','normal','balanced','regular'),
  ('716a4f4e-6ba4-4742-a1cf-75e90ae1da3f','shampoo','fine','schuppen','dandruff','regular'),
  ('716a4f4e-6ba4-4742-a1cf-75e90ae1da3f','shampoo','normal','schuppen','dandruff','regular'),
  ('716a4f4e-6ba4-4742-a1cf-75e90ae1da3f','shampoo','coarse','schuppen','dandruff','regular'),
  ('7200bb0b-7463-433b-86c8-744f5c1431de','shampoo','normal','normal','balanced','clarifying'),
  ('7373656d-5fd7-46e8-81a3-2ef29e3c4c18','shampoo','normal','normal','balanced','regular'),
  ('744de604-d266-453b-a56b-eea92c5ca565','shampoo','fine','schuppen','dandruff','regular'),
  ('744de604-d266-453b-a56b-eea92c5ca565','shampoo','normal','schuppen','dandruff','regular'),
  ('744de604-d266-453b-a56b-eea92c5ca565','shampoo','coarse','schuppen','dandruff','regular'),
  ('7b5ec424-d21f-4eb8-999e-7aed98e94b86','shampoo','normal','normal','balanced','gentle'),
  ('86f44889-b2c9-40a1-9190-58d7f738b6ca','shampoo','fine','normal','balanced','regular'),
  ('86f44889-b2c9-40a1-9190-58d7f738b6ca','shampoo','normal','normal','balanced','regular'),
  ('88c230c5-1020-4648-a10e-c2a1e8c87e0e','shampoo','fine','normal','balanced','regular'),
  ('88c230c5-1020-4648-a10e-c2a1e8c87e0e','shampoo','normal','normal','balanced','regular'),
  ('8a90f0fa-9cb1-458a-93f3-c2374e6d8f16','shampoo','normal','normal','balanced','regular'),
  ('94829f16-b21d-4061-9dcc-cbd43dcb4274','shampoo','fine','irritationen','irritated','regular'),
  ('94829f16-b21d-4061-9dcc-cbd43dcb4274','shampoo','normal','irritationen','irritated','regular'),
  ('94829f16-b21d-4061-9dcc-cbd43dcb4274','shampoo','coarse','irritationen','irritated','regular'),
  ('9bfad335-a086-45a0-9af7-f26b36b4ecff','shampoo','fine','normal','balanced','regular'),
  ('9bfad335-a086-45a0-9af7-f26b36b4ecff','shampoo','normal','normal','balanced','regular'),
  ('9d8d4709-4041-495e-98ee-e0261fa30e27','shampoo','fine','schuppen','dandruff','regular'),
  ('9d8d4709-4041-495e-98ee-e0261fa30e27','shampoo','normal','schuppen','dandruff','regular'),
  ('9d8d4709-4041-495e-98ee-e0261fa30e27','shampoo','coarse','schuppen','dandruff','regular'),
  ('a06cfc4d-c4f5-457e-a94e-26559f96f0e9','shampoo','normal','normal','balanced','regular'),
  ('a1451c9b-fb55-406d-a81f-c513cc4ddcdf','shampoo','fine','irritationen','irritated','regular'),
  ('a1451c9b-fb55-406d-a81f-c513cc4ddcdf','shampoo','normal','irritationen','irritated','regular'),
  ('a1451c9b-fb55-406d-a81f-c513cc4ddcdf','shampoo','coarse','irritationen','irritated','regular'),
  ('a1c3dc8d-2638-497f-8c7f-9b491c9003b0','shampoo','normal','normal','balanced','regular'),
  ('a79513be-e34b-4a1e-b7eb-b3d4b58160be','shampoo','fine','irritationen','irritated','regular'),
  ('a79513be-e34b-4a1e-b7eb-b3d4b58160be','shampoo','normal','irritationen','irritated','regular'),
  ('a79513be-e34b-4a1e-b7eb-b3d4b58160be','shampoo','coarse','irritationen','irritated','regular'),
  ('a7ff335a-7e81-4cf4-9c20-9209bff4386b','shampoo','fine','normal','balanced','gentle'),
  ('a7ff335a-7e81-4cf4-9c20-9209bff4386b','shampoo','normal','normal','balanced','gentle'),
  ('a836ef4f-f406-4557-b908-0155919e2c4f','shampoo','fine','schuppen','dandruff','regular'),
  ('a836ef4f-f406-4557-b908-0155919e2c4f','shampoo','normal','schuppen','dandruff','regular'),
  ('a836ef4f-f406-4557-b908-0155919e2c4f','shampoo','coarse','schuppen','dandruff','regular'),
  ('b000d235-1fc6-434c-9ba1-f1207d36cded','shampoo','fine','irritationen','irritated','regular'),
  ('b000d235-1fc6-434c-9ba1-f1207d36cded','shampoo','fine','trocken','dry','regular'),
  ('b000d235-1fc6-434c-9ba1-f1207d36cded','shampoo','normal','irritationen','irritated','regular'),
  ('b000d235-1fc6-434c-9ba1-f1207d36cded','shampoo','normal','trocken','dry','regular'),
  ('b000d235-1fc6-434c-9ba1-f1207d36cded','shampoo','coarse','irritationen','irritated','regular'),
  ('b000d235-1fc6-434c-9ba1-f1207d36cded','shampoo','coarse','trocken','dry','regular'),
  ('b761256d-c0d2-4413-9fa5-8ab950ef69bf','shampoo','normal','normal','balanced','regular'),
  ('bb1b029f-a8fa-4276-8268-f6ce418128c7','shampoo','normal','normal','balanced','regular'),
  ('bef4f219-2c1f-4e02-8e3a-93056b95465a','shampoo','coarse','normal','balanced','gentle'),
  ('c07a181b-3d55-4d47-ad68-9c1e324d4496','shampoo','normal','normal','balanced','regular'),
  ('cc9318d2-13af-4c83-8b5e-7effb687c92f','shampoo','normal','normal','balanced','regular'),
  ('cd7461cc-7fde-40dd-8d39-fca1aa8f30bf','shampoo','fine','dehydriert-fettig','oily','regular'),
  ('cd7461cc-7fde-40dd-8d39-fca1aa8f30bf','shampoo','normal','dehydriert-fettig','oily','regular'),
  ('cd7461cc-7fde-40dd-8d39-fca1aa8f30bf','shampoo','coarse','dehydriert-fettig','oily','regular'),
  ('d01de47e-e360-4b31-9924-e3e5bc31ccdc','shampoo','fine','normal','balanced','regular'),
  ('d01de47e-e360-4b31-9924-e3e5bc31ccdc','shampoo','normal','normal','balanced','regular'),
  ('d408aca9-cd16-4cb0-90e7-bab26a698000','shampoo','normal','normal','balanced','regular'),
  ('e4e4fd05-33fd-4048-9553-76815bff5d43','shampoo','coarse','normal','balanced','regular'),
  ('e76e0ed4-bd20-40cd-84ae-e93030610d40','shampoo','normal','normal','balanced','regular'),
  ('e7bfd306-b128-4735-a9f8-0eeacdbd5013','shampoo','fine','irritationen','irritated','gentle'),
  ('e7bfd306-b128-4735-a9f8-0eeacdbd5013','shampoo','normal','irritationen','irritated','gentle'),
  ('e7bfd306-b128-4735-a9f8-0eeacdbd5013','shampoo','coarse','irritationen','irritated','gentle'),
  ('e859d6e0-e991-4081-84b5-b81862c82475','shampoo','fine','normal','balanced','regular'),
  ('e859d6e0-e991-4081-84b5-b81862c82475','shampoo','normal','normal','balanced','regular'),
  ('ead1333b-6839-464d-b272-673d39bb95a4','shampoo','fine','normal','balanced','regular'),
  ('ead1333b-6839-464d-b272-673d39bb95a4','shampoo','normal','normal','balanced','regular'),
  ('eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','shampoo','fine','irritationen','irritated','regular'),
  ('eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','shampoo','fine','trocken','dry','regular'),
  ('eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','shampoo','normal','irritationen','irritated','regular'),
  ('eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','shampoo','normal','trocken','dry','regular'),
  ('eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','shampoo','coarse','irritationen','irritated','regular'),
  ('eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','shampoo','coarse','trocken','dry','regular'),
  ('eb99d805-20d4-4dbb-9651-17c9e954a769','shampoo','normal','normal','balanced','regular'),
  ('f033afbe-281a-419e-a245-3ad83d721bd0','shampoo','normal','normal','balanced','regular'),
  ('f184aef4-d8f9-4956-bcd6-ba1bf1ebeace','shampoo','fine','schuppen','dandruff','regular'),
  ('f184aef4-d8f9-4956-bcd6-ba1bf1ebeace','shampoo','normal','schuppen','dandruff','regular'),
  ('f184aef4-d8f9-4956-bcd6-ba1bf1ebeace','shampoo','coarse','schuppen','dandruff','regular'),
  ('f8a8fd56-aeb0-4096-8d9d-5af484e3889f','shampoo','fine','normal','balanced','regular'),
  ('f8a8fd56-aeb0-4096-8d9d-5af484e3889f','shampoo','normal','normal','balanced','regular'),
  ('fcbc469f-93c8-4be5-85db-e789b09189c7','shampoo','normal','normal','balanced','regular');

UPDATE public.products SET is_chaarlie_recommended = false WHERE id = 'd408aca9-cd16-4cb0-90e7-bab26a698000'; -- H&S DERMAXPRO Sensitive Pflege: discontinued (Nick 2026-10-12)
UPDATE public.products SET name = 'Hask Shampoo Repair + Argan Oil' WHERE id = '17b6d50e-ca5b-4f66-bdd7-39bd19afe748'; -- 473 ml successor of the 355 ml Argan Oil row
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.product_identifiers WHERE canonical_gtin14 = '00071164341469' AND product_id <> '17b6d50e-ca5b-4f66-bdd7-39bd19afe748') THEN
    RAISE EXCEPTION 'shampoo v1.6.2 apply: GTIN 071164341469 belongs to another product';
  END IF;
END $$;
INSERT INTO public.product_identifiers (product_id, identifier_type, identifier_value, source)
  SELECT '17b6d50e-ca5b-4f66-bdd7-39bd19afe748', 'ean', '071164341469', 'shampoo-v162-track-a-2026-10-13'
  WHERE NOT EXISTS (SELECT 1 FROM public.product_identifiers WHERE canonical_gtin14 = '00071164341469');
UPDATE public.products SET name = 'L''Oréal Paris Elvital Glycolic Gloss Shampoo' WHERE id = '88c230c5-1020-4648-a10e-c2a1e8c87e0e'; -- catalog placeholder name 'Ultimate Shampoo'

-- N1 (same contract as build_apply.py): every thickness x bucket cell has an active recommended pick that is at
-- least Passt bedingt: `normal` = nearest-thickness steps + intensity steps vs 'regular'; scalp buckets = intensity
-- steps vs the bucket default (thickness ignored, R19).
DO $$
BEGIN
  IF EXISTS (
    WITH ti(th, i) AS (VALUES ('fine',0),('normal',1),('coarse',2)),
         ii(intensity, i) AS (VALUES ('gentle',0),('regular',1),('clarifying',2)),
         dflt(bucket, intensity) AS (VALUES ('normal','regular'),('dehydriert-fettig','regular'),('schuppen','regular'),('irritationen','gentle'),('trocken','gentle')),
         rows AS (
           SELECT s.product_id, s.shampoo_bucket, t.i AS t_i, x.i AS int_i
           FROM public.product_shampoo_specs s
           JOIN public.products p ON p.id = s.product_id AND p.is_chaarlie_recommended AND p.is_active AND p.lifecycle_status = 'active'
           JOIN ti t ON t.th = s.thickness JOIN ii x ON x.intensity = s.cleansing_intensity),
         cell AS (SELECT t.th, t.i AS want_t, d.bucket, di.i AS want_int FROM ti t CROSS JOIN dflt d JOIN ii di ON di.intensity = d.intensity),
         normal_steps AS (
           SELECT c.th, c.bucket, r.product_id,
                  min(abs(r.t_i - c.want_t)) AS dist
           FROM cell c JOIN rows r ON r.shampoo_bucket = c.bucket AND c.bucket = 'normal'
           GROUP BY c.th, c.bucket, r.product_id),
         normal_best AS (
           SELECT n.th, n.bucket, min(n.dist + (SELECT min(abs(r.int_i - 1)) FROM rows r WHERE r.product_id = n.product_id AND r.shampoo_bucket = 'normal'
                                                AND abs(r.t_i - (SELECT i FROM ti WHERE th = n.th)) = n.dist)) AS steps
           FROM normal_steps n GROUP BY n.th, n.bucket),
         scalp_best AS (
           SELECT c.th, c.bucket, min(abs(r.int_i - c.want_int)) AS steps
           FROM cell c JOIN rows r ON r.shampoo_bucket = c.bucket AND c.bucket <> 'normal'
           GROUP BY c.th, c.bucket),
         best AS (SELECT * FROM normal_best UNION ALL SELECT * FROM scalp_best)
    SELECT 1 FROM cell c LEFT JOIN best b ON b.th = c.th AND b.bucket = c.bucket
    WHERE b.steps IS NULL OR b.steps > 1
  ) THEN
    RAISE EXCEPTION 'shampoo v1.6.2 apply: N1 no-gap check failed';
  END IF;
END $$;

-- Post-apply assertion (added at apply time): the written state must equal the reviewed target exactly.
DO $$
DECLARE fp text; n int; pfp text; pn int;
BEGIN
  SELECT count(*), md5(string_agg(product_id::text||'|'||thickness||'|'||shampoo_bucket||'|'||coalesce(scalp_route,'')||'|'||coalesce(cleansing_intensity,''), E'\n'
         ORDER BY product_id::text COLLATE "C", thickness COLLATE "C", shampoo_bucket COLLATE "C", coalesce(scalp_route,'') COLLATE "C", coalesce(cleansing_intensity,'') COLLATE "C"))
    INTO n, fp FROM public.product_shampoo_specs WHERE product_id IN ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4','02afbd03-1c7d-467c-8a07-a8b226d6f535','03b847e5-01b9-40e5-950a-98efc73abb3a','088b1427-ed22-424e-8cfd-ea2578120ae6','0ab645f9-d46d-4cf2-96a5-b5e00f74cae2','0d341836-96b3-4364-9319-a7f0884b3da9','0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33','0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c','1311e51c-7941-4d2c-b9b4-7a450ee37f15','1623a993-3ff4-43be-82c1-95a1ee57ec52','16ebefbe-48d8-4c7f-9c81-b903651a6e03','17b6d50e-ca5b-4f66-bdd7-39bd19afe748','1e61a644-94b0-4356-ab55-f58572fa1e18','1ef2be82-259c-4a1f-af2e-3ac3403f9731','1f51a69f-c946-4898-9091-2fd2c59fb467','22f95dcb-12de-4d62-b206-f03dbd6e94a0','261e5c9f-d312-4206-82da-fbd0ab6f3614','286071ba-9c9a-4c60-979c-7e51df949fbf','2e887538-3b92-4344-9bbd-1761383ba4a6','2ecd3c9d-90f6-45a3-a72c-daefed50be10','303b4c0c-53a4-46de-883d-c29e448ee590','3405f33b-ae5f-4185-b72b-68c9a87f7c06','34697aec-761c-45e7-9a92-986f786dd022','3d94c017-9edb-4ba0-accd-4772e262f012','3f3c7d89-9e7b-4e91-85f7-d3c58d304918','41b99629-5a1c-402f-a486-d41780e89e66','4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946','4a45948b-53a6-48ac-9c02-20718c1d19c4','515de93c-1c77-465d-ae0d-2a8d6ddb3d73','51a0b647-2794-49a3-96e1-e7695432561e','57bae8c8-0ebd-4722-b955-c760d8ffcdbb','5effc311-25d7-44dd-8c16-b93c182068d3','64fb44d5-8701-46ab-bcba-f1747f071e48','678119a0-9070-4faf-b9ed-7c0ac008767e','6dc65df2-2466-43e4-bdc2-3a05803f305c','6fde3fe2-3850-4502-b9f2-ebb17eb13bad','716a4f4e-6ba4-4742-a1cf-75e90ae1da3f','7200bb0b-7463-433b-86c8-744f5c1431de','7373656d-5fd7-46e8-81a3-2ef29e3c4c18','744de604-d266-453b-a56b-eea92c5ca565','7b5ec424-d21f-4eb8-999e-7aed98e94b86','7e95671b-41a7-4f5c-9188-e535e46678ba','86f44889-b2c9-40a1-9190-58d7f738b6ca','88c230c5-1020-4648-a10e-c2a1e8c87e0e','8a90f0fa-9cb1-458a-93f3-c2374e6d8f16','94829f16-b21d-4061-9dcc-cbd43dcb4274','9bfad335-a086-45a0-9af7-f26b36b4ecff','9d8d4709-4041-495e-98ee-e0261fa30e27','a06cfc4d-c4f5-457e-a94e-26559f96f0e9','a1451c9b-fb55-406d-a81f-c513cc4ddcdf','a1c3dc8d-2638-497f-8c7f-9b491c9003b0','a79513be-e34b-4a1e-b7eb-b3d4b58160be','a7ff335a-7e81-4cf4-9c20-9209bff4386b','a836ef4f-f406-4557-b908-0155919e2c4f','b000d235-1fc6-434c-9ba1-f1207d36cded','b761256d-c0d2-4413-9fa5-8ab950ef69bf','bb1b029f-a8fa-4276-8268-f6ce418128c7','bef4f219-2c1f-4e02-8e3a-93056b95465a','c07a181b-3d55-4d47-ad68-9c1e324d4496','cc9318d2-13af-4c83-8b5e-7effb687c92f','cd7461cc-7fde-40dd-8d39-fca1aa8f30bf','d01de47e-e360-4b31-9924-e3e5bc31ccdc','d408aca9-cd16-4cb0-90e7-bab26a698000','e4e4fd05-33fd-4048-9553-76815bff5d43','e76e0ed4-bd20-40cd-84ae-e93030610d40','e7bfd306-b128-4735-a9f8-0eeacdbd5013','e859d6e0-e991-4081-84b5-b81862c82475','ead1333b-6839-464d-b272-673d39bb95a4','eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','eb99d805-20d4-4dbb-9651-17c9e954a769','f033afbe-281a-419e-a245-3ad83d721bd0','f184aef4-d8f9-4956-bcd6-ba1bf1ebeace','f8a8fd56-aeb0-4096-8d9d-5af484e3889f','fcbc469f-93c8-4be5-85db-e789b09189c7');
  IF n <> 159 OR fp <> 'fcd929f4a2fcf222e4fbfcba398cf075' THEN
    RAISE EXCEPTION 'shampoo v1.6.2 apply: written spec rows differ from the reviewed target (n=%, fp=%)', n, fp;
  END IF;
  SELECT count(*), md5(string_agg(id::text||'|'||array_to_string(suitable_thicknesses, ','), E'\n' ORDER BY id::text COLLATE "C"))
    INTO pn, pfp FROM public.products WHERE id IN ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4','02afbd03-1c7d-467c-8a07-a8b226d6f535','03b847e5-01b9-40e5-950a-98efc73abb3a','088b1427-ed22-424e-8cfd-ea2578120ae6','0ab645f9-d46d-4cf2-96a5-b5e00f74cae2','0d341836-96b3-4364-9319-a7f0884b3da9','0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33','0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c','1311e51c-7941-4d2c-b9b4-7a450ee37f15','1623a993-3ff4-43be-82c1-95a1ee57ec52','16ebefbe-48d8-4c7f-9c81-b903651a6e03','17b6d50e-ca5b-4f66-bdd7-39bd19afe748','1e61a644-94b0-4356-ab55-f58572fa1e18','1ef2be82-259c-4a1f-af2e-3ac3403f9731','1f51a69f-c946-4898-9091-2fd2c59fb467','22f95dcb-12de-4d62-b206-f03dbd6e94a0','261e5c9f-d312-4206-82da-fbd0ab6f3614','286071ba-9c9a-4c60-979c-7e51df949fbf','2e887538-3b92-4344-9bbd-1761383ba4a6','2ecd3c9d-90f6-45a3-a72c-daefed50be10','303b4c0c-53a4-46de-883d-c29e448ee590','3405f33b-ae5f-4185-b72b-68c9a87f7c06','34697aec-761c-45e7-9a92-986f786dd022','3d94c017-9edb-4ba0-accd-4772e262f012','3f3c7d89-9e7b-4e91-85f7-d3c58d304918','41b99629-5a1c-402f-a486-d41780e89e66','4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946','4a45948b-53a6-48ac-9c02-20718c1d19c4','515de93c-1c77-465d-ae0d-2a8d6ddb3d73','51a0b647-2794-49a3-96e1-e7695432561e','57bae8c8-0ebd-4722-b955-c760d8ffcdbb','5effc311-25d7-44dd-8c16-b93c182068d3','64fb44d5-8701-46ab-bcba-f1747f071e48','678119a0-9070-4faf-b9ed-7c0ac008767e','6dc65df2-2466-43e4-bdc2-3a05803f305c','6fde3fe2-3850-4502-b9f2-ebb17eb13bad','716a4f4e-6ba4-4742-a1cf-75e90ae1da3f','7200bb0b-7463-433b-86c8-744f5c1431de','7373656d-5fd7-46e8-81a3-2ef29e3c4c18','744de604-d266-453b-a56b-eea92c5ca565','7b5ec424-d21f-4eb8-999e-7aed98e94b86','86f44889-b2c9-40a1-9190-58d7f738b6ca','88c230c5-1020-4648-a10e-c2a1e8c87e0e','8a90f0fa-9cb1-458a-93f3-c2374e6d8f16','94829f16-b21d-4061-9dcc-cbd43dcb4274','9bfad335-a086-45a0-9af7-f26b36b4ecff','9d8d4709-4041-495e-98ee-e0261fa30e27','a06cfc4d-c4f5-457e-a94e-26559f96f0e9','a1451c9b-fb55-406d-a81f-c513cc4ddcdf','a1c3dc8d-2638-497f-8c7f-9b491c9003b0','a79513be-e34b-4a1e-b7eb-b3d4b58160be','a7ff335a-7e81-4cf4-9c20-9209bff4386b','a836ef4f-f406-4557-b908-0155919e2c4f','b000d235-1fc6-434c-9ba1-f1207d36cded','b761256d-c0d2-4413-9fa5-8ab950ef69bf','bb1b029f-a8fa-4276-8268-f6ce418128c7','bef4f219-2c1f-4e02-8e3a-93056b95465a','c07a181b-3d55-4d47-ad68-9c1e324d4496','cc9318d2-13af-4c83-8b5e-7effb687c92f','cd7461cc-7fde-40dd-8d39-fca1aa8f30bf','d01de47e-e360-4b31-9924-e3e5bc31ccdc','d408aca9-cd16-4cb0-90e7-bab26a698000','e4e4fd05-33fd-4048-9553-76815bff5d43','e76e0ed4-bd20-40cd-84ae-e93030610d40','e7bfd306-b128-4735-a9f8-0eeacdbd5013','e859d6e0-e991-4081-84b5-b81862c82475','ead1333b-6839-464d-b272-673d39bb95a4','eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d','eb99d805-20d4-4dbb-9651-17c9e954a769','f033afbe-281a-419e-a245-3ad83d721bd0','f184aef4-d8f9-4956-bcd6-ba1bf1ebeace','f8a8fd56-aeb0-4096-8d9d-5af484e3889f','fcbc469f-93c8-4be5-85db-e789b09189c7');
  IF pn <> 73 OR pfp <> '91e5b56c737699102a803daf8c40038e' THEN
    RAISE EXCEPTION 'shampoo v1.6.2 apply: written suitable_thicknesses differ from the reviewed target (n=%, fp=%)', pn, pfp;
  END IF;
  IF (SELECT is_chaarlie_recommended FROM public.products WHERE id = 'd408aca9-cd16-4cb0-90e7-bab26a698000') THEN
    RAISE EXCEPTION 'shampoo v1.6.2 apply: DERMAXPRO Sensitive Pflege still recommended';
  END IF;
END $$;

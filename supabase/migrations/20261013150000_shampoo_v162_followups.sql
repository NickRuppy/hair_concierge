-- Shampoo v1.6.2 follow-ups, authorized by Nick 2026-10-13.
-- Requires Track A (20261013120000); migration runner must execute this whole file
-- in one implicit transaction. No BEGIN/COMMIT here; the locks cover guards + writes.
-- Sources/rollback: plans/shampoo-v162-followups/README.md and rollback.sql.

LOCK TABLE public.product_shampoo_specs, public.products,
  public.product_thickness_eligibility, public.product_concern_eligibility,
  public.product_application_protocols IN SHARE ROW EXCLUSIVE MODE;

-- Exact 73 Track A thickness-update targets plus held A50; Neqi is already included.
CREATE TEMP TABLE shampoo_v162_followups_targets (id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO shampoo_v162_followups_targets (id) VALUES
  ('0017381a-84ba-46dd-9b6e-7ef457e8b5b4'::uuid),
  ('02afbd03-1c7d-467c-8a07-a8b226d6f535'::uuid),
  ('03b847e5-01b9-40e5-950a-98efc73abb3a'::uuid),
  ('088b1427-ed22-424e-8cfd-ea2578120ae6'::uuid),
  ('0ab645f9-d46d-4cf2-96a5-b5e00f74cae2'::uuid),
  ('0d341836-96b3-4364-9319-a7f0884b3da9'::uuid),
  ('0d68d56f-7e82-41d0-a2a8-bbf8f02e0b33'::uuid),
  ('0f71ff9d-bf1e-4d76-883a-e1a9e6a2094c'::uuid),
  ('1311e51c-7941-4d2c-b9b4-7a450ee37f15'::uuid),
  ('1623a993-3ff4-43be-82c1-95a1ee57ec52'::uuid),
  ('16ebefbe-48d8-4c7f-9c81-b903651a6e03'::uuid),
  ('17b6d50e-ca5b-4f66-bdd7-39bd19afe748'::uuid),
  ('1e61a644-94b0-4356-ab55-f58572fa1e18'::uuid),
  ('1ef2be82-259c-4a1f-af2e-3ac3403f9731'::uuid),
  ('1f51a69f-c946-4898-9091-2fd2c59fb467'::uuid),
  ('22f95dcb-12de-4d62-b206-f03dbd6e94a0'::uuid),
  ('261e5c9f-d312-4206-82da-fbd0ab6f3614'::uuid),
  ('286071ba-9c9a-4c60-979c-7e51df949fbf'::uuid),
  ('2e887538-3b92-4344-9bbd-1761383ba4a6'::uuid),
  ('2ecd3c9d-90f6-45a3-a72c-daefed50be10'::uuid),
  ('303b4c0c-53a4-46de-883d-c29e448ee590'::uuid),
  ('3405f33b-ae5f-4185-b72b-68c9a87f7c06'::uuid),
  ('34697aec-761c-45e7-9a92-986f786dd022'::uuid),
  ('3d94c017-9edb-4ba0-accd-4772e262f012'::uuid),
  ('3f3c7d89-9e7b-4e91-85f7-d3c58d304918'::uuid),
  ('41b99629-5a1c-402f-a486-d41780e89e66'::uuid),
  ('4988d0c9-fc92-4bf2-aa5c-bcc7cd8c7946'::uuid),
  ('4a45948b-53a6-48ac-9c02-20718c1d19c4'::uuid),
  ('515de93c-1c77-465d-ae0d-2a8d6ddb3d73'::uuid),
  ('51a0b647-2794-49a3-96e1-e7695432561e'::uuid),
  ('57bae8c8-0ebd-4722-b955-c760d8ffcdbb'::uuid),
  ('5effc311-25d7-44dd-8c16-b93c182068d3'::uuid),
  ('64fb44d5-8701-46ab-bcba-f1747f071e48'::uuid),
  ('678119a0-9070-4faf-b9ed-7c0ac008767e'::uuid),
  ('6dc65df2-2466-43e4-bdc2-3a05803f305c'::uuid),
  ('6fde3fe2-3850-4502-b9f2-ebb17eb13bad'::uuid),
  ('716a4f4e-6ba4-4742-a1cf-75e90ae1da3f'::uuid),
  ('7200bb0b-7463-433b-86c8-744f5c1431de'::uuid),
  ('7373656d-5fd7-46e8-81a3-2ef29e3c4c18'::uuid),
  ('744de604-d266-453b-a56b-eea92c5ca565'::uuid),
  ('7b5ec424-d21f-4eb8-999e-7aed98e94b86'::uuid),
  ('7e95671b-41a7-4f5c-9188-e535e46678ba'::uuid),
  ('86f44889-b2c9-40a1-9190-58d7f738b6ca'::uuid),
  ('88c230c5-1020-4648-a10e-c2a1e8c87e0e'::uuid),
  ('8a90f0fa-9cb1-458a-93f3-c2374e6d8f16'::uuid),
  ('94829f16-b21d-4061-9dcc-cbd43dcb4274'::uuid),
  ('9bfad335-a086-45a0-9af7-f26b36b4ecff'::uuid),
  ('9d8d4709-4041-495e-98ee-e0261fa30e27'::uuid),
  ('a06cfc4d-c4f5-457e-a94e-26559f96f0e9'::uuid),
  ('a1451c9b-fb55-406d-a81f-c513cc4ddcdf'::uuid),
  ('a1c3dc8d-2638-497f-8c7f-9b491c9003b0'::uuid),
  ('a79513be-e34b-4a1e-b7eb-b3d4b58160be'::uuid),
  ('a7ff335a-7e81-4cf4-9c20-9209bff4386b'::uuid),
  ('a836ef4f-f406-4557-b908-0155919e2c4f'::uuid),
  ('b000d235-1fc6-434c-9ba1-f1207d36cded'::uuid),
  ('b761256d-c0d2-4413-9fa5-8ab950ef69bf'::uuid),
  ('bb1b029f-a8fa-4276-8268-f6ce418128c7'::uuid),
  ('bef4f219-2c1f-4e02-8e3a-93056b95465a'::uuid),
  ('c07a181b-3d55-4d47-ad68-9c1e324d4496'::uuid),
  ('cc9318d2-13af-4c83-8b5e-7effb687c92f'::uuid),
  ('cd7461cc-7fde-40dd-8d39-fca1aa8f30bf'::uuid),
  ('d01de47e-e360-4b31-9924-e3e5bc31ccdc'::uuid),
  ('d408aca9-cd16-4cb0-90e7-bab26a698000'::uuid),
  ('e4e4fd05-33fd-4048-9553-76815bff5d43'::uuid),
  ('e76e0ed4-bd20-40cd-84ae-e93030610d40'::uuid),
  ('e7bfd306-b128-4735-a9f8-0eeacdbd5013'::uuid),
  ('e859d6e0-e991-4081-84b5-b81862c82475'::uuid),
  ('ead1333b-6839-464d-b272-673d39bb95a4'::uuid),
  ('eafe4cfa-f4a9-47b3-a36d-b689f1da5c7d'::uuid),
  ('eb99d805-20d4-4dbb-9651-17c9e954a769'::uuid),
  ('f033afbe-281a-419e-a245-3ad83d721bd0'::uuid),
  ('f184aef4-d8f9-4956-bcd6-ba1bf1ebeace'::uuid),
  ('f8a8fd56-aeb0-4096-8d9d-5af484e3889f'::uuid),
  ('fcbc469f-93c8-4be5-85db-e789b09189c7'::uuid);

DO $guard$
BEGIN
  IF (SELECT count(*) FROM public.products p JOIN shampoo_v162_followups_targets t USING (id)) <> 74
     OR EXISTS (
       SELECT 1 FROM public.products p JOIN shampoo_v162_followups_targets t USING (id)
       WHERE p.category_key IS DISTINCT FROM 'shampoo'
     ) THEN
    RAISE EXCEPTION 'shampoo v162 followups: expected all 74 reviewed shampoo products';
  END IF;
  IF (SELECT count(*) FROM public.product_shampoo_specs WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba') <> 1
     OR NOT EXISTS (
       SELECT 1 FROM public.product_shampoo_specs
       WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba' AND category_key = 'shampoo'
         AND thickness = 'fine' AND shampoo_bucket = 'dehydriert-fettig'
         AND scalp_route = 'oily' AND cleansing_intensity = 'regular'
     ) THEN
    RAISE EXCEPTION 'shampoo v162 followups: A50 old spec differs from reviewed snapshot';
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_application_protocols
             WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba' AND role = 'shampoo_dandruff')
     OR (SELECT count(*) FROM public.product_application_protocols WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba') <> 1
     OR NOT EXISTS (
       SELECT 1 FROM public.product_application_protocols
       WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba' AND category_key = 'shampoo'
         AND role = 'shampoo_everyday' AND application_family = 'standard_rinse_out_cleanse'
         AND source_url = 'https://www.dm.de/p/d/1585729/sebamed-shampoo-anti-schuppen-plus'
     ) THEN
    RAISE EXCEPTION 'shampoo v162 followups: A50 expected only the reviewed everyday protocol';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.products p JOIN shampoo_v162_followups_targets t USING (id)
    WHERE p.description IS NOT NULL AND (p.brand IS NULL OR btrim(p.brand) = '')
      AND EXISTS (SELECT 1 FROM public.product_shampoo_specs s WHERE s.product_id = p.id)
  ) OR EXISTS (
    SELECT 1 FROM public.product_shampoo_specs s JOIN shampoo_v162_followups_targets t ON t.id = s.product_id
    WHERE s.category_key IS DISTINCT FROM 'shampoo'
       OR s.thickness NOT IN ('fine', 'normal', 'coarse')
       OR s.shampoo_bucket NOT IN ('normal', 'schuppen', 'dehydriert-fettig', 'irritationen', 'trocken')
  ) THEN
    RAISE EXCEPTION 'shampoo v162 followups: cannot render description from unexpected brand/spec state';
  END IF;
END $guard$;

CREATE TABLE public.shampoo_v162_followups_backup_specs AS
  SELECT * FROM public.product_shampoo_specs WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba';
CREATE TABLE public.shampoo_v162_followups_backup_protocols AS
  SELECT * FROM public.product_application_protocols WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba';
CREATE TABLE public.shampoo_v162_followups_backup_products AS
  SELECT p.id, p.name, p.suitable_thicknesses, p.description, p.affiliate_link,
         p.purchase_link_status, p.purchase_link_checked_at, p.brand, p.updated_at,
         NULL::text AS applied_description, NULL::jsonb AS applied_dandruff_protocol,
         (p.description IS NOT NULL AND EXISTS (
           SELECT 1 FROM public.product_shampoo_specs s WHERE s.product_id = p.id
         )) AS description_was_touched,
         -- A50's thickness UPDATE also fires the shared eligibility compat triggers.
         -- Capture their complete prior rows inside the requested products backup.
         CASE WHEN p.id = '7e95671b-41a7-4f5c-9188-e535e46678ba' THEN (
           SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.thickness), '[]'::jsonb)
           FROM public.product_thickness_eligibility e WHERE e.product_id = p.id AND e.category_key = 'shampoo'
         ) END AS thickness_eligibility,
         CASE WHEN p.id = '7e95671b-41a7-4f5c-9188-e535e46678ba' THEN (
           SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.concern_key), '[]'::jsonb)
           FROM public.product_concern_eligibility e WHERE e.product_id = p.id AND e.category_key = 'shampoo'
         ) END AS concern_eligibility
  FROM public.products p JOIN shampoo_v162_followups_targets t USING (id);
ALTER TABLE public.shampoo_v162_followups_backup_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shampoo_v162_followups_backup_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shampoo_v162_followups_backup_protocols ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shampoo_v162_followups_backup_specs,
  public.shampoo_v162_followups_backup_products, public.shampoo_v162_followups_backup_protocols
  FROM PUBLIC, anon, authenticated;

DELETE FROM public.product_shampoo_specs WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba';
UPDATE public.products SET suitable_thicknesses = ARRAY['fine','normal','coarse']::text[], updated_at = now()
WHERE id = '7e95671b-41a7-4f5c-9188-e535e46678ba';
INSERT INTO public.product_shampoo_specs
  (product_id, category_key, thickness, shampoo_bucket, scalp_route, cleansing_intensity) VALUES
  ('7e95671b-41a7-4f5c-9188-e535e46678ba', 'shampoo', 'fine', 'schuppen', 'dandruff', 'regular'),
  ('7e95671b-41a7-4f5c-9188-e535e46678ba', 'shampoo', 'normal', 'schuppen', 'dandruff', 'regular'),
  ('7e95671b-41a7-4f5c-9188-e535e46678ba', 'shampoo', 'coarse', 'schuppen', 'dandruff', 'regular');

-- Both JSON values below are literal, unmodified outputs of the repo template +
-- V2 builder (generator + durable JSON are in the follow-up plan). UTF-8 compact
-- payload sizes: V1 1363 bytes; V2 730 bytes. The shared V2 template resolver uses
-- shampoo.targeted-scalp-cleanse.v2 for this category/role/applicationFamily.
-- application_family and category_key are GENERATED ALWAYS: do not insert them.
INSERT INTO public.product_application_protocols
  (product_id, category, role, cadence, application_stage, application_state,
   placement, contact_time_seconds, rinse_action, reapplication, instruction_modifiers,
   source_label, source_url, source_text, guidance_payload, guidance_payload_v2)
VALUES (
  '7e95671b-41a7-4f5c-9188-e535e46678ba', 'shampoo', 'shampoo_dandruff',
  '{"kind":"label_schedule","copy_de":"Täglich oder 2-3x pro Woche anwenden."}'::jsonb, 'wet_cleanse', NULL,
  'scalp_roots', NULL, 'rinse_out', 'not_stated', '[]'::jsonb,
  'Herstelleranleitung', 'https://sebamed.de/de/p/antischuppen-shampoo-plus/',
  'Herstelleranleitung sebamed.de (abgerufen 2026-10-13): "Shampoo in der Handinnenfläche aufschäumen und unter leichtem Massieren auf die Kopfhaut auftragen. Ausspülen. Täglich oder 2-3x pro Woche anwenden." Wirkstoff Piroctone Olamine.',
  '{"schemaVersion":1,"protocolVersion":1,"locale":"de","guidanceKey":"product-shampoo-dandruff-7e95671b-41a7-4f5c-9188-e535e46678ba","scope":{"kind":"product","category":"shampoo","productId":"7e95671b-41a7-4f5c-9188-e535e46678ba"},"role":"cleanse","applicationFamily":"targeted_treatment_shampoo","compatibleDayTypes":["wash_day"],"exactGuidanceRequired":true,"sequence":{"anchor":"wet_cleanse","before":["post_cleanse_rinse_off"],"after":[],"conflictsWith":[]},"requirements":{"requiredCatalogFacts":[],"requiredProtocolFacts":[],"requiredProfileFacts":[]},"protocolFacts":{"applicationArea":"scalp_roots","rinse":"rinse_out","contactTimeSeconds":null,"conditionerRelationship":"not_applicable","reapplication":"none","amount":null,"cautions":[]},"steps":[{"stepKey":"apply-dandruff-shampoo","action":"apply_product","copyTemplateDe":"Das Shampoo mit etwas Wasser in den Handflächen aufschäumen. Auf der Kopfhaut verteilen und mit den Fingerkuppen sanft einmassieren."},{"stepKey":"wait-dandruff-shampoo","action":"wait","copyTemplateDe":"2–3 Minuten einwirken lassen."},{"stepKey":"rinse-dandruff-shampoo","action":"rinse","copyTemplateDe":"Gründlich lauwarm ausspülen – der ablaufende Schaum reinigt die Längen mit."}],"evidence":[{"sourceUrl":"https://sebamed.de/de/p/antischuppen-shampoo-plus/","sourceType":"manufacturer","checkedAt":"2026-10-13"}]}'::jsonb,
  '{"schemaVersion":2,"contractKind":"product_pointer","scope":{"kind":"product","category":"shampoo","productId":"7e95671b-41a7-4f5c-9188-e535e46678ba"},"sourceRole":"shampoo_dandruff","role":"cleanse","applicationFamily":"targeted_treatment_shampoo","facts":{"applicationState":"wet_hair","applicationArea":"scalp_roots","rinse":"rinse_out","contactTime":{"kind":"range_seconds","minimumSeconds":120,"maximumSeconds":180},"amount":null,"heat":null,"conditionerPolicy":"not_applicable"},"workflowId":null,"requiredCompanionProductId":null,"runtimeBlockerCode":null,"exactSteps":[],"cautionCodes":[],"evidence":[{"sourceUrl":"https://sebamed.de/de/p/antischuppen-shampoo-plus/","sourceType":"manufacturer","checkedAt":"2026-10-13"}]}'::jsonb
);

-- Retain the exact inserted row so operator rollback can reject later edits.
UPDATE public.shampoo_v162_followups_backup_products b
SET applied_dandruff_protocol = to_jsonb(p)
FROM public.product_application_protocols p
WHERE b.id = p.product_id AND p.product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba'
  AND p.role = 'shampoo_dandruff';

DO $neqi$
DECLARE n integer;
BEGIN
  UPDATE public.products
  SET affiliate_link = 'https://www.hagel-shop.de/products/neqi-volume-victory-shampoo-330-ml-12129028',
      purchase_link_status = 'available',
      purchase_link_checked_at = '2026-10-13T12:00:00Z'::timestamptz, updated_at = now()
  WHERE id = '64fb44d5-8701-46ab-bcba-f1747f071e48'
    AND affiliate_link = 'https://www.hagel-shop.de/neqi-volume-victory-shampoo-330-ml-12129028.html?___store=hagel_de';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION 'shampoo v162 followups: Neqi old affiliate link changed (% rows updated)', n;
  END IF;
END $neqi$;

-- Recompute from live specs (after A50); DISTINCT prevents duplicate scalp words
-- across thickness rows. This session-only view is reused for the final assertion.
CREATE TEMP VIEW shampoo_v162_followups_descriptions AS
WITH thickness_words(key, word, ordinal) AS (
  VALUES ('fine', 'feines', 1), ('normal', 'mittelstarkes', 2), ('coarse', 'dickes', 3)
), scalp_words(key, word, ordinal) AS (
  VALUES ('schuppen', 'Schuppen', 1), ('dehydriert-fettig', 'fettiger Kopfhaut', 2),
         ('irritationen', 'Kopfhautirritationen', 3), ('trocken', 'trockener Kopfhaut', 4)
), distinct_words AS (
  SELECT DISTINCT s.product_id, 'T' AS kind, w.word, w.ordinal
  FROM public.product_shampoo_specs s JOIN shampoo_v162_followups_targets t ON t.id = s.product_id
  JOIN thickness_words w ON w.key = s.thickness WHERE s.shampoo_bucket = 'normal'
  UNION ALL
  SELECT DISTINCT s.product_id, 'S' AS kind, w.word, w.ordinal
  FROM public.product_shampoo_specs s JOIN shampoo_v162_followups_targets t ON t.id = s.product_id
  JOIN scalp_words w ON w.key = s.shampoo_bucket
), word_arrays AS (
  SELECT product_id,
    coalesce(array_agg(word ORDER BY ordinal) FILTER (WHERE kind = 'T'), '{}'::text[]) AS t,
    coalesce(array_agg(word ORDER BY ordinal) FILTER (WHERE kind = 'S'), '{}'::text[]) AS s
  FROM distinct_words GROUP BY product_id
), joined_words AS (
  SELECT product_id,
    CASE cardinality(t) WHEN 0 THEN NULL WHEN 1 THEN t[1]
      ELSE array_to_string(t[1:cardinality(t)-1], ', ') || ' und ' || t[cardinality(t)] END AS t,
    CASE cardinality(s) WHEN 0 THEN NULL WHEN 1 THEN s[1]
      ELSE array_to_string(s[1:cardinality(s)-1], ', ') || ' und ' || s[cardinality(s)] END AS s
  FROM word_arrays
)
SELECT p.id,
  'Shampoo von ' || p.brand ||
  CASE WHEN w.t IS NOT NULL AND w.s IS NOT NULL THEN ' für ' || w.t || ' Haar und bei ' || w.s
       WHEN w.t IS NOT NULL THEN ' für ' || w.t || ' Haar'
       ELSE ' bei ' || w.s END || '.' AS description
FROM public.products p JOIN joined_words w ON w.product_id = p.id
JOIN public.shampoo_v162_followups_backup_products b ON b.id = p.id
WHERE b.description_was_touched;

UPDATE public.shampoo_v162_followups_backup_products b SET applied_description = d.description
FROM shampoo_v162_followups_descriptions d WHERE b.id = d.id;

UPDATE public.products p SET description = d.description, updated_at = now()
FROM shampoo_v162_followups_descriptions d
WHERE p.id = d.id AND p.description IS NOT NULL;

DO $post$
BEGIN
  IF (SELECT count(*) FROM public.product_shampoo_specs WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba') <> 3
     OR (SELECT count(DISTINCT thickness) FROM public.product_shampoo_specs WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba') <> 3
     OR EXISTS (
       SELECT 1 FROM public.product_shampoo_specs WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba'
       AND (category_key IS DISTINCT FROM 'shampoo' OR thickness NOT IN ('fine','normal','coarse')
            OR shampoo_bucket IS DISTINCT FROM 'schuppen' OR scalp_route IS DISTINCT FROM 'dandruff'
            OR cleansing_intensity IS DISTINCT FROM 'regular')
     ) OR NOT EXISTS (
       SELECT 1 FROM public.products WHERE id = '7e95671b-41a7-4f5c-9188-e535e46678ba'
       AND suitable_thicknesses = ARRAY['fine','normal','coarse']::text[]
     ) THEN
    RAISE EXCEPTION 'shampoo v162 followups: A50 final specs/thicknesses differ from target';
  END IF;
  IF (SELECT count(*) FROM public.product_application_protocols WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba') <> 2
     OR NOT EXISTS (
       SELECT 1 FROM public.product_application_protocols
       WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba' AND role = 'shampoo_dandruff'
         AND category = 'shampoo' AND category_key = 'shampoo'
         AND application_family = 'targeted_treatment_shampoo'
         AND guidance_payload#>>'{scope,productId}' = product_id::text
         AND guidance_payload_v2#>>'{scope,productId}' = product_id::text
         AND guidance_payload_v2->>'schemaVersion' = '2'
         AND guidance_payload_v2->>'contractKind' = 'product_pointer'
         AND guidance_payload_v2->>'sourceRole' = 'shampoo_dandruff'
         AND guidance_payload_v2#>>'{scope,category}' = 'shampoo'
         AND guidance_payload_v2->'runtimeBlockerCode' = 'null'::jsonb
     ) OR EXISTS (
       SELECT 1 FROM public.shampoo_v162_followups_backup_protocols b
       LEFT JOIN public.product_application_protocols p ON p.id = b.id
       WHERE to_jsonb(p) IS DISTINCT FROM to_jsonb(b)
     ) THEN
    RAISE EXCEPTION 'shampoo v162 followups: missing A50 executable V2 pointer or everyday protocol changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.products WHERE id = '64fb44d5-8701-46ab-bcba-f1747f071e48'
      AND affiliate_link = 'https://www.hagel-shop.de/products/neqi-volume-victory-shampoo-330-ml-12129028'
      AND purchase_link_status = 'available' AND purchase_link_checked_at = '2026-10-13T12:00:00Z'::timestamptz
  ) THEN
    RAISE EXCEPTION 'shampoo v162 followups: Neqi final purchase link differs from target';
  END IF;
  IF EXISTS (
    SELECT 1 FROM shampoo_v162_followups_descriptions d JOIN public.products p USING (id)
    WHERE p.description IS DISTINCT FROM d.description OR p.description ILIKE '%empfohlen für%'
  ) OR EXISTS (
    SELECT 1 FROM public.shampoo_v162_followups_backup_products b JOIN public.products p USING (id)
    WHERE NOT b.description_was_touched AND p.description IS DISTINCT FROM b.description
  ) THEN
    RAISE EXCEPTION 'shampoo v162 followups: descriptions differ from template or unchanged descriptions changed';
  END IF;
END $post$;
DROP VIEW shampoo_v162_followups_descriptions;

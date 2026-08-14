-- Apply only after 20260814120000 has expanded protocol identity by family.
-- This is the reviewed delta from leave-in-use-cases-2026-08-14.json. It is
-- intentionally guarded by the exact active curated product cohort and is not
-- activated by this migration alone.
-- Universal damp/dry between-wash methods are category-level runtime guidance;
-- this migration persists only independently verified product-specific wash,
-- heat, dry, and post-style claims that must remain exact catalog authority.
DO $guard$
DECLARE
  unexpected_count integer;
BEGIN
  WITH candidates(product_id, source_role, application_family) AS (
    VALUES
      ('f9595d2c-d86d-4bdb-9758-c98d1e213f3c'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
      ('c6e80f39-20ba-401e-b041-6ee7c89a5996'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('6b01025d-9e72-4514-b42e-bbb6065fbe1c'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
      ('118ebae1-b7a9-4a89-a2ff-6c31df28c4dc'::uuid, 'post_wash_leave_in', 'post_style_finish'),
      ('0307c903-84f9-46b4-8f1f-a51c2b1f38ff'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('a72d630d-547a-465f-9846-3006b38af0a2'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('5dc2fae3-a0ca-4e6c-9c30-02dd192772f0'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('5a9f4b7b-69d9-4e9a-8bbd-2dfbae9a5df3'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'post_wash_leave_in', 'post_style_finish'),
      ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'pre_heat_protection', 'either_state_protection'),
      ('bbfd8b03-d219-48bb-9ab3-b7c14bcae3dd'::uuid, 'pre_heat_protection', 'pre_heat_damp'),
      ('35a372b6-c7ef-45cb-be0b-99cef476f247'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
      ('e781ca9e-886d-40a1-bfe1-48177cfbf381'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('f8f3b51d-8e64-487d-bad5-4a47c58862ed'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
      ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
      ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'post_wash_leave_in', 'post_style_finish')
  )
  SELECT count(*) INTO unexpected_count
  FROM candidates candidate
  LEFT JOIN public.products product ON product.id = candidate.product_id
  WHERE product.id IS NULL
     OR product.category_key IS DISTINCT FROM 'leave_in'
     OR product.origin IS DISTINCT FROM 'curated'
     OR product.is_active IS DISTINCT FROM true
     OR product.lifecycle_status IS DISTINCT FROM 'active';

  IF unexpected_count <> 0 THEN
    RAISE EXCEPTION 'reviewed Leave-in use-case cohort drifted: % unexpected products', unexpected_count;
  END IF;

  IF EXISTS (
    WITH candidates(product_id, source_role, application_family) AS (
      VALUES
        ('f9595d2c-d86d-4bdb-9758-c98d1e213f3c'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
        ('c6e80f39-20ba-401e-b041-6ee7c89a5996'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
        ('6b01025d-9e72-4514-b42e-bbb6065fbe1c'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
        ('118ebae1-b7a9-4a89-a2ff-6c31df28c4dc'::uuid, 'post_wash_leave_in', 'post_style_finish'),
        ('0307c903-84f9-46b4-8f1f-a51c2b1f38ff'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
        ('a72d630d-547a-465f-9846-3006b38af0a2'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
        ('5dc2fae3-a0ca-4e6c-9c30-02dd192772f0'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
        ('5a9f4b7b-69d9-4e9a-8bbd-2dfbae9a5df3'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
        ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
        ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'post_wash_leave_in', 'post_style_finish'),
        ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'pre_heat_protection', 'either_state_protection'),
        ('bbfd8b03-d219-48bb-9ab3-b7c14bcae3dd'::uuid, 'pre_heat_protection', 'pre_heat_damp'),
        ('35a372b6-c7ef-45cb-be0b-99cef476f247'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
        ('e781ca9e-886d-40a1-bfe1-48177cfbf381'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
        ('f8f3b51d-8e64-487d-bad5-4a47c58862ed'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
        ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
        ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
        ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'post_wash_leave_in', 'post_style_finish')
    )
    SELECT 1
    FROM candidates candidate
    JOIN public.product_application_protocols protocol
      ON protocol.product_id = candidate.product_id
     AND protocol.category = 'leave_in'
     AND protocol.role = candidate.source_role
     AND protocol.application_family = candidate.application_family
  ) THEN
    RAISE EXCEPTION 'reviewed Leave-in use-case delta is not pristine';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.product_application_protocols
    WHERE product_id = '39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid
      AND category = 'leave_in'
      AND role = 'post_wash_leave_in'
      AND application_family = 'between_wash_damp_refresh'
  ) THEN
    RAISE EXCEPTION 'expected stale Redken damp-refresh authority is missing';
  END IF;
END;
$guard$;

WITH candidates(
  product_id, product_name, source_role, application_family,
  source_url, source_type, direction_summary
) AS (
  VALUES
    ('f9595d2c-d86d-4bdb-9758-c98d1e213f3c'::uuid, 'alverde Leave-In Sprühkur Express 7in1', 'post_wash_leave_in', 'post_wash_damp_conditioning', 'https://www.dm.de/p/d/3090444/alverde-naturkosmetik-leave-in-spruehkur-7in1-express', 'retailer', 'Auf feuchtem oder trockenem Haar anwenden.'),
    ('c6e80f39-20ba-401e-b041-6ee7c89a5996'::uuid, 'Balea Aqua Hyaluron 3in1', 'post_wash_leave_in', 'between_wash_dry_care', 'https://www.dm.at/p/d/1417521/balea-professional-3in1-haarmaske-aqua-hyaluron', 'retailer', 'Im handtuchtrockenen oder trockenen Haar anwenden.'),
    ('6b01025d-9e72-4514-b42e-bbb6065fbe1c'::uuid, 'Elvital Öl Magique Midnight Serum', 'post_wash_leave_in', 'post_wash_damp_conditioning', 'https://www.loreal-paris.de/elvital/oel-magique/midnight-serum', 'manufacturer', 'Morgens oder abends auf trockenem oder nassem Haar anwenden.'),
    ('118ebae1-b7a9-4a89-a2ff-6c31df28c4dc'::uuid, 'EVO Head Mistress', 'post_wash_leave_in', 'post_style_finish', 'https://www.evohair.com/en-au/products/39268-evo-head-mistress-cuticle-sealer-150ml', 'manufacturer', 'Auf handtuchtrockenem Haar oder nach dem Styling anwenden.'),
    ('0307c903-84f9-46b4-8f1f-a51c2b1f38ff'::uuid, 'Garnier Hair Food Aloe Vera', 'post_wash_leave_in', 'between_wash_dry_care', 'https://www.garnier.com.au/tips-and-how-tos/hair-care/~/link.aspx?_id=549DF96773B246F78B2B8AB15C393FE1&_z=z', 'manufacturer', 'Eine kleine Menge auf feuchte oder trockene Längen und Spitzen geben.'),
    ('a72d630d-547a-465f-9846-3006b38af0a2'::uuid, 'Garnier Hair Food Macadamia', 'post_wash_leave_in', 'between_wash_dry_care', 'https://www.garnier.com.au/about-our-brands/fructis/hair-food/fructis-hair-food-smoothing-macadamia', 'manufacturer', 'Als Leave-in auf nassem oder trockenem Haar anwenden.'),
    ('5dc2fae3-a0ca-4e6c-9c30-02dd192772f0'::uuid, 'Gliss Ultimate Repair Sprüh-Conditioner', 'post_wash_leave_in', 'between_wash_dry_care', 'https://www.schwarzkopf.ch/de/marken/haarpflege/gliss/ultimate-repair/ultimate-repair-express-repair-spuelung-200-ml.html', 'manufacturer', 'Auf handtuchtrockenes oder trockenes Haar sprühen.'),
    ('5a9f4b7b-69d9-4e9a-8bbd-2dfbae9a5df3'::uuid, 'HASK Keratin 5-in-1 Spray', 'post_wash_leave_in', 'between_wash_dry_care', 'https://haskbeauty.com/products/smooth-keratin-jojobaoil-5-in-1-leave-in-spray', 'manufacturer', 'Großzügig auf nasses oder trockenes Haar sprühen.'),
    ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'Kevin Murphy Young Again', 'post_wash_leave_in', 'between_wash_dry_care', 'https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html', 'manufacturer', 'Auf feuchtem oder trockenem Haar und zwischen Haarwäschen anwenden.'),
    ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'Kevin Murphy Young Again', 'post_wash_leave_in', 'post_style_finish', 'https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html', 'manufacturer', 'Auf trockenem Haar als Finish anwenden.'),
    ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'Kevin Murphy Young Again', 'pre_heat_protection', 'either_state_protection', 'https://kevinmurphy.com.au/us/en/the-leave-in-treatment-designed-for-all-hair-types-blog.html', 'manufacturer', 'Vor Luft- oder Hitzestyling auf feuchtem oder trockenem Haar anwenden.'),
    ('bbfd8b03-d219-48bb-9ab3-b7c14bcae3dd'::uuid, 'Neqi Leave-In Moisturizing Mist', 'pre_heat_protection', 'pre_heat_damp', 'https://en.neqi-hair.com/products/neqi-x-the-beautiful-people-leave-in-mist', 'manufacturer', 'Großzügig auf handtuchtrockenes Haar sprühen; Hitzeschutz bis 230 °C.'),
    ('35a372b6-c7ef-45cb-be0b-99cef476f247'::uuid, 'Pantene Bonding Leave-In', 'post_wash_leave_in', 'post_wash_damp_conditioning', 'https://www.boots.com/pantene-molecular-bond-repair-leave-in-cream-90ml-for-damaged-hair-10355757', 'retailer', 'Auf nassem oder trockenem Haar anwenden.'),
    ('e781ca9e-886d-40a1-bfe1-48177cfbf381'::uuid, 'Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW', 'post_wash_leave_in', 'between_wash_dry_care', 'https://www.boots.com/pantene-moisture-leave-on-hair-treatment-135ml-10374854', 'retailer', 'Auf handtuchtrockenem Haar oder trocken zwischen Haarwäschen anwenden.'),
    ('f8f3b51d-8e64-487d-bad5-4a47c58862ed'::uuid, 'Pantene Pro-V Miracles 7in1 Haaröl Spray', 'post_wash_leave_in', 'post_wash_damp_conditioning', 'https://www.haircode.uk/products-we-love/hair-oil/pantene-7-in-1-hair-oil-mist', 'retailer', 'Auf feuchtem oder trockenem Haar anwenden.'),
    ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'Redken One United', 'post_wash_leave_in', 'post_wash_damp_conditioning', 'https://www.redken.com/hair-styling/884486219336.html', 'manufacturer', 'Nach der Haarwäsche auf feuchtem Haar anwenden.'),
    ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'Redken One United', 'post_wash_leave_in', 'between_wash_dry_care', 'https://www.redken.com/hair-styling/884486219336.html', 'manufacturer', 'Zwischen Haarwäschen auf trockenem Haar auffrischen.'),
    ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'Redken One United', 'post_wash_leave_in', 'post_style_finish', 'https://www.redken.com/hair-styling/884486219336.html', 'manufacturer', 'Nach dem Styling als Finish anwenden.')
), payloads AS (
  SELECT candidate.*,
    CASE WHEN source_role = 'pre_heat_protection' THEN 'heat_protection' ELSE 'leave_in' END AS semantic_role,
    CASE
      WHEN application_family IN ('post_wash_damp_conditioning', 'pre_heat_damp') THEN 'damp_hair'
      WHEN application_family IN ('between_wash_dry_care', 'post_style_finish') THEN 'dry_hair'
      ELSE 'damp_or_dry_hair'
    END AS physical_state,
    CASE
      WHEN application_family = 'post_wash_damp_conditioning' THEN '["wash_day","intensive_care_day","bond_repair_day","clarifying_wash_day"]'::jsonb
      WHEN application_family = 'between_wash_dry_care' THEN '["refresh_day","between_wash_care_day"]'::jsonb
      WHEN application_family = 'post_style_finish' THEN '["styling_day"]'::jsonb
      ELSE '["wash_day","intensive_care_day","bond_repair_day","clarifying_wash_day","refresh_day","between_wash_care_day","styling_day"]'::jsonb
    END AS compatible_days,
    CASE WHEN application_family IN ('between_wash_dry_care', 'post_style_finish') THEN 'dry_finish' ELSE 'damp_leave_on' END AS anchor,
    CASE
      WHEN application_family = 'post_wash_damp_conditioning' THEN '[{"stepKey":"towel-dry","action":"section","copyTemplateDe":"Das Haar nach dem Waschen sanft handtuchtrocknen."},{"stepKey":"apply","action":"apply_product","copyTemplateDe":"Eine kleine Menge in Längen und Spitzen verteilen. Nicht ausspülen."}]'::jsonb
      WHEN application_family = 'between_wash_dry_care' THEN '[{"stepKey":"dry-care","action":"apply_product","copyTemplateDe":"Mit einer sehr kleinen Menge in trockenen Längen und Spitzen beginnen und nur bei Bedarf ergänzen."}]'::jsonb
      WHEN application_family = 'post_style_finish' THEN '[{"stepKey":"post-style-finish","action":"apply_product","copyTemplateDe":"Mit einer sehr kleinen Menge beginnen und nach dem Styling sparsam über Längen und Spitzen geben."}]'::jsonb
      ELSE '[{"stepKey":"apply","action":"apply_product","copyTemplateDe":"Gleichmäßig auf dem vom Hersteller genannten Haarzustand verteilen. Erst danach föhnen oder stylen."}]'::jsonb
    END AS steps
  FROM candidates candidate
), documents AS (
  SELECT payloads.*,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 1, 'guidanceKey', 'leave-in-use-case-2026-08-14-' || product_id::text || '-' || application_family,
      'protocolVersion', 1, 'locale', 'de',
      'scope', pg_catalog.jsonb_build_object('kind', 'product', 'category', 'leave_in', 'productId', product_id::text),
      'role', semantic_role, 'applicationFamily', application_family,
      'compatibleDayTypes', compatible_days, 'exactGuidanceRequired', true,
      'sequence', pg_catalog.jsonb_build_object('anchor', anchor, 'before', '[]'::jsonb, 'after', '[]'::jsonb, 'conflictsWith', '[]'::jsonb),
      'requirements', pg_catalog.jsonb_build_object('requiredCatalogFacts', '[]'::jsonb, 'requiredProtocolFacts', '[]'::jsonb, 'requiredProfileFacts', CASE WHEN semantic_role = 'heat_protection' THEN '["heatEvents"]'::jsonb ELSE '[]'::jsonb END),
      'protocolFacts', pg_catalog.jsonb_build_object('applicationArea', CASE WHEN semantic_role = 'heat_protection' THEN 'all_hair' ELSE 'lengths_ends' END, 'rinse', 'leave_in', 'contactTimeSeconds', null, 'conditionerRelationship', 'not_applicable', 'reapplication', 'none', 'amount', null, 'cautions', '[]'::jsonb),
      'steps', steps,
      'evidence', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('sourceUrl', source_url, 'sourceType', source_type, 'checkedAt', '2026-08-14'))
    ) AS guidance_v1,
    pg_catalog.jsonb_build_object(
      'schemaVersion', 2,
      'contractKind', 'product_pointer',
      'scope', pg_catalog.jsonb_build_object(
        'kind', 'product',
        'category', 'leave_in',
        'productId', product_id::text
      ),
      'sourceRole', source_role,
      'role', semantic_role,
      'applicationFamily', application_family,
      'facts', pg_catalog.jsonb_build_object(
        'applicationState', physical_state,
        'applicationArea', CASE WHEN semantic_role = 'heat_protection' THEN 'root_to_tip_hair' ELSE 'hair_lengths_ends' END,
        'rinse', 'leave_in',
        'contactTime', null,
        'amount', null,
        'heat', CASE
          WHEN semantic_role <> 'heat_protection' THEN null
          ELSE pg_catalog.jsonb_build_object(
            'supportedStates', CASE
              WHEN physical_state = 'damp_hair' THEN '["damp_hair"]'::jsonb
              WHEN physical_state = 'dry_hair' THEN '["dry_hair"]'::jsonb
              ELSE '["damp_hair","dry_hair"]'::jsonb
            END,
            'activationRequired', false,
            'maximumClaimedTemperatureC', CASE
              WHEN product_id = 'bbfd8b03-d219-48bb-9ab3-b7c14bcae3dd'::uuid THEN 230
              ELSE null
            END,
            'reapplication', 'none'
          )
        END,
        'conditionerPolicy', 'not_applicable'
      ),
      'workflowId', null,
      'requiredCompanionProductId', null,
      'runtimeBlockerCode', null,
      'exactSteps', '[]'::jsonb,
      'cautionCodes', '[]'::jsonb,
      'evidence', pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'sourceUrl', source_url,
        'sourceType', source_type,
        'checkedAt', '2026-08-14'
      ))
    ) AS guidance_v2
  FROM payloads
)
INSERT INTO public.product_application_protocols (
  product_id, category, role, cadence, application_stage, application_state,
  placement, contact_time_seconds, rinse_action, reapplication,
  instruction_modifiers, source_label, source_url, source_text,
  guidance_payload, guidance_payload_v2
)
SELECT product_id, 'leave_in', source_role, NULL,
  CASE
    WHEN application_family = 'post_wash_damp_conditioning' THEN 'towel_dry'
    WHEN application_family = 'between_wash_dry_care' THEN 'dry_hair'
    WHEN application_family = 'post_style_finish' THEN 'post_style'
    ELSE 'pre_heat'
  END,
  CASE WHEN physical_state = 'damp_hair' THEN 'damp' WHEN physical_state = 'dry_hair' THEN 'dry' ELSE 'either' END,
  CASE WHEN semantic_role = 'heat_protection' THEN 'all_hair' ELSE 'lengths_ends' END,
  NULL, 'do_not_rinse', 'not_stated', '[]'::jsonb,
  CASE WHEN source_type = 'manufacturer' THEN 'Hersteller' ELSE 'Händler' END,
  source_url, direction_summary, guidance_v1, guidance_v2
FROM documents;

DELETE FROM public.product_application_protocols
WHERE product_id = '39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid
  AND category = 'leave_in'
  AND role = 'post_wash_leave_in'
  AND application_family = 'between_wash_damp_refresh';

DO $verify$
BEGIN
  IF (
    SELECT count(*)
    FROM public.product_application_protocols
    WHERE (product_id, role, application_family) IN (
      ('f9595d2c-d86d-4bdb-9758-c98d1e213f3c'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
      ('c6e80f39-20ba-401e-b041-6ee7c89a5996'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('6b01025d-9e72-4514-b42e-bbb6065fbe1c'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
      ('118ebae1-b7a9-4a89-a2ff-6c31df28c4dc'::uuid, 'post_wash_leave_in', 'post_style_finish'),
      ('0307c903-84f9-46b4-8f1f-a51c2b1f38ff'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('a72d630d-547a-465f-9846-3006b38af0a2'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('5dc2fae3-a0ca-4e6c-9c30-02dd192772f0'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('5a9f4b7b-69d9-4e9a-8bbd-2dfbae9a5df3'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'post_wash_leave_in', 'post_style_finish'),
      ('6ad82861-d68e-4e70-a976-78c0f35d087b'::uuid, 'pre_heat_protection', 'either_state_protection'),
      ('bbfd8b03-d219-48bb-9ab3-b7c14bcae3dd'::uuid, 'pre_heat_protection', 'pre_heat_damp'),
      ('35a372b6-c7ef-45cb-be0b-99cef476f247'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
      ('e781ca9e-886d-40a1-bfe1-48177cfbf381'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('f8f3b51d-8e64-487d-bad5-4a47c58862ed'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
      ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'post_wash_leave_in', 'post_wash_damp_conditioning'),
      ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'post_wash_leave_in', 'between_wash_dry_care'),
      ('39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid, 'post_wash_leave_in', 'post_style_finish')
    )
  ) <> 18 THEN
    RAISE EXCEPTION 'expected 18 reviewed Leave-in use-case protocol inserts';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.product_application_protocols
    WHERE category = 'leave_in'
      AND guidance_payload->>'guidanceKey' LIKE 'leave-in-use-case-2026-08-14-%'
      AND (
        guidance_payload_v2 IS NULL
        OR guidance_payload_v2->>'schemaVersion' IS DISTINCT FROM '2'
        OR guidance_payload_v2->>'contractKind' IS DISTINCT FROM 'product_pointer'
        OR guidance_payload_v2#>>'{scope,productId}' IS DISTINCT FROM product_id::text
        OR guidance_payload_v2#>>'{scope,category}' IS DISTINCT FROM category
        OR guidance_payload_v2->>'sourceRole' IS DISTINCT FROM role
        OR guidance_payload_v2->>'applicationFamily' IS DISTINCT FROM application_family
      )
  ) THEN
    RAISE EXCEPTION 'reviewed Leave-in use-case inserts require exact V2 pointer identity';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.product_application_protocols
    WHERE product_id = '39ec1b2d-4aa0-4c4e-b581-9b6d5efea530'::uuid
      AND role = 'post_wash_leave_in'
      AND application_family = 'between_wash_damp_refresh'
  ) THEN
    RAISE EXCEPTION 'stale Redken damp-refresh authority survived correction';
  END IF;
END;
$verify$;

-- Operator-only rollback of 20261013150000. Run the complete file atomically.
-- Stops on later edits to the changed fields; inspect/review any guard failure.
BEGIN;
LOCK TABLE public.product_shampoo_specs, public.products,
  public.product_thickness_eligibility, public.product_concern_eligibility,
  public.product_application_protocols, public.shampoo_v162_followups_backup_specs,
  public.shampoo_v162_followups_backup_products, public.shampoo_v162_followups_backup_protocols
  IN SHARE ROW EXCLUSIVE MODE;
DO $guard$
BEGIN
  IF (SELECT count(*) FROM public.shampoo_v162_followups_backup_products) <> 74
     OR (SELECT count(*) FROM public.shampoo_v162_followups_backup_specs) <> 1
     OR (SELECT count(*) FROM public.shampoo_v162_followups_backup_protocols) <> 1
     OR NOT EXISTS (
       SELECT 1 FROM public.shampoo_v162_followups_backup_specs
       WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba' AND category_key = 'shampoo' AND thickness = 'fine'
       AND shampoo_bucket = 'dehydriert-fettig' AND scalp_route = 'oily' AND cleansing_intensity = 'regular'
     ) THEN
    RAISE EXCEPTION 'shampoo v162 followups rollback: incomplete or unexpected backups';
  END IF;
  IF (SELECT count(*) FROM public.products p JOIN public.shampoo_v162_followups_backup_products b USING(id)) <> 74
     OR EXISTS (
       SELECT 1 FROM public.products p JOIN public.shampoo_v162_followups_backup_products b USING(id)
       WHERE p.category_key IS DISTINCT FROM 'shampoo'
         OR (b.description_was_touched AND p.brand IS DISTINCT FROM b.brand)
     ) OR EXISTS (
       SELECT 1 FROM public.products p JOIN public.shampoo_v162_followups_backup_products b USING(id)
       WHERE b.description_was_touched AND p.description IS DISTINCT FROM b.applied_description
     ) THEN
    RAISE EXCEPTION 'shampoo v162 followups rollback: product identity, brand or description changed after apply';
  END IF;
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
     ) OR (SELECT count(*) FROM public.product_application_protocols WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba') <> 2
     OR NOT EXISTS (
       SELECT 1 FROM public.product_application_protocols WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba'
       AND role = 'shampoo_dandruff' AND application_family = 'targeted_treatment_shampoo'
       AND source_url = 'https://sebamed.de/de/p/antischuppen-shampoo-plus/'
       AND guidance_payload_v2#>>'{scope,productId}' = product_id::text
       AND to_jsonb(product_application_protocols) = (
         SELECT applied_dandruff_protocol FROM public.shampoo_v162_followups_backup_products WHERE id = product_id
       )
     ) OR EXISTS (
       SELECT 1 FROM public.shampoo_v162_followups_backup_protocols b
       LEFT JOIN public.product_application_protocols p ON p.id = b.id
       WHERE to_jsonb(p) IS DISTINCT FROM to_jsonb(b)
     ) THEN
    RAISE EXCEPTION 'shampoo v162 followups rollback: A50 state changed after apply';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.products WHERE id = '64fb44d5-8701-46ab-bcba-f1747f071e48'
      AND affiliate_link = 'https://www.hagel-shop.de/products/neqi-volume-victory-shampoo-330-ml-12129028'
      AND purchase_link_status = 'available' AND purchase_link_checked_at = '2026-10-13T12:00:00Z'::timestamptz
  ) THEN
    RAISE EXCEPTION 'shampoo v162 followups rollback: Neqi purchase state changed after apply';
  END IF;
END $guard$;

-- Restore dependency facts first/within the same deferred-publication transaction.
DELETE FROM public.product_shampoo_specs WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba';
INSERT INTO public.product_shampoo_specs
  (product_id, category_key, thickness, shampoo_bucket, scalp_route, cleansing_intensity, created_at, updated_at)
SELECT product_id, category_key, thickness, shampoo_bucket, scalp_route, cleansing_intensity, created_at, updated_at
FROM public.shampoo_v162_followups_backup_specs;
DELETE FROM public.product_application_protocols WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba';
-- Explicit writable columns: category_key/application_family regenerate themselves.
INSERT INTO public.product_application_protocols
  (id, product_id, category, role, cadence, application_stage, application_state, placement,
   contact_time_seconds, rinse_action, reapplication, instruction_modifiers, source_label,
   source_url, source_text, created_at, updated_at, guidance_payload, guidance_payload_v2)
SELECT id, product_id, category, role, cadence, application_stage, application_state, placement,
   contact_time_seconds, rinse_action, reapplication, instruction_modifiers, source_label,
   source_url, source_text, created_at, updated_at, guidance_payload, guidance_payload_v2
FROM public.shampoo_v162_followups_backup_protocols;

UPDATE public.products p SET suitable_thicknesses = b.suitable_thicknesses, updated_at = now()
FROM public.shampoo_v162_followups_backup_products b WHERE p.id = b.id AND p.id = '7e95671b-41a7-4f5c-9188-e535e46678ba';
UPDATE public.products p SET affiliate_link = b.affiliate_link, purchase_link_status = b.purchase_link_status,
  purchase_link_checked_at = b.purchase_link_checked_at, updated_at = now()
FROM public.shampoo_v162_followups_backup_products b WHERE p.id = b.id AND p.id = '64fb44d5-8701-46ab-bcba-f1747f071e48';
UPDATE public.products p SET description = b.description, updated_at = now()
FROM public.shampoo_v162_followups_backup_products b WHERE p.id = b.id AND b.description_was_touched;

-- Run after spec/array writes so compat triggers cannot overwrite the snapshots.
DELETE FROM public.product_thickness_eligibility WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba' AND category_key = 'shampoo';
INSERT INTO public.product_thickness_eligibility (product_id, category_key, thickness, created_at)
SELECT e.product_id, e.category_key, e.thickness, e.created_at
FROM public.shampoo_v162_followups_backup_products b,
 LATERAL jsonb_populate_recordset(NULL::public.product_thickness_eligibility, b.thickness_eligibility) e
WHERE b.id = '7e95671b-41a7-4f5c-9188-e535e46678ba';
DELETE FROM public.product_concern_eligibility WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba' AND category_key = 'shampoo';
INSERT INTO public.product_concern_eligibility (product_id, category_key, concern_key, created_at)
SELECT e.product_id, e.category_key, e.concern_key, e.created_at
FROM public.shampoo_v162_followups_backup_products b,
 LATERAL jsonb_populate_recordset(NULL::public.product_concern_eligibility, b.concern_eligibility) e
WHERE b.id = '7e95671b-41a7-4f5c-9188-e535e46678ba';

DO $post$
BEGIN
  IF (SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY thickness, shampoo_bucket), '[]'::jsonb)
      FROM public.product_shampoo_specs s WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba') IS DISTINCT FROM
     (SELECT jsonb_agg(to_jsonb(b) ORDER BY thickness, shampoo_bucket) FROM public.shampoo_v162_followups_backup_specs b)
     OR (SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY id), '[]'::jsonb)
         FROM public.product_application_protocols p WHERE product_id = '7e95671b-41a7-4f5c-9188-e535e46678ba') IS DISTINCT FROM
        (SELECT jsonb_agg(to_jsonb(b) ORDER BY id) FROM public.shampoo_v162_followups_backup_protocols b)
     OR EXISTS (
       SELECT 1 FROM public.shampoo_v162_followups_backup_products b JOIN public.products p USING(id)
       WHERE (b.description_was_touched AND p.description IS DISTINCT FROM b.description)
          OR (p.id = '7e95671b-41a7-4f5c-9188-e535e46678ba' AND p.suitable_thicknesses IS DISTINCT FROM b.suitable_thicknesses)
          OR (p.id = '64fb44d5-8701-46ab-bcba-f1747f071e48' AND
              (p.affiliate_link, p.purchase_link_status, p.purchase_link_checked_at) IS DISTINCT FROM
              (b.affiliate_link, b.purchase_link_status, b.purchase_link_checked_at))
     ) THEN
    RAISE EXCEPTION 'shampoo v162 followups rollback: restored facts/products differ from backups';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.shampoo_v162_followups_backup_products b WHERE b.id = '7e95671b-41a7-4f5c-9188-e535e46678ba' AND (
      b.thickness_eligibility IS DISTINCT FROM (
        SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY thickness), '[]'::jsonb)
        FROM public.product_thickness_eligibility e WHERE product_id = b.id AND category_key = 'shampoo'
      ) OR b.concern_eligibility IS DISTINCT FROM (
        SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY concern_key), '[]'::jsonb)
        FROM public.product_concern_eligibility e WHERE product_id = b.id AND category_key = 'shampoo'
      )
    )
  ) THEN
    RAISE EXCEPTION 'shampoo v162 followups rollback: restored shared eligibility differs from backups';
  END IF;
END $post$;
COMMIT;
-- Keep the private backup tables for inspection; cleanup needs a later migration.

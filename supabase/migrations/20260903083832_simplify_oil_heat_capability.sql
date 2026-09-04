-- Oil has three application purposes. Heat protection is an independent
-- capability of a leave-on oil, not a fourth purpose/protocol role.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('simplify_oil_heat_capability_20260903'));

-- This changes the meaning of an Oil role. Hold the Personal Plan sources
-- closed while we prove that no accepted Routine, pending proposal, or draft
-- has captured one of the thirteen reviewed products.
LOCK TABLE public.personal_plan_product_drafts,
           public.personal_plan_routine_versions,
           public.personal_plan_routine_proposals,
           public.personal_plans,
           public.personal_plan_catalog_fact_evidence IN SHARE MODE;

LOCK TABLE public.product_oil_specs,
           public.product_application_protocols IN ACCESS EXCLUSIVE MODE;

DO $preflight$
DECLARE
  target_ids uuid[] := ARRAY[
    '27a2dd61-6e54-4746-8e24-a698dbafbf91',
    '5827a3b9-a488-4c74-b13a-4d655f94f1c3',
    '5ad6c978-fd27-469e-9f26-ff3f05b9f67a',
    '7b5ff358-1b3b-411d-9220-5e6d30543235',
    '7d8c0150-778d-4cb9-abf5-bfc16ad93b12',
    'e6b87909-6104-4a9a-a3ef-e1c64a1b15b1',
    '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf',
    'c574ee6f-ad22-45c0-b936-57b847d93433',
    'f7f28e1c-e177-4505-906d-c59f4291ba6b',
    '55c39339-bac0-4899-9499-ee96fa0bdad8',
    '7dcde56c-40e7-4e84-86b7-f6ac3d407a9d',
    '4eddfc54-3704-4a3e-a9b7-0cff91538863',
    'f89c1edc-cb71-4ec6-ac86-dc27c515568e'
  ]::uuid[];
  evidence_ids uuid[] := ARRAY[
    '27a2dd61-6e54-4746-8e24-a698dbafbf91',
    '5827a3b9-a488-4c74-b13a-4d655f94f1c3',
    '5ad6c978-fd27-469e-9f26-ff3f05b9f67a',
    '7b5ff358-1b3b-411d-9220-5e6d30543235',
    '7d8c0150-778d-4cb9-abf5-bfc16ad93b12',
    'e6b87909-6104-4a9a-a3ef-e1c64a1b15b1',
    '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf',
    'c574ee6f-ad22-45c0-b936-57b847d93433'
  ]::uuid[];
  garnier_id uuid := 'c574ee6f-ad22-45c0-b936-57b847d93433';
  spec_count integer;
  old_spec_count integer;
  all_old_oil_spec_count integer;
  old_protocol_count integer;
  all_old_oil_protocol_count integer;
  leave_on_count integer;
  invalid_protocol_payload_count integer;
  invalid_legacy_heat_evidence_count integer;
  evidence_product_count integer;
  evidence_row_count integer;
  unexpected_target_evidence_count integer;
  invalid_evidence_count integer;
  is_poststate boolean;
BEGIN
  SELECT
    count(*),
    count(*) FILTER (WHERE role_support @> ARRAY['pre_heat_protection']::text[])
  INTO spec_count, old_spec_count
  FROM public.product_oil_specs
  WHERE product_id = ANY(target_ids);

  SELECT count(*)
  INTO all_old_oil_spec_count
  FROM public.product_oil_specs
  WHERE role_support @> ARRAY['pre_heat_protection']::text[];

  SELECT count(*)
  INTO old_protocol_count
  FROM public.product_application_protocols
  WHERE product_id = ANY(target_ids)
    AND category = 'oil'
    AND role = 'pre_heat_protection';

  SELECT count(*)
  INTO all_old_oil_protocol_count
  FROM public.product_application_protocols
  WHERE category = 'oil'
    AND role = 'pre_heat_protection';

  SELECT count(*)
  INTO leave_on_count
  FROM public.product_application_protocols
  WHERE product_id = ANY(target_ids)
    AND category = 'oil'
    AND role = 'leave_on_fibre_conditioning';

  -- Replaying the already normalized migration is a no-op. Initial execution
  -- continues below through the exact old-state guards and postflight.
  SELECT
    spec_count = 13
    AND count(*) = 13
    AND coalesce(bool_and(
      provides_heat_protection IS TRUE
      AND role_support @> ARRAY['leave_on_fibre_conditioning']::text[]
      AND NOT role_support @> ARRAY['pre_heat_protection']::text[]
    ), false)
    AND old_protocol_count = 0
    AND all_old_oil_protocol_count = 0
    AND leave_on_count = 13
  INTO is_poststate
  FROM public.product_oil_specs
  WHERE product_id = ANY(target_ids);

  IF is_poststate THEN
    RETURN;
  END IF;

  -- Aggregate counts can be masked by two protocol families on one product and
  -- none on another. Every reviewed identity has an exact expected protocol
  -- cardinality: one old heat role each; one leave-on role for the twelve
  -- ordinary leave-on oils; none yet for the Garnier conversion row.
  IF EXISTS (
    SELECT 1
    FROM unnest(target_ids) AS target(product_id)
    LEFT JOIN LATERAL (
      SELECT count(*) AS protocol_count
      FROM public.product_application_protocols protocol
      WHERE protocol.product_id = target.product_id
        AND protocol.category = 'oil'
        AND protocol.role = 'pre_heat_protection'
    ) old_protocol ON true
    LEFT JOIN LATERAL (
      SELECT count(*) AS protocol_count
      FROM public.product_application_protocols protocol
      WHERE protocol.product_id = target.product_id
        AND protocol.category = 'oil'
        AND protocol.role = 'leave_on_fibre_conditioning'
    ) leave_on_protocol ON true
    WHERE old_protocol.protocol_count <> 1
       OR (
         target.product_id = garnier_id
         AND leave_on_protocol.protocol_count <> 0
       )
       OR (
         target.product_id <> garnier_id
         AND leave_on_protocol.protocol_count <> 1
       )
  ) THEN
    RAISE EXCEPTION 'oil heat capability prestate protocol membership drift';
  END IF;

  -- The migration rewrites Garnier's canonical V1/V2 pointer identities; do
  -- not mutate an incomplete or wrongly indexed protocol payload.
  SELECT count(*)
  INTO invalid_protocol_payload_count
  FROM public.product_application_protocols protocol
  WHERE protocol.product_id = ANY(target_ids)
    AND protocol.category = 'oil'
    AND protocol.role IN ('pre_heat_protection', 'leave_on_fibre_conditioning')
    AND (
      jsonb_typeof(protocol.guidance_payload) IS DISTINCT FROM 'object'
      OR protocol.guidance_payload->>'schemaVersion' IS DISTINCT FROM '1'
      OR protocol.guidance_payload#>>'{scope,kind}' IS DISTINCT FROM 'product'
      OR protocol.guidance_payload#>>'{scope,productId}' IS DISTINCT FROM protocol.product_id::text
      OR protocol.guidance_payload#>>'{scope,category}' IS DISTINCT FROM 'oil'
      OR protocol.guidance_payload->>'role' IS DISTINCT FROM CASE protocol.role
        WHEN 'pre_heat_protection' THEN 'heat_protection'
        ELSE 'leave_in'
      END
      OR jsonb_typeof(protocol.guidance_payload_v2) IS DISTINCT FROM 'object'
      OR protocol.guidance_payload_v2->>'schemaVersion' IS DISTINCT FROM '2'
      OR protocol.guidance_payload_v2->>'contractKind' IS DISTINCT FROM 'product_pointer'
      OR protocol.guidance_payload_v2#>>'{scope,kind}' IS DISTINCT FROM 'product'
      OR protocol.guidance_payload_v2#>>'{scope,productId}' IS DISTINCT FROM protocol.product_id::text
      OR protocol.guidance_payload_v2#>>'{scope,category}' IS DISTINCT FROM 'oil'
      OR protocol.guidance_payload_v2->>'sourceRole' IS DISTINCT FROM protocol.role
      OR protocol.guidance_payload_v2->>'role' IS DISTINCT FROM CASE protocol.role
        WHEN 'pre_heat_protection' THEN 'heat_protection'
        ELSE 'leave_in'
      END
    );

  -- The pre-heat protocol is the evidence source for the normalized binary;
  -- do not turn a reviewed claim into `provides_heat_protection = true` if its
  -- stored source is blank or its V1 evidence no longer points to that source.
  SELECT count(*)
  INTO invalid_legacy_heat_evidence_count
  FROM public.product_application_protocols protocol
  WHERE protocol.product_id = ANY(target_ids)
    AND protocol.category = 'oil'
    AND protocol.role = 'pre_heat_protection'
    AND (
      nullif(btrim(protocol.source_url), '') IS NULL
      OR nullif(btrim(protocol.source_text), '') IS NULL
      OR NOT jsonb_path_exists(
        protocol.guidance_payload,
        '$.evidence[*] ? (@.sourceUrl == $sourceUrl)',
        jsonb_build_object('sourceUrl', to_jsonb(protocol.source_url))
      )
    );

  SELECT count(DISTINCT evidence.product_id), count(*), count(*) FILTER (
    WHERE jsonb_typeof(evidence.fact_value) IS DISTINCT FROM 'object'
       OR NOT evidence.fact_value ? 'role_support'
       OR NOT evidence.fact_value->'role_support' @> '["pre_heat_protection"]'::jsonb
  )
  INTO evidence_product_count, evidence_row_count, invalid_evidence_count
  FROM public.personal_plan_catalog_fact_evidence evidence
  WHERE evidence.product_id = ANY(evidence_ids)
    AND evidence.fact_key = 'oil.authority_facts';

  SELECT count(*)
  INTO unexpected_target_evidence_count
  FROM public.personal_plan_catalog_fact_evidence evidence
  WHERE evidence.product_id = ANY(target_ids)
    AND evidence.product_id <> ALL(evidence_ids)
    AND evidence.fact_key = 'oil.authority_facts';

  IF evidence_product_count <> 8
     OR evidence_row_count <> 16
     OR unexpected_target_evidence_count <> 0
     OR invalid_evidence_count <> 0 THEN
    RAISE EXCEPTION 'oil heat capability prestate evidence drift';
  END IF;

  -- Existing accepted plans using an Oil for one of its three retained
  -- purposes are compatible with this normalization. Only a document that
  -- pairs one of these identities with the retired heat role is a collision.
  IF EXISTS (
    SELECT 1
    FROM unnest(target_ids) AS target(product_id)
    CROSS JOIN LATERAL (
      SELECT draft.payload AS document FROM public.personal_plan_product_drafts draft
      UNION ALL
      SELECT routine.payload FROM public.personal_plan_routine_versions routine
      UNION ALL
      SELECT proposal.delta FROM public.personal_plan_routine_proposals proposal
      UNION ALL
      SELECT routine.payload
      FROM public.personal_plans plan
      JOIN public.personal_plan_routine_versions routine
        ON routine.id = plan.active_routine_version_id
    ) plan_reference
    WHERE jsonb_path_exists(
      plan_reference.document,
      '$.items[*] ? (@.category == "oil" && (@.product.productId == $targetId || @.product.product_id == $targetId || @.productId == $targetId || @.product_id == $targetId) && (@.role == "pre_heat_protection" || @.role == "pre_heat_application" || @.role == "heat_protection" || @.sourceRoutineRole == "pre_heat_protection" || @.sourceRoutineRole == "pre_heat_application" || @.sourceRoutineRole == "heat_protection" || @.sourceRole == "pre_heat_protection" || @.sourceRole == "pre_heat_application" || @.sourceRole == "heat_protection"))',
      jsonb_build_object('targetId', to_jsonb(target.product_id::text))
    )
       OR jsonb_path_exists(
         plan_reference.document,
         '$.** ? ((@.productId == $targetId || @.product_id == $targetId || @.catalogProductId == $targetId || @.catalog_product_id == $targetId) && (@.role == "pre_heat_protection" || @.role == "pre_heat_application" || @.role == "heat_protection" || @.sourceRoutineRole == "pre_heat_protection" || @.sourceRoutineRole == "pre_heat_application" || @.sourceRoutineRole == "heat_protection" || @.sourceRole == "pre_heat_protection" || @.sourceRole == "pre_heat_application" || @.sourceRole == "heat_protection"))',
         jsonb_build_object('targetId', to_jsonb(target.product_id::text))
       )
  ) THEN
    RAISE EXCEPTION 'oil heat capability Personal Plan legacy heat-role collision';
  END IF;

  IF spec_count <> 13
     OR old_spec_count <> 13
     OR all_old_oil_spec_count <> 13
     OR old_protocol_count <> 13
     OR all_old_oil_protocol_count <> 13
     OR leave_on_count <> 12
     OR invalid_protocol_payload_count <> 0
     OR invalid_legacy_heat_evidence_count <> 0
     OR EXISTS (
       SELECT 1
       FROM public.product_application_protocols
       WHERE product_id = garnier_id
         AND category = 'oil'
         AND role = 'leave_on_fibre_conditioning'
     ) THEN
    RAISE EXCEPTION
      'oil heat capability prestate drift: specs %, target old specs %, all old specs %, target old protocols %, all old oil protocols %, leave-on %, invalid payloads %, invalid legacy evidence %',
      spec_count, old_spec_count, all_old_oil_spec_count, old_protocol_count,
      all_old_oil_protocol_count, leave_on_count, invalid_protocol_payload_count,
      invalid_legacy_heat_evidence_count;
  END IF;
END;
$preflight$;

-- Convert the only heat-only Oil row into its ordinary damp leave-on purpose.
-- Heat capability now comes from product_oil_specs; the application protocol
-- stays an ordinary after-wash application and carries no separate heat role.
UPDATE public.product_application_protocols
SET
  role = 'leave_on_fibre_conditioning',
  application_stage = 'damp_leave_on',
  application_state = 'damp',
  reapplication = 'not_stated',
  guidance_payload = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(guidance_payload, '{role}', '"leave_in"'::jsonb, true),
                '{applicationFamily}', '"post_wash_damp_conditioning"'::jsonb, true
              ),
              '{guidanceKey}', to_jsonb('product-oil-c574ee6f-ad22-45c0-b936-57b847d93433-leave-on'::text), true
            ),
            '{compatibleDayTypes}', '["wash_day","intensive_care_day","bond_repair_day","clarifying_wash_day"]'::jsonb, true
          ),
          '{sequence,anchor}', '"damp_leave_on"'::jsonb, true
        ),
        '{sequence,before}', '[]'::jsonb, true
      ),
      '{protocolFacts,reapplication}', '"none"'::jsonb, true
    ),
    '{steps}',
    jsonb_build_array(
      jsonb_build_object(
        'stepKey', 'apply-garnier-leave-on',
        'action', 'apply_product',
        'copyTemplateDe', 'Einen Pumpstoß gleichmäßig in die feuchten Längen und Spitzen geben und nicht ausspülen.'
      )
    ),
    true
  ),
  guidance_payload_v2 = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(guidance_payload_v2, '{sourceRole}', '"leave_on_fibre_conditioning"'::jsonb, true),
        '{role}', '"leave_in"'::jsonb, true
      ),
      '{applicationFamily}', '"post_wash_damp_conditioning"'::jsonb, true
    ),
    '{facts,heat}', 'null'::jsonb, true
  ),
  updated_at = now()
WHERE product_id = 'c574ee6f-ad22-45c0-b936-57b847d93433'
  AND category = 'oil'
  AND role = 'pre_heat_protection';

-- The thirteen reviewed damp/post-wash Oils are compatible only with their exact
-- wash-family contexts. A future styling-context Oil needs its own explicitly
-- reviewed product protocol; heat capability alone does not grant styling_day.
UPDATE public.product_application_protocols
SET
  guidance_payload = jsonb_set(
    guidance_payload,
    '{compatibleDayTypes}',
    '["wash_day","intensive_care_day","bond_repair_day","clarifying_wash_day"]'::jsonb,
    true
  ),
  updated_at = now()
WHERE product_id IN (
  '27a2dd61-6e54-4746-8e24-a698dbafbf91',
  '5827a3b9-a488-4c74-b13a-4d655f94f1c3',
  '5ad6c978-fd27-469e-9f26-ff3f05b9f67a',
  '7b5ff358-1b3b-411d-9220-5e6d30543235',
  '7d8c0150-778d-4cb9-abf5-bfc16ad93b12',
  'e6b87909-6104-4a9a-a3ef-e1c64a1b15b1',
  '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf',
  'c574ee6f-ad22-45c0-b936-57b847d93433',
  'f7f28e1c-e177-4505-906d-c59f4291ba6b',
  '55c39339-bac0-4899-9499-ee96fa0bdad8',
  '7dcde56c-40e7-4e84-86b7-f6ac3d407a9d',
  '4eddfc54-3704-4a3e-a9b7-0cff91538863',
  'f89c1edc-cb71-4ec6-ac86-dc27c515568e'
)
  AND category = 'oil'
  AND role = 'leave_on_fibre_conditioning'
  AND guidance_payload->'compatibleDayTypes' IS DISTINCT FROM
    '["wash_day","intensive_care_day","bond_repair_day","clarifying_wash_day"]'::jsonb;

DELETE FROM public.product_application_protocols
WHERE category = 'oil'
  AND role = 'pre_heat_protection'
  AND product_id IN (
    '27a2dd61-6e54-4746-8e24-a698dbafbf91',
    '5827a3b9-a488-4c74-b13a-4d655f94f1c3',
    '5ad6c978-fd27-469e-9f26-ff3f05b9f67a',
    '7b5ff358-1b3b-411d-9220-5e6d30543235',
    '7d8c0150-778d-4cb9-abf5-bfc16ad93b12',
    'e6b87909-6104-4a9a-a3ef-e1c64a1b15b1',
    '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf',
    'f7f28e1c-e177-4505-906d-c59f4291ba6b',
    '55c39339-bac0-4899-9499-ee96fa0bdad8',
    '7dcde56c-40e7-4e84-86b7-f6ac3d407a9d',
    '4eddfc54-3704-4a3e-a9b7-0cff91538863',
    'f89c1edc-cb71-4ec6-ac86-dc27c515568e'
  );

UPDATE public.product_oil_specs
SET
  role_support = CASE
    WHEN role_support @> ARRAY['leave_on_fibre_conditioning']::text[]
      THEN array_remove(role_support, 'pre_heat_protection')
    ELSE array_append(array_remove(role_support, 'pre_heat_protection'), 'leave_on_fibre_conditioning')
  END,
  provides_heat_protection = true,
  updated_at = now()
WHERE product_id IN (
  '27a2dd61-6e54-4746-8e24-a698dbafbf91',
  '5827a3b9-a488-4c74-b13a-4d655f94f1c3',
  '5ad6c978-fd27-469e-9f26-ff3f05b9f67a',
  '7b5ff358-1b3b-411d-9220-5e6d30543235',
  '7d8c0150-778d-4cb9-abf5-bfc16ad93b12',
  'e6b87909-6104-4a9a-a3ef-e1c64a1b15b1',
  '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf',
  'c574ee6f-ad22-45c0-b936-57b847d93433',
  'f7f28e1c-e177-4505-906d-c59f4291ba6b',
  '55c39339-bac0-4899-9499-ee96fa0bdad8',
  '7dcde56c-40e7-4e84-86b7-f6ac3d407a9d',
  '4eddfc54-3704-4a3e-a9b7-0cff91538863',
  'f89c1edc-cb71-4ec6-ac86-dc27c515568e'
)
  AND (
    role_support @> ARRAY['pre_heat_protection']::text[]
    OR NOT role_support @> ARRAY['leave_on_fibre_conditioning']::text[]
    OR provides_heat_protection IS DISTINCT FROM true
  );

UPDATE public.personal_plan_catalog_fact_evidence evidence
SET fact_value = jsonb_set(
  jsonb_set(evidence.fact_value, '{role_support}', to_jsonb(spec.role_support), true),
  '{provides_heat_protection}', 'true'::jsonb, true
)
FROM public.product_oil_specs spec
WHERE evidence.product_id = spec.product_id
  AND evidence.product_id IN (
    '27a2dd61-6e54-4746-8e24-a698dbafbf91',
    '5827a3b9-a488-4c74-b13a-4d655f94f1c3',
    '5ad6c978-fd27-469e-9f26-ff3f05b9f67a',
    '7b5ff358-1b3b-411d-9220-5e6d30543235',
    '7d8c0150-778d-4cb9-abf5-bfc16ad93b12',
    'e6b87909-6104-4a9a-a3ef-e1c64a1b15b1',
    '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf',
    'c574ee6f-ad22-45c0-b936-57b847d93433'
  )
  AND evidence.fact_key = 'oil.authority_facts';

ALTER TABLE public.product_oil_specs
  DROP CONSTRAINT product_oil_specs_role_support_check,
  ADD CONSTRAINT product_oil_specs_role_support_check CHECK (
    role_support IS NULL
    OR role_support <@ ARRAY[
      'pre_wash_fibre_treatment',
      'leave_on_fibre_conditioning',
      'dry_finish'
    ]::text[]
  );

ALTER TABLE public.product_application_protocols
  DROP CONSTRAINT product_application_protocols_role_category_check,
  ADD CONSTRAINT product_application_protocols_role_category_check CHECK (
    (category = 'shampoo' AND role IN ('shampoo_everyday', 'shampoo_dandruff'))
    OR (category = 'conditioner' AND role = 'conditioner_rinse_out')
    OR (category = 'leave_in' AND role IN ('post_wash_leave_in', 'pre_heat_protection'))
    OR (category = 'mask' AND role = 'intensive_conditioning_mask')
    OR (category = 'oil' AND role IN ('pre_wash_fibre_treatment', 'leave_on_fibre_conditioning', 'dry_finish'))
    OR (category = 'heat_protectant' AND role = 'pre_heat_protection')
    OR (category = 'bondbuilder' AND role = 'specialized_bond_treatment')
    OR (category = 'deep_cleansing_shampoo' AND role IN ('residue_reset', 'mineral_reset'))
    OR (category = 'dry_shampoo' AND role = 'root_refresh_bridge')
    OR (category = 'scalp_care' AND role IN ('scalp_comfort', 'scalp_flake_oil_adjunct', 'density_claim_tonic', 'scalp_exfoliant'))
  );

DO $postflight$
DECLARE
  target_ids uuid[] := ARRAY[
    '27a2dd61-6e54-4746-8e24-a698dbafbf91',
    '5827a3b9-a488-4c74-b13a-4d655f94f1c3',
    '5ad6c978-fd27-469e-9f26-ff3f05b9f67a',
    '7b5ff358-1b3b-411d-9220-5e6d30543235',
    '7d8c0150-778d-4cb9-abf5-bfc16ad93b12',
    'e6b87909-6104-4a9a-a3ef-e1c64a1b15b1',
    '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf',
    'c574ee6f-ad22-45c0-b936-57b847d93433',
    'f7f28e1c-e177-4505-906d-c59f4291ba6b',
    '55c39339-bac0-4899-9499-ee96fa0bdad8',
    '7dcde56c-40e7-4e84-86b7-f6ac3d407a9d',
    '4eddfc54-3704-4a3e-a9b7-0cff91538863',
    'f89c1edc-cb71-4ec6-ac86-dc27c515568e'
  ]::uuid[];
  evidence_ids uuid[] := ARRAY[
    '27a2dd61-6e54-4746-8e24-a698dbafbf91',
    '5827a3b9-a488-4c74-b13a-4d655f94f1c3',
    '5ad6c978-fd27-469e-9f26-ff3f05b9f67a',
    '7b5ff358-1b3b-411d-9220-5e6d30543235',
    '7d8c0150-778d-4cb9-abf5-bfc16ad93b12',
    'e6b87909-6104-4a9a-a3ef-e1c64a1b15b1',
    '1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf',
    'c574ee6f-ad22-45c0-b936-57b847d93433'
  ]::uuid[];
  garnier_id uuid := 'c574ee6f-ad22-45c0-b936-57b847d93433';
  invalid_protocol_payload_count integer;
  evidence_product_count integer;
  evidence_row_count integer;
  unexpected_target_evidence_count integer;
  invalid_evidence_count integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM unnest(target_ids) AS target(product_id)
    LEFT JOIN LATERAL (
      SELECT count(*) AS protocol_count
      FROM public.product_application_protocols protocol
      WHERE protocol.product_id = target.product_id
        AND protocol.category = 'oil'
        AND protocol.role = 'leave_on_fibre_conditioning'
    ) leave_on_protocol ON true
    WHERE leave_on_protocol.protocol_count <> 1
  ) THEN
    RAISE EXCEPTION 'oil heat capability poststate protocol membership failed';
  END IF;

  SELECT count(*)
  INTO invalid_protocol_payload_count
  FROM public.product_application_protocols protocol
  WHERE protocol.product_id = ANY(target_ids)
    AND protocol.category = 'oil'
    AND protocol.role = 'leave_on_fibre_conditioning'
    AND (
      jsonb_typeof(protocol.guidance_payload) IS DISTINCT FROM 'object'
      OR protocol.guidance_payload->>'schemaVersion' IS DISTINCT FROM '1'
      OR protocol.guidance_payload#>>'{scope,kind}' IS DISTINCT FROM 'product'
      OR protocol.guidance_payload#>>'{scope,productId}' IS DISTINCT FROM protocol.product_id::text
      OR protocol.guidance_payload#>>'{scope,category}' IS DISTINCT FROM 'oil'
      OR protocol.guidance_payload->>'role' IS DISTINCT FROM 'leave_in'
      OR protocol.guidance_payload->'compatibleDayTypes' IS DISTINCT FROM
        '["wash_day","intensive_care_day","bond_repair_day","clarifying_wash_day"]'::jsonb
      OR jsonb_typeof(protocol.guidance_payload_v2) IS DISTINCT FROM 'object'
      OR protocol.guidance_payload_v2->>'schemaVersion' IS DISTINCT FROM '2'
      OR protocol.guidance_payload_v2->>'contractKind' IS DISTINCT FROM 'product_pointer'
      OR protocol.guidance_payload_v2#>>'{scope,kind}' IS DISTINCT FROM 'product'
      OR protocol.guidance_payload_v2#>>'{scope,productId}' IS DISTINCT FROM protocol.product_id::text
      OR protocol.guidance_payload_v2#>>'{scope,category}' IS DISTINCT FROM 'oil'
      OR protocol.guidance_payload_v2->>'sourceRole' IS DISTINCT FROM 'leave_on_fibre_conditioning'
      OR protocol.guidance_payload_v2->>'role' IS DISTINCT FROM 'leave_in'
    );

  SELECT count(DISTINCT evidence.product_id), count(*), count(*) FILTER (
    WHERE jsonb_typeof(evidence.fact_value) IS DISTINCT FROM 'object'
       OR NOT evidence.fact_value ? 'role_support'
       OR evidence.fact_value->'role_support' @> '["pre_heat_protection"]'::jsonb
       OR NOT evidence.fact_value->'role_support' @> '["leave_on_fibre_conditioning"]'::jsonb
       OR evidence.fact_value->>'provides_heat_protection' IS DISTINCT FROM 'true'
  )
  INTO evidence_product_count, evidence_row_count, invalid_evidence_count
  FROM public.personal_plan_catalog_fact_evidence evidence
  WHERE evidence.product_id = ANY(evidence_ids)
    AND evidence.fact_key = 'oil.authority_facts';

  SELECT count(*)
  INTO unexpected_target_evidence_count
  FROM public.personal_plan_catalog_fact_evidence evidence
  WHERE evidence.product_id = ANY(target_ids)
    AND evidence.product_id <> ALL(evidence_ids)
    AND evidence.fact_key = 'oil.authority_facts';

  IF (SELECT count(*) FROM public.product_oil_specs WHERE product_id = ANY(target_ids)) <> 13
     OR EXISTS (
       SELECT 1 FROM public.product_oil_specs
       WHERE product_id = ANY(target_ids)
         AND (
           provides_heat_protection IS DISTINCT FROM true
           OR NOT role_support @> ARRAY['leave_on_fibre_conditioning']::text[]
           OR role_support @> ARRAY['pre_heat_protection']::text[]
         )
     )
     OR EXISTS (
       SELECT 1 FROM public.product_application_protocols
       WHERE category = 'oil' AND role = 'pre_heat_protection'
     )
     OR invalid_protocol_payload_count <> 0
     OR EXISTS (
       SELECT 1
       FROM public.product_application_protocols protocol
       WHERE protocol.product_id = garnier_id
         AND (
           protocol.guidance_payload->'compatibleDayTypes' IS DISTINCT FROM
             '["wash_day","intensive_care_day","bond_repair_day","clarifying_wash_day"]'::jsonb
           OR protocol.guidance_payload#>'{sequence,before}' IS DISTINCT FROM '[]'::jsonb
           OR protocol.guidance_payload#>'{protocolFacts,reapplication}' IS DISTINCT FROM '"none"'::jsonb
           OR protocol.guidance_payload_v2#>'{facts,heat}' IS DISTINCT FROM 'null'::jsonb
         )
     )
     OR evidence_product_count <> 8
     OR evidence_row_count <> 16
     OR unexpected_target_evidence_count <> 0
     OR invalid_evidence_count <> 0 THEN
    RAISE EXCEPTION 'oil heat capability poststate verification failed';
  END IF;
END;
$postflight$;

COMMIT;

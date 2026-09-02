-- DEFECT REPAIR (found while building the Scan DB Expansion batch adapter, T5).
--
-- `product_intake_approve_reviewed_product_before_thumbnail_image` — the body
-- introduced by 20260814120000_personal_plan_application_use_case_variants.sql:89
-- and renamed into place by 20260815074148_product_image_thumbnails.sql:35 — is
-- the layer that every Product-Intake approval passes through today
-- (20260826142100 → …_before_scanned_identifier → …_before_thumbnail_image).
--
-- Its very first statement is:
--
--     DECLARE operation jsonb;
--     ...
--     SELECT 1 FROM pg_catalog.jsonb_array_elements(...) operation
--     WHERE operation->>'table' = 'product_application_protocols'
--
-- Aliasing a scalar set-returning function names BOTH the table and its single
-- column `operation`, which collides with the declared PL/pgSQL variable of the
-- same name. With the default `plpgsql.variable_conflict = error` PostgreSQL
-- raises `42702 column reference "operation" is ambiguous` at plan time — so the
-- statement fails on EVERY call, before any product is created. Reproduced on
-- PostgreSQL 17.5.
--
-- PRODUCTION STATE (verified 2026-09-02): prod is HEALTHY. Its live
-- `…_before_thumbnail_image` body already carries the fix as
-- `... AS spec_operation(value) WHERE spec_operation.value->>'table' = ...`,
-- applied out of band — no migration in this repo carries it. So the defect is
-- real for every *fresh replay* of the migration files (CI, a new Supabase
-- branch, a restored environment) while prod itself is fine.
--
-- This migration therefore has to be a CONVERGENCE, not a one-way repair: it
-- brings the fix under migration control and makes replayed and live schemas
-- agree on one reviewed body. It re-creates the body with the alias renamed to
-- `spec_operation(value)`; nothing else changes — same guards, same order, same
-- writes.
--
-- The guard below accepts EXACTLY TWO pre-states and hard-fails on anything else:
--   (a) the defective body (fresh replay)  → replaced;
--   (b) a body already carrying the alias fix (prod) → re-created idempotently,
--       which is a behavioural no-op and puts the text under version control.
-- Any third body means drift beyond this alias, which must be reviewed rather
-- than silently overwritten — the landmark checks below are what distinguish
-- "same logic, fixed alias" from "something else happened here".
DO $assert_pre_state$
DECLARE
  v_source text;
  v_defective boolean;
  v_already_fixed boolean;
  v_missing text;
BEGIN
  SELECT prosrc INTO v_source
  FROM pg_catalog.pg_proc proc
  JOIN pg_catalog.pg_namespace namespace ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public'
    AND proc.proname = 'product_intake_approve_reviewed_product_before_thumbnail_image';

  IF v_source IS NULL THEN
    RAISE EXCEPTION 'product intake approval chain does not match the reviewed pre-state: function is missing';
  END IF;

  v_defective := pg_catalog.strpos(v_source, '''[]''::jsonb)) operation') > 0;
  v_already_fixed := pg_catalog.strpos(v_source, 'spec_operation(value)') > 0;

  IF v_defective = v_already_fixed THEN
    RAISE EXCEPTION
      'product intake approval body matches neither reviewed pre-state (defective alias: %, spec_operation fix: %); re-review this repair',
      v_defective, v_already_fixed;
  END IF;

  -- Both accepted pre-states must still be the SAME reviewed logic. Anything
  -- that lost one of these landmarks is a third, unknown body.
  SELECT pg_catalog.string_agg(landmark, ', ' ORDER BY landmark)
  INTO v_missing
  FROM (VALUES
    ('canonical V1/V2 protocol scope is required'),
    ('canonical V1/V2 protocol scope and application family must match the approved product operation'),
    ('product_intake_approve_reviewed_product_without_canonical_guidance'),
    ('ON CONFLICT (product_id, category, role, application_family)'),
    ('public.product_mask_specs'),
    ('public.product_leave_in_specs'),
    ('public.product_oil_specs')
  ) AS landmarks(landmark)
  WHERE pg_catalog.strpos(v_source, landmarks.landmark) = 0;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'product intake approval body has drifted beyond the alias fix (missing: %); re-review this repair',
      v_missing;
  END IF;
END;
$assert_pre_state$;

CREATE OR REPLACE FUNCTION public.product_intake_approve_reviewed_product_before_thumbnail_image(
  p_submission_id uuid,
  p_final_payload jsonb,
  p_spec_operations jsonb,
  p_reviewed_by text,
  p_reviewed_at timestamptz DEFAULT now(),
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  approval_result jsonb;
  approved_product_id uuid;
  operation jsonb;
  legacy_spec_operations jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb)) spec_operation(value)
    WHERE spec_operation.value->>'table' = 'product_application_protocols'
      AND pg_catalog.jsonb_typeof(spec_operation.value->'rows') = 'array'
      AND pg_catalog.jsonb_array_length(spec_operation.value->'rows') > 0
  ) THEN
    RAISE EXCEPTION 'canonical V1/V2 protocol scope is required';
  END IF;

  FOR operation IN
    SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value->>'table' = 'product_application_protocols'
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_to_recordset(operation->'rows') AS candidate(
        category text, role text, guidance_payload jsonb, guidance_payload_v2 jsonb
      )
      WHERE candidate.guidance_payload IS NULL
        OR pg_catalog.jsonb_typeof(candidate.guidance_payload) IS DISTINCT FROM 'object'
        OR candidate.guidance_payload->>'schemaVersion' IS DISTINCT FROM '1'
        OR candidate.guidance_payload#>>'{scope,kind}' IS DISTINCT FROM 'product'
        OR candidate.guidance_payload#>>'{scope,category}' IS DISTINCT FROM candidate.category
        OR candidate.guidance_payload#>>'{scope,productId}' IS DISTINCT FROM '__PRODUCT_ID__'
        OR candidate.guidance_payload_v2 IS NULL
        OR pg_catalog.jsonb_typeof(candidate.guidance_payload_v2) IS DISTINCT FROM 'object'
        OR candidate.guidance_payload_v2->>'schemaVersion' IS DISTINCT FROM '2'
        OR candidate.guidance_payload_v2->>'contractKind' IS DISTINCT FROM 'product_pointer'
        OR candidate.guidance_payload_v2#>>'{scope,kind}' IS DISTINCT FROM 'product'
        OR candidate.guidance_payload_v2#>>'{scope,category}' IS DISTINCT FROM candidate.category
        OR candidate.guidance_payload_v2#>>'{scope,productId}' IS DISTINCT FROM '__PRODUCT_ID__'
        OR candidate.guidance_payload_v2->>'sourceRole' IS DISTINCT FROM candidate.role
        OR candidate.guidance_payload_v2->>'applicationFamily' IS NULL
        OR pg_catalog.btrim(candidate.guidance_payload_v2->>'applicationFamily') = ''
        OR candidate.guidance_payload_v2#>'{runtimeBlockerCode}' IS DISTINCT FROM 'null'::jsonb
    ) THEN
      RAISE EXCEPTION 'canonical V1/V2 protocol scope and application family must match the approved product operation';
    END IF;
  END LOOP;

  SELECT COALESCE(pg_catalog.jsonb_agg(value), '[]'::jsonb)
  INTO legacy_spec_operations
  FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
  WHERE (value->>'table') IS DISTINCT FROM 'product_application_protocols';

  approval_result := public.product_intake_approve_reviewed_product_without_canonical_guidance(
    p_submission_id, p_final_payload, legacy_spec_operations, p_reviewed_by, p_reviewed_at, p_review_notes
  );
  approved_product_id := (approval_result->>'product_id')::uuid;

  FOR operation IN
    SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value->>'table' = 'product_application_protocols'
  LOOP
    INSERT INTO public.product_application_protocols (
      product_id, category, role, cadence, application_stage, application_state,
      placement, contact_time_seconds, rinse_action, reapplication,
      instruction_modifiers, source_label, source_url, source_text,
      guidance_payload, guidance_payload_v2
    )
    SELECT approved_product_id, row_data.category, row_data.role, row_data.cadence,
      row_data.application_stage, row_data.application_state, row_data.placement,
      row_data.contact_time_seconds, row_data.rinse_action, row_data.reapplication,
      COALESCE(row_data.instruction_modifiers, '[]'::jsonb), row_data.source_label,
      row_data.source_url, row_data.source_text,
      pg_catalog.jsonb_set(row_data.guidance_payload, '{scope,productId}', pg_catalog.to_jsonb(approved_product_id::text), false),
      pg_catalog.jsonb_set(row_data.guidance_payload_v2, '{scope,productId}', pg_catalog.to_jsonb(approved_product_id::text), false)
    FROM pg_catalog.jsonb_to_recordset(operation->'rows') AS row_data(
      category text, role text, cadence jsonb, application_stage text,
      application_state text, placement text, contact_time_seconds integer,
      rinse_action text, reapplication text, instruction_modifiers jsonb,
      source_label text, source_url text, source_text text,
      guidance_payload jsonb, guidance_payload_v2 jsonb
    )
    ON CONFLICT (product_id, category, role, application_family) DO UPDATE
      SET cadence = EXCLUDED.cadence,
          application_stage = EXCLUDED.application_stage,
          application_state = EXCLUDED.application_state,
          placement = EXCLUDED.placement,
          contact_time_seconds = EXCLUDED.contact_time_seconds,
          rinse_action = EXCLUDED.rinse_action,
          reapplication = EXCLUDED.reapplication,
          instruction_modifiers = EXCLUDED.instruction_modifiers,
          source_label = EXCLUDED.source_label,
          source_url = EXCLUDED.source_url,
          source_text = EXCLUDED.source_text,
          guidance_payload = EXCLUDED.guidance_payload,
          guidance_payload_v2 = EXCLUDED.guidance_payload_v2,
          updated_at = pg_catalog.now();
  END LOOP;

  FOR operation IN
    SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value->>'table' = 'product_mask_specs'
  LOOP
    UPDATE public.product_mask_specs mask
    SET repair_support_level = row_data.repair_support_level,
        functional_benefits = row_data.functional_benefits,
        updated_at = pg_catalog.now()
    FROM pg_catalog.jsonb_to_recordset(operation->'rows') AS row_data(
      repair_support_level text, functional_benefits text[]
    )
    WHERE mask.product_id = approved_product_id;
  END LOOP;

  FOR operation IN
    SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value->>'table' = 'product_leave_in_specs'
  LOOP
    UPDATE public.product_leave_in_specs leave_in
    SET care_direction = row_data.care_direction,
        repair_support_level = row_data.repair_support_level,
        plan_roles = row_data.plan_roles,
        functional_benefits = row_data.functional_benefits,
        updated_at = pg_catalog.now()
    FROM pg_catalog.jsonb_to_recordset(operation->'rows') AS row_data(
      care_direction text, repair_support_level text, plan_roles text[], functional_benefits text[]
    )
    WHERE leave_in.product_id = approved_product_id;
  END LOOP;

  FOR operation IN
    SELECT value FROM pg_catalog.jsonb_array_elements(COALESCE(p_spec_operations, '[]'::jsonb))
    WHERE value->>'table' = 'product_oil_specs'
  LOOP
    UPDATE public.product_oil_specs oil
    SET weight = row_data.weight,
        role_support = row_data.role_support,
        updated_at = pg_catalog.now()
    FROM pg_catalog.jsonb_to_recordset(operation->'rows') AS row_data(
      weight text, role_support text[]
    )
    WHERE oil.product_id = approved_product_id;
  END LOOP;

  RETURN approval_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.product_intake_approve_reviewed_product_before_thumbnail_image(uuid, jsonb, jsonb, text, timestamptz, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- No function on the LIVE approval chain may still carry the ambiguous alias.
-- `…_before_net_content` (the 20260813085151 body) carries the same pattern but is
-- orphaned: 20260814120000 re-pointed the chain straight at
-- `…_without_canonical_guidance`, so nothing calls it. It is deliberately left
-- alone here rather than repaired blind — reviving it would need its own review.
DO $assert_repaired$
DECLARE
  v_broken text;
BEGIN
  SELECT pg_catalog.string_agg(proc.proname, ', ' ORDER BY proc.proname)
  INTO v_broken
  FROM pg_catalog.pg_proc proc
  JOIN pg_catalog.pg_namespace namespace ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public'
    AND proc.proname IN (
      'product_intake_approve_reviewed_product',
      'product_intake_approve_reviewed_product_before_scanned_identifier',
      'product_intake_approve_reviewed_product_before_thumbnail_image',
      'product_intake_approve_reviewed_product_without_canonical_guidance'
    )
    AND pg_catalog.strpos(proc.prosrc, '''[]''::jsonb)) operation') > 0;

  IF v_broken IS NOT NULL THEN
    RAISE EXCEPTION 'product intake approval chain still has an ambiguous operation alias in: %', v_broken;
  END IF;
END;
$assert_repaired$;

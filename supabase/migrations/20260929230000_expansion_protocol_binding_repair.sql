-- EXPANSION PROTOCOL BINDING REPAIR (found during the Kevin Murphy oil-migration
-- prep, plans/kevin-murphy-oil-migration/plan.md §4, 2026-09-29).
--
-- DEFECT 1 — unbound guidanceKey. Product Intake stamps protocol rows before the
-- product exists, so every V1 payload carries the placeholder `__PRODUCT_ID__`
-- (expansion-apply.ts → expansion-apply-templates.ts builds
-- `product-<category>-${productId}…`). The approval boundary
-- `…_before_thumbnail_image` binds only `scope.productId` to the approved uuid,
-- never `guidanceKey`. Production read 2026-09-29: 127 protocol rows on 89
-- products — every protocol row of every `catalog_expansion` product (pilot-1,
-- wave-2, wave-3, shampoo-14) — carry `product-…-__PRODUCT_ID__-…`. No other lane
-- is affected, no V2 payload carries the placeholder, and no saved routine,
-- proposal, draft or prepared artifact has copied one.
--
-- The executor readback `scan_expansion_assert_applied_bundle` compares the
-- stored V1 payload to the batch payload with ONLY `scope.productId` bound, so it
-- is the one real dependant of the placeholder: fixing the boundary alone would
-- make every new batch fail its readback, and repairing the data alone would make
-- every applied batch fail replay. Both call sites therefore switch to ONE shared
-- binder, `product_intake_bind_guidance_payload`, which binds `scope.productId`
-- exactly as before and additionally substitutes the placeholder inside a string
-- `guidanceKey`.
--
-- Replay note: a replay still compares the reviewed payload, so an item whose
-- Oil rows were later realigned to a newer day-type ruling (#516, and
-- 20260929231000) no longer replays clean. That is intentional drift reporting.
--
-- GUARD — after the repair a CHECK constraint makes a placeholder in either
-- stored payload impossible, whatever the writer.
--
-- Function replacement follows 20260902110000's byte-exact pre-state guard: each
-- body is accepted only if its raw sha256 is a reviewed pre-state or this
-- migration's own post-state. Production's live readback body is the repo body
-- with its full-line `--` comments removed (applied that way out of band), so both
-- forms are pinned. The new bodies carry no full-line comments, so a
-- comment-stripping apply cannot change their digests. Digests are re-derived from
-- the migration files by tests/expansion-protocol-binding-repair-postgres.test.ts.
--
-- OPERATOR NOTE — before applying to production re-read
--   SELECT proname, encode(sha256(convert_to(prosrc, 'UTF8')), 'hex')
--   FROM pg_proc WHERE proname IN (
--     'product_intake_approve_reviewed_product_before_thumbnail_image',
--     'scan_expansion_assert_applied_bundle');
-- (2026-09-29: be434f6b… and 71758a3d…).

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('expansion_protocol_binding_repair_20260929'));

CREATE OR REPLACE FUNCTION public.product_intake_bind_guidance_payload(
  p_payload jsonb,
  p_product_id uuid
) RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $function$
  SELECT CASE
    WHEN pg_catalog.jsonb_typeof(p_payload->'guidanceKey') = 'string' THEN
      pg_catalog.jsonb_set(
        pg_catalog.jsonb_set(
          p_payload, '{scope,productId}', pg_catalog.to_jsonb(p_product_id::text), false
        ),
        '{guidanceKey}',
        pg_catalog.to_jsonb(
          pg_catalog.replace(p_payload->>'guidanceKey', '__PRODUCT_ID__', p_product_id::text)
        ),
        false
      )
    ELSE
      pg_catalog.jsonb_set(
        p_payload, '{scope,productId}', pg_catalog.to_jsonb(p_product_id::text), false
      )
  END
$function$;

REVOKE ALL ON FUNCTION public.product_intake_bind_guidance_payload(jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

DO $assert_pre_state$
DECLARE
  -- RAW sha256 of prosrc, no normalization.
  --   boundary (a) 20260902110000 body = live production body (7243 bytes)
  c_boundary_pre constant text :=
    'be434f6bba1c2655511d059edf5c317787708d2e366304e00e70d2d4c544960b';
  --   boundary (b) the body this migration installs
  c_boundary_post constant text :=
    'acac8a147af4eeb50d33921fe724aa64ff5a44df37d3c194f6c2ecba14b34c60';
  --   readback (a) 20260902160000 body verbatim (8479 bytes)
  c_readback_repo constant text :=
    '2ba0e8b72e82eb289e583b7cdc57422738c5b330c88b14bcf810c9c9a0d470d8';
  --   readback (b) the live production form: (a) minus full-line comments (7610 bytes)
  c_readback_prod constant text :=
    '71758a3d77600790e6ff24fd53782b27b681b30d831dc10403bb2bc85a741194';
  --   readback (c) the body this migration installs
  c_readback_post constant text :=
    'c9705bab2cd805e5744722410529f890d28774fd58bc13dc8f4a078a1dcdf628';
  v_digest text;
BEGIN
  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(proc.prosrc, 'UTF8')), 'hex')
  INTO v_digest
  FROM pg_catalog.pg_proc proc
  JOIN pg_catalog.pg_namespace namespace ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public'
    AND proc.proname = 'product_intake_approve_reviewed_product_before_thumbnail_image';
  IF v_digest IS NULL OR v_digest NOT IN (c_boundary_pre, c_boundary_post) THEN
    RAISE EXCEPTION
      'approval boundary body matches no reviewed pre-state (raw sha256: %); re-review this repair',
      v_digest;
  END IF;

  SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(proc.prosrc, 'UTF8')), 'hex')
  INTO v_digest
  FROM pg_catalog.pg_proc proc
  JOIN pg_catalog.pg_namespace namespace ON namespace.oid = proc.pronamespace
  WHERE namespace.nspname = 'public'
    AND proc.proname = 'scan_expansion_assert_applied_bundle';
  IF v_digest IS NULL OR v_digest NOT IN (c_readback_repo, c_readback_prod, c_readback_post) THEN
    RAISE EXCEPTION
      'scan expansion readback body matches no reviewed pre-state (raw sha256: %); re-review this repair',
      v_digest;
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
      public.product_intake_bind_guidance_payload(row_data.guidance_payload, approved_product_id),
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

CREATE OR REPLACE FUNCTION public.scan_expansion_assert_applied_bundle(
  p_item jsonb,
  p_product_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_product public.products%ROWTYPE;
  v_expected_gtins text[];
  v_actual_gtins text[];
  v_protocol jsonb;
  v_expected_roles text[];
  v_actual_roles text[];
  v_expected_protocols integer;
  v_actual_protocols integer;
  v_actual_evidence integer;
BEGIN
  SELECT product.* INTO v_product FROM public.products product WHERE product.id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'scan expansion readback: product % is gone', p_product_id;
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT public.product_identifier_canonical_gtin14(
      identifier.value->>'type', identifier.value->>'value'
    )
    FROM pg_catalog.jsonb_array_elements(COALESCE(p_item->'identifiers', '[]'::jsonb)) identifier(value)
    ORDER BY 1
  ) INTO v_expected_gtins;

  IF p_item->>'kind' = 'existing_product_update' THEN
    IF v_product.name IS DISTINCT FROM COALESCE(
         p_item->'rename'->>'to', p_item->'expected_product'->>'name'
       )
       OR v_product.is_chaarlie_recommended IS DISTINCT FROM
          (p_item->'expected_product'->>'is_chaarlie_recommended')::boolean
       OR v_product.lifecycle_status IS DISTINCT FROM p_item->'expected_product'->>'lifecycle_status' THEN
      RAISE EXCEPTION 'scan expansion readback: existing-product state drift on %', p_product_id;
    END IF;
    IF EXISTS (
      SELECT pg_catalog.unnest(v_expected_gtins)
      EXCEPT
      SELECT identifier.canonical_gtin14 FROM public.product_identifiers identifier
      WHERE identifier.product_id = p_product_id
    ) THEN
      RAISE EXCEPTION 'scan expansion readback: missing identifier on %', p_product_id;
    END IF;
    RETURN;
  END IF;

  IF v_product.origin IS DISTINCT FROM 'curated'
     OR v_product.is_active IS DISTINCT FROM true
     OR v_product.lifecycle_status IS DISTINCT FROM 'active'
     OR v_product.is_chaarlie_recommended IS DISTINCT FROM false
     OR v_product.category_key IS DISTINCT FROM p_item->>'category_key'
     OR v_product.image_url IS DISTINCT FROM p_item#>>'{final_payload,product,image_url}'
     OR v_product.suitable_thicknesses IS DISTINCT FROM ARRAY(
          SELECT pg_catalog.jsonb_array_elements_text(p_item#>'{product_updates,suitable_thicknesses}')
        )
     OR v_product.suitable_concerns IS DISTINCT FROM ARRAY(
          SELECT pg_catalog.jsonb_array_elements_text(
            COALESCE(p_item#>'{product_updates,suitable_concerns}', '[]'::jsonb)
          )
        )
     OR (
       COALESCE(p_item#>>'{product_updates,description}', '') <> ''
       AND v_product.description IS DISTINCT FROM p_item#>>'{product_updates,description}'
     ) THEN
    RAISE EXCEPTION 'scan expansion readback: product lifecycle/presentation drift on %', p_product_id;
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT identifier.canonical_gtin14
    FROM public.product_identifiers identifier
    WHERE identifier.product_id = p_product_id AND identifier.canonical_gtin14 IS NOT NULL
    ORDER BY 1
  ) INTO v_actual_gtins;
  IF v_expected_gtins IS DISTINCT FROM v_actual_gtins THEN
    RAISE EXCEPTION 'scan expansion readback: identifier set drift on %', p_product_id;
  END IF;

  PERFORM public.scan_expansion_assert_fact_rows(
    p_product_id,
    (SELECT COALESCE(pg_catalog.jsonb_agg(operation.value), '[]'::jsonb)
     FROM pg_catalog.jsonb_array_elements(p_item->'spec_operations') operation(value)
     WHERE operation.value->>'table' <> 'product_application_protocols')
  );

  SELECT ARRAY(
    SELECT DISTINCT protocol.value->>'role'
    FROM pg_catalog.jsonb_array_elements(p_item->'spec_operations') operation(value),
         pg_catalog.jsonb_array_elements(operation.value->'rows') protocol(value)
    WHERE operation.value->>'table' = 'product_application_protocols'
    ORDER BY 1
  ) INTO v_expected_roles;
  SELECT ARRAY(
    SELECT DISTINCT stored.role FROM public.product_application_protocols stored
    WHERE stored.product_id = p_product_id ORDER BY 1
  ) INTO v_actual_roles;
  IF v_expected_roles IS DISTINCT FROM v_actual_roles THEN
    RAISE EXCEPTION 'scan expansion readback: protocol role set drift on %', p_product_id;
  END IF;

  FOR v_protocol IN
    SELECT protocol.value
    FROM pg_catalog.jsonb_array_elements(p_item->'spec_operations') operation(value),
         pg_catalog.jsonb_array_elements(operation.value->'rows') protocol(value)
    WHERE operation.value->>'table' = 'product_application_protocols'
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.product_application_protocols stored
      WHERE stored.product_id = p_product_id
        AND stored.category = v_protocol->>'category'
        AND stored.role = v_protocol->>'role'
        AND stored.source_label IS NOT DISTINCT FROM v_protocol->>'source_label'
        AND stored.source_url IS NOT DISTINCT FROM v_protocol->>'source_url'
        AND stored.source_text IS NOT DISTINCT FROM v_protocol->>'source_text'
        AND stored.contact_time_seconds IS NOT DISTINCT FROM
            NULLIF(v_protocol->>'contact_time_seconds', '')::integer
        AND stored.rinse_action IS NOT DISTINCT FROM v_protocol->>'rinse_action'
        AND stored.guidance_payload = public.product_intake_bind_guidance_payload(
              v_protocol->'guidance_payload', p_product_id
            )
        AND stored.guidance_payload_v2 = pg_catalog.jsonb_set(
              v_protocol->'guidance_payload_v2', '{scope,productId}',
              pg_catalog.to_jsonb(p_product_id::text), false
            )
    ) THEN
      RAISE EXCEPTION 'scan expansion readback: protocol drift on %:%',
        p_product_id, v_protocol->>'role';
    END IF;
  END LOOP;

  SELECT pg_catalog.count(*)::integer INTO v_expected_protocols
  FROM pg_catalog.jsonb_array_elements(p_item->'spec_operations') operation(value),
       pg_catalog.jsonb_array_elements(operation.value->'rows') protocol(value)
  WHERE operation.value->>'table' = 'product_application_protocols';
  SELECT pg_catalog.count(*)::integer INTO v_actual_protocols
  FROM public.product_application_protocols stored
  WHERE stored.product_id = p_product_id;
  IF v_actual_protocols IS DISTINCT FROM v_expected_protocols THEN
    RAISE EXCEPTION
      'scan expansion readback: protocol row count drift on % (reviewed %, stored %)',
      p_product_id, v_expected_protocols, v_actual_protocols;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_array_elements(p_item->'evidence') evidence(value)
    WHERE NOT EXISTS (
      SELECT 1 FROM public.personal_plan_catalog_fact_evidence stored
      WHERE stored.product_id = p_product_id
        AND stored.fact_key = evidence.value->>'fact_key'
        AND stored.source_url = evidence.value->>'source_url'
        AND stored.fact_value = evidence.value->'fact_value'
        AND stored.source_label = evidence.value->>'source_label'
        AND stored.source_text = evidence.value->>'source_text'
        AND stored.source_type = evidence.value->>'source_type'
        AND stored.checked_at = (evidence.value->>'checked_at')::date
    )
  ) THEN
    RAISE EXCEPTION 'scan expansion readback: fact evidence drift on %', p_product_id;
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_actual_evidence
  FROM public.personal_plan_catalog_fact_evidence stored
  WHERE stored.product_id = p_product_id;
  IF v_actual_evidence IS DISTINCT FROM pg_catalog.jsonb_array_length(p_item->'evidence') THEN
    RAISE EXCEPTION
      'scan expansion readback: fact evidence row count drift on % (reviewed %, stored %)',
      p_product_id, pg_catalog.jsonb_array_length(p_item->'evidence'), v_actual_evidence;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.scan_expansion_assert_applied_bundle(jsonb, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Defect 1 data repair. Generic, so it is a no-op on a fresh replay: every row
-- still carrying the placeholder must belong to a product published through the
-- `catalog_expansion` lane, otherwise an unknown writer produced it and the
-- repair refuses to guess.
DO $bind_guidance_keys$
DECLARE
  v_foreign integer;
  v_left integer;
BEGIN
  SELECT pg_catalog.count(*)::integer INTO v_foreign
  FROM public.product_application_protocols protocol
  WHERE pg_catalog.strpos(protocol.guidance_payload::text, '__PRODUCT_ID__') > 0
    AND (
      protocol.guidance_payload#>>'{scope,productId}' IS DISTINCT FROM protocol.product_id::text
      OR pg_catalog.jsonb_typeof(protocol.guidance_payload->'guidanceKey') IS DISTINCT FROM 'string'
      OR pg_catalog.strpos(protocol.guidance_payload->>'guidanceKey', '__PRODUCT_ID__') = 0
      OR NOT EXISTS (
        SELECT 1 FROM public.product_submissions submission
        WHERE submission.approved_product_id = protocol.product_id
          AND submission.source = 'catalog_expansion'
      )
    );
  IF v_foreign > 0 THEN
    RAISE EXCEPTION
      'placeholder guidance rows outside the reviewed expansion shape: %; re-review this repair',
      v_foreign;
  END IF;

  UPDATE public.product_application_protocols protocol
  SET guidance_payload = public.product_intake_bind_guidance_payload(
        protocol.guidance_payload, protocol.product_id
      )
  WHERE pg_catalog.strpos(protocol.guidance_payload::text, '__PRODUCT_ID__') > 0;

  SELECT pg_catalog.count(*)::integer INTO v_left
  FROM public.product_application_protocols protocol
  WHERE pg_catalog.strpos(protocol.guidance_payload::text, '__PRODUCT_ID__') > 0
     OR pg_catalog.strpos(COALESCE(protocol.guidance_payload_v2::text, ''), '__PRODUCT_ID__') > 0;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'guidance placeholder repair left % rows unbound', v_left;
  END IF;
END;
$bind_guidance_keys$;

-- The repair queued the deferred curated-publication gate; run it now so the
-- repaired rows are re-validated here and ALTER TABLE has no pending events.
SET CONSTRAINTS ALL IMMEDIATE;

ALTER TABLE public.product_application_protocols
  DROP CONSTRAINT IF EXISTS product_application_protocols_bound_product_id_check;
ALTER TABLE public.product_application_protocols
  ADD CONSTRAINT product_application_protocols_bound_product_id_check CHECK (
    pg_catalog.strpos(COALESCE(guidance_payload::text, ''), '__PRODUCT_ID__') = 0
    AND pg_catalog.strpos(COALESCE(guidance_payload_v2::text, ''), '__PRODUCT_ID__') = 0
  );

COMMIT;

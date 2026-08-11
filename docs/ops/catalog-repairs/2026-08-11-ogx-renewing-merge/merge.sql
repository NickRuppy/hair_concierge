-- NOT APPLIED. This is a service-role/Postgres operator, never an app RPC.
-- Before execution, replace the NULL capture fields in before.json using the
-- reviewed output of preflight.sql and copy only the privacy-safe values into
-- the constants below. Any unset value aborts before DML.
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

DO $repair$
DECLARE
  v_canonical constant uuid := '2ecd3c9d-90f6-45a3-a72c-daefed50be10';
  v_duplicate constant uuid := 'f41badc9-16e3-41c1-ab6c-23541fffade0';
  v_name constant text := 'OGX Renewing + Argan Oil of Morocco Shampoo';
  -- Populated only from a freshly reviewed, privacy-safe before.json.
  v_snapshot_fingerprint constant text := NULL;
  v_before_image constant jsonb := NULL;
  v_duplicate_identifier_fingerprint constant text := NULL;
  v_user_product_id_hashes constant jsonb := NULL;
  v_submission_id_hashes constant jsonb := NULL;
  v_submission_links constant jsonb := NULL;
  v_draft_product_id_paths constant jsonb := NULL;
  v_all_duplicate_uuid_string_paths constant jsonb := NULL;
  v_affected_plan_source_states constant jsonb := NULL;
  v_canonical_row public.products%ROWTYPE;
  v_duplicate_row public.products%ROWTYPE;
  v_count integer;
  v_expected_draft_count integer;
  v_linked_submission_owner_count integer;
  v_fingerprint text;
  v_current_snapshot jsonb;
BEGIN
  IF v_snapshot_fingerprint IS NULL OR v_before_image IS NULL
     OR v_duplicate_identifier_fingerprint IS NULL
     OR v_user_product_id_hashes IS NULL OR v_submission_id_hashes IS NULL
     OR v_submission_links IS NULL OR v_draft_product_id_paths IS NULL
     OR v_all_duplicate_uuid_string_paths IS NULL OR v_affected_plan_source_states IS NULL THEN
    RAISE EXCEPTION 'OGX repair requires a freshly reviewed before.json capture' USING ERRCODE = '22000';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('2026-08-11-ogx-renewing-merge', 0));
  SELECT * INTO v_canonical_row FROM public.products WHERE id = v_canonical FOR UPDATE;
  SELECT * INTO v_duplicate_row FROM public.products WHERE id = v_duplicate FOR UPDATE;
  IF NOT FOUND OR v_canonical_row.id IS NULL OR v_duplicate_row.id IS NULL THEN
    RAISE EXCEPTION 'OGX repair product rows are missing' USING ERRCODE = '22000';
  END IF;
  IF v_canonical_row.category_key <> 'shampoo' OR v_canonical_row.origin <> 'curated'
     OR v_canonical_row.is_active IS DISTINCT FROM true OR v_canonical_row.lifecycle_status <> 'active'
     OR v_canonical_row.is_chaarlie_recommended IS DISTINCT FROM true
     OR v_duplicate_row.category_key <> 'shampoo' OR v_duplicate_row.origin <> 'user_submitted'
     OR v_duplicate_row.is_active IS DISTINCT FROM true OR v_duplicate_row.lifecycle_status <> 'active'
     OR v_duplicate_row.is_chaarlie_recommended IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'OGX repair product authority drifted' USING ERRCODE = '22000';
  END IF;

  SELECT jsonb_build_object(
    'canonicalProduct', jsonb_build_object('id', v_canonical_row.id, 'name', v_canonical_row.name, 'categoryKey', v_canonical_row.category_key, 'origin', v_canonical_row.origin, 'isActive', v_canonical_row.is_active, 'lifecycleStatus', v_canonical_row.lifecycle_status, 'isChaarlieRecommended', v_canonical_row.is_chaarlie_recommended),
    'duplicateProduct', jsonb_build_object('id', v_duplicate_row.id, 'name', v_duplicate_row.name, 'categoryKey', v_duplicate_row.category_key, 'origin', v_duplicate_row.origin, 'isActive', v_duplicate_row.is_active, 'lifecycleStatus', v_duplicate_row.lifecycle_status, 'isChaarlieRecommended', v_duplicate_row.is_chaarlie_recommended),
    'duplicateIdentifierFingerprint', (SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('type', i.identifier_type, 'value', i.normalized_identifier_value, 'source', i.source) ORDER BY i.identifier_type, i.normalized_identifier_value)::text, '[]'), 'utf8')), 'hex') FROM public.product_identifiers i WHERE i.product_id = v_duplicate),
    'duplicateIdentifiers', (SELECT coalesce(jsonb_agg(jsonb_build_object('type', i.identifier_type, 'value', i.identifier_value, 'source', i.source) ORDER BY i.identifier_type, i.normalized_identifier_value), '[]'::jsonb) FROM public.product_identifiers i WHERE i.product_id = v_duplicate),
    'duplicateShampooSpecs', (SELECT coalesce(jsonb_agg(jsonb_build_object('thickness', s.thickness, 'shampooBucket', s.shampoo_bucket, 'scalpRoute', s.scalp_route, 'cleansingIntensity', s.cleansing_intensity) ORDER BY s.thickness, s.shampoo_bucket), '[]'::jsonb) FROM public.product_shampoo_specs s WHERE s.product_id = v_duplicate),
    'matchedUserProductIdHashes', (SELECT coalesce(jsonb_agg(encode(sha256(convert_to(up.id::text, 'utf8')), 'hex') ORDER BY up.id), '[]'::jsonb) FROM public.user_products up WHERE up.catalog_product_id = v_duplicate AND up.identity_status = 'matched' AND up.ownership_status = 'owned'),
    'matchedUserProductRevisionFingerprint', (SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('idHash', encode(sha256(convert_to(up.id::text, 'utf8')), 'hex'), 'updatedAt', up.updated_at) ORDER BY up.id)::text, '[]'), 'utf8')), 'hex') FROM public.user_products up WHERE up.catalog_product_id = v_duplicate AND up.identity_status = 'matched' AND up.ownership_status = 'owned'),
    'approvedSubmissionIdHashes', (SELECT coalesce(jsonb_agg(encode(sha256(convert_to(s.id::text, 'utf8')), 'hex') ORDER BY s.id), '[]'::jsonb) FROM public.product_submissions s WHERE s.approved_product_id = v_duplicate AND s.status IN ('approved', 'matched_existing')),
    'approvedSubmissionLinks', (SELECT coalesce(jsonb_agg(jsonb_build_object('submissionIdHash', encode(sha256(convert_to(s.id::text, 'utf8')), 'hex'), 'userProductIdHash', CASE WHEN s.user_product_id IS NULL THEN NULL ELSE encode(sha256(convert_to(s.user_product_id::text, 'utf8')), 'hex') END) ORDER BY s.id), '[]'::jsonb) FROM public.product_submissions s WHERE s.approved_product_id = v_duplicate AND s.status IN ('approved', 'matched_existing')),
    'activeDraftIdHashes', (SELECT coalesce(jsonb_agg(encode(sha256(convert_to(d.id::text, 'utf8')), 'hex') ORDER BY d.id), '[]'::jsonb) FROM public.personal_plan_product_drafts d WHERE d.status = 'active' AND d.payload::text LIKE '%' || v_duplicate::text || '%'),
    'activeDraftRevisionFingerprint', (SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('idHash', encode(sha256(convert_to(d.id::text, 'utf8')), 'hex'), 'revision', d.revision) ORDER BY d.id)::text, '[]'), 'utf8')), 'hex') FROM public.personal_plan_product_drafts d WHERE d.status = 'active' AND d.payload::text LIKE '%' || v_duplicate::text || '%'),
    'draftProductIdPaths', (SELECT coalesce(jsonb_agg(jsonb_build_object('idHash', encode(sha256(convert_to(d.id::text, 'utf8')), 'hex'), 'revision', d.revision, 'paths', refs.paths) ORDER BY d.id), '[]'::jsonb) FROM public.personal_plan_product_drafts d CROSS JOIN LATERAL (SELECT jsonb_agg(jsonb_build_array('products', (item.ordinality - 1)::text, 'identity', 'productId') ORDER BY item.ordinality) AS paths FROM jsonb_array_elements(coalesce(d.payload->'products', '[]'::jsonb)) WITH ORDINALITY AS item(value, ordinality) WHERE item.value #>> '{identity,productId}' = v_duplicate::text) refs WHERE d.status = 'active' AND jsonb_array_length(coalesce(refs.paths, '[]'::jsonb)) > 0),
    'allDuplicateUuidStringPaths', (WITH RECURSIVE walk(draft_id, path, value) AS (SELECT d.id, ARRAY[]::text[], d.payload FROM public.personal_plan_product_drafts d WHERE d.status = 'active' AND d.payload::text LIKE '%' || v_duplicate::text || '%' UNION ALL SELECT walk.draft_id, walk.path || child.path_part, child.value FROM walk CROSS JOIN LATERAL (SELECT object_item.key AS path_part, object_item.value FROM jsonb_each(CASE WHEN jsonb_typeof(walk.value) = 'object' THEN walk.value ELSE '{}'::jsonb END) object_item UNION ALL SELECT (array_item.ordinality - 1)::text AS path_part, array_item.value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(walk.value) = 'array' THEN walk.value ELSE '[]'::jsonb END) WITH ORDINALITY array_item(value, ordinality)) child) SELECT coalesce(jsonb_agg(jsonb_build_object('idHash', encode(sha256(convert_to(walk.draft_id::text, 'utf8')), 'hex'), 'path', to_jsonb(walk.path)) ORDER BY walk.draft_id, walk.path), '[]'::jsonb) FROM walk WHERE jsonb_typeof(walk.value) = 'string' AND trim(both '"' FROM walk.value::text) = v_duplicate::text),
    'affectedPlanSourceStates', (SELECT coalesce(jsonb_agg(jsonb_build_object('planIdHash', encode(sha256(convert_to(plan.id::text, 'utf8')), 'hex'), 'sourceRevision', plan.source_revision, 'expectedSourceRevisionDelta', owner_links.link_count, 'userProductIdHashes', owner_links.user_product_id_hashes) ORDER BY plan.id), '[]'::jsonb) FROM (SELECT up.user_id, count(*)::integer AS link_count, jsonb_agg(encode(sha256(convert_to(up.id::text, 'utf8')), 'hex') ORDER BY up.id) AS user_product_id_hashes FROM public.user_products up WHERE up.catalog_product_id = v_duplicate AND up.identity_status = 'matched' AND up.ownership_status = 'owned' GROUP BY up.user_id) owner_links JOIN public.personal_plans plan ON plan.user_id = owner_links.user_id)
  ) INTO v_current_snapshot;
  IF v_current_snapshot IS DISTINCT FROM v_before_image
     OR encode(sha256(convert_to(v_current_snapshot::text, 'utf8')), 'hex') <> v_snapshot_fingerprint
     OR v_current_snapshot->'matchedUserProductIdHashes' IS DISTINCT FROM v_user_product_id_hashes
     OR v_current_snapshot->'approvedSubmissionIdHashes' IS DISTINCT FROM v_submission_id_hashes
     OR v_current_snapshot->'approvedSubmissionLinks' IS DISTINCT FROM v_submission_links
     OR v_current_snapshot->'draftProductIdPaths' IS DISTINCT FROM v_draft_product_id_paths
     OR v_current_snapshot->'allDuplicateUuidStringPaths' IS DISTINCT FROM v_all_duplicate_uuid_string_paths
     OR v_current_snapshot->'affectedPlanSourceStates' IS DISTINCT FROM v_affected_plan_source_states THEN
    RAISE EXCEPTION 'OGX repair full privacy-safe before-image drifted' USING ERRCODE = '22000';
  END IF;
  IF (SELECT coalesce(jsonb_agg(entry->>'idHash' ORDER BY entry->>'idHash'), '[]'::jsonb) FROM jsonb_array_elements(v_current_snapshot->'draftProductIdPaths') entry)
       IS DISTINCT FROM
     (SELECT coalesce(jsonb_agg(value ORDER BY value), '[]'::jsonb) FROM jsonb_array_elements_text(v_current_snapshot->'activeDraftIdHashes') value) THEN
    RAISE EXCEPTION 'OGX repair contains an unenumerated draft product-id reference' USING ERRCODE = '22000';
  END IF;
  IF (SELECT coalesce(jsonb_agg(jsonb_build_object('idHash', draft_ref->>'idHash', 'path', path.value) ORDER BY draft_ref->>'idHash', path.value), '[]'::jsonb) FROM jsonb_array_elements(v_draft_product_id_paths) draft_ref CROSS JOIN LATERAL jsonb_array_elements(draft_ref->'paths') path(value))
       IS DISTINCT FROM v_all_duplicate_uuid_string_paths THEN
    RAISE EXCEPTION 'OGX repair duplicate UUID occurs outside products[*].identity.productId' USING ERRCODE = '22000';
  END IF;
  SELECT count(*) INTO v_linked_submission_owner_count
  FROM jsonb_array_elements(v_submission_links) link
  WHERE link->>'userProductIdHash' IS NOT NULL;
  IF jsonb_array_length(v_submission_links) <> 1 OR v_linked_submission_owner_count > 1
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_submission_links) link
       WHERE link->>'userProductIdHash' IS NOT NULL
         AND link->>'userProductIdHash' NOT IN (SELECT jsonb_array_elements_text(v_user_product_id_hashes))
     ) THEN
    RAISE EXCEPTION 'OGX repair submission/user-product linkage drifted' USING ERRCODE = '22000';
  END IF;

  PERFORM 1 FROM public.product_identifiers WHERE product_id = v_duplicate FOR UPDATE;
  SELECT count(*) INTO v_count FROM public.product_identifiers WHERE product_id = v_duplicate;
  IF v_count <> 4 THEN RAISE EXCEPTION 'OGX repair duplicate identifier count drifted: %', v_count USING ERRCODE = '22000'; END IF;
  SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('type', identifier_type, 'value', normalized_identifier_value, 'source', source) ORDER BY identifier_type, normalized_identifier_value)::text, '[]'), 'utf8')), 'hex')
    INTO v_fingerprint FROM public.product_identifiers WHERE product_id = v_duplicate;
  IF v_fingerprint <> v_duplicate_identifier_fingerprint THEN RAISE EXCEPTION 'OGX repair identifier fingerprint drifted' USING ERRCODE = '22000'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.product_identifiers duplicate_identifier
    JOIN public.product_identifiers canonical_identifier
      ON canonical_identifier.product_id = v_canonical
     AND canonical_identifier.identifier_type = duplicate_identifier.identifier_type
     AND canonical_identifier.normalized_identifier_value = duplicate_identifier.normalized_identifier_value
    WHERE duplicate_identifier.product_id = v_duplicate
  ) THEN RAISE EXCEPTION 'OGX repair identifier collision with canonical row' USING ERRCODE = '22000'; END IF;

  PERFORM 1 FROM public.product_shampoo_specs WHERE product_id = v_canonical FOR UPDATE;
  SELECT count(*) INTO v_count FROM public.product_shampoo_specs WHERE product_id = v_canonical;
  IF v_count <> 1 THEN RAISE EXCEPTION 'OGX repair canonical spec count drifted: %', v_count USING ERRCODE = '22000'; END IF;
  PERFORM 1 FROM public.product_shampoo_specs WHERE product_id = v_duplicate FOR UPDATE;
  SELECT count(*) INTO v_count FROM public.product_shampoo_specs WHERE product_id = v_duplicate;
  IF v_count <> 3 THEN RAISE EXCEPTION 'OGX repair duplicate spec count drifted: %', v_count USING ERRCODE = '22000'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.product_shampoo_specs WHERE product_id = v_canonical AND thickness = 'normal' AND shampoo_bucket = 'normal' AND scalp_route = 'balanced' AND cleansing_intensity = 'gentle') THEN
    RAISE EXCEPTION 'OGX repair canonical shampoo authority drifted' USING ERRCODE = '22000';
  END IF;
  IF EXISTS (SELECT 1 FROM public.product_shampoo_specs WHERE product_id = v_duplicate AND (shampoo_bucket <> 'normal' OR cleansing_intensity <> 'regular' OR thickness NOT IN ('fine', 'normal', 'coarse'))) THEN
    RAISE EXCEPTION 'OGX repair duplicate shampoo spec drifted' USING ERRCODE = '22000';
  END IF;

  PERFORM 1 FROM public.user_products WHERE catalog_product_id = v_duplicate AND identity_status = 'matched' AND ownership_status = 'owned' FOR UPDATE;
  SELECT count(*) INTO v_count FROM public.user_products WHERE catalog_product_id = v_duplicate AND identity_status = 'matched' AND ownership_status = 'owned';
  IF v_count <> 2 THEN RAISE EXCEPTION 'OGX repair user-product reference count drifted: %', v_count USING ERRCODE = '22000'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_products d JOIN public.user_products c ON c.user_id = d.user_id AND c.category = d.category AND c.catalog_product_id = v_canonical AND c.identity_status = 'matched' AND c.ownership_status = 'owned' WHERE d.catalog_product_id = v_duplicate AND d.identity_status = 'matched' AND d.ownership_status = 'owned') THEN
    RAISE EXCEPTION 'OGX repair would collide with an existing canonical owner link' USING ERRCODE = '22000';
  END IF;

  PERFORM 1 FROM public.product_submissions WHERE approved_product_id = v_duplicate AND status IN ('approved', 'matched_existing') FOR UPDATE;
  SELECT count(*) INTO v_count FROM public.product_submissions WHERE approved_product_id = v_duplicate AND status IN ('approved', 'matched_existing');
  IF v_count <> 1 THEN RAISE EXCEPTION 'OGX repair approved-submission reference count drifted: %', v_count USING ERRCODE = '22000'; END IF;
  PERFORM 1 FROM public.personal_plan_product_drafts d
    WHERE d.status = 'active'
      AND encode(sha256(convert_to(d.id::text, 'utf8')), 'hex') IN (
        SELECT entry->>'idHash' FROM jsonb_array_elements(v_draft_product_id_paths) entry
      )
    FOR UPDATE;
  SELECT count(*) INTO v_expected_draft_count FROM jsonb_array_elements(v_draft_product_id_paths);
  IF v_expected_draft_count = 0 THEN RAISE EXCEPTION 'OGX repair fresh snapshot contains no active draft references' USING ERRCODE = '22000'; END IF;
  IF EXISTS (SELECT 1 FROM public.product_relationships WHERE source_product_id IN (v_canonical, v_duplicate) OR target_product_id IN (v_canonical, v_duplicate))
     OR EXISTS (SELECT 1 FROM public.user_product_usage WHERE product_id = v_duplicate)
     OR EXISTS (SELECT 1 FROM public.product_image_assets WHERE product_id = v_duplicate)
     OR EXISTS (SELECT 1 FROM public.product_application_protocols WHERE product_id = v_duplicate)
     OR EXISTS (SELECT 1 FROM public.catalog_enrichment_applied_items WHERE product_id = v_duplicate) THEN
    RAISE EXCEPTION 'OGX repair unenumerated product dependency exists' USING ERRCODE = '22000';
  END IF;

  UPDATE public.products SET name = v_name, updated_at = now() WHERE id = v_canonical;
  UPDATE public.product_identifiers SET product_id = v_canonical, updated_at = now() WHERE product_id = v_duplicate;
  UPDATE public.user_products SET catalog_product_id = v_canonical
   WHERE catalog_product_id = v_duplicate AND identity_status = 'matched' AND ownership_status = 'owned'
     AND encode(sha256(convert_to(id::text, 'utf8')), 'hex') IN (SELECT jsonb_array_elements_text(v_user_product_id_hashes))
     AND encode(sha256(convert_to(id::text, 'utf8')), 'hex') NOT IN (
       SELECT link->>'userProductIdHash' FROM jsonb_array_elements(v_submission_links) link
       WHERE link->>'userProductIdHash' IS NOT NULL
     );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 2 - v_linked_submission_owner_count THEN RAISE EXCEPTION 'OGX repair direct owner-link set drifted: %', v_count USING ERRCODE = '22000'; END IF;
  UPDATE public.product_submissions SET approved_product_id = v_canonical
   WHERE approved_product_id = v_duplicate AND status IN ('approved', 'matched_existing')
     AND encode(sha256(convert_to(id::text, 'utf8')), 'hex') IN (SELECT jsonb_array_elements_text(v_submission_id_hashes));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 1 THEN RAISE EXCEPTION 'OGX repair submission set drifted: %', v_count USING ERRCODE = '22000'; END IF;
  WITH RECURSIVE targets AS (
    SELECT d.id, (path.value->>1)::integer AS product_index,
      row_number() OVER (PARTITION BY d.id ORDER BY (path.value->>1)::integer) AS sequence
    FROM public.personal_plan_product_drafts d
    JOIN jsonb_array_elements(v_draft_product_id_paths) draft_ref
      ON encode(sha256(convert_to(d.id::text, 'utf8')), 'hex') = draft_ref->>'idHash'
    CROSS JOIN LATERAL jsonb_array_elements(draft_ref->'paths') path(value)
    WHERE d.status = 'active'
      AND d.payload #>> ARRAY['products', (path.value->>1), 'identity', 'productId'] = v_duplicate::text
  ), patched AS (
    SELECT d.id, 0::bigint AS sequence, d.payload
      FROM public.personal_plan_product_drafts d
      JOIN (SELECT DISTINCT id FROM targets) target ON target.id = d.id
    UNION ALL
    SELECT patched.id, targets.sequence,
      jsonb_set(patched.payload, ARRAY['products', targets.product_index::text, 'identity', 'productId'], to_jsonb(v_canonical::text), false)
      FROM patched JOIN targets ON targets.id = patched.id AND targets.sequence = patched.sequence + 1
  ), final_payload AS (
    SELECT DISTINCT ON (id) id, payload FROM patched ORDER BY id, sequence DESC
  )
  UPDATE public.personal_plan_product_drafts draft
     SET payload = final_payload.payload, revision = draft.revision + 1, updated_at = now()
    FROM final_payload WHERE draft.id = final_payload.id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> v_expected_draft_count THEN RAISE EXCEPTION 'OGX repair draft path set drifted: %', v_count USING ERRCODE = '22000'; END IF;
  DELETE FROM public.product_shampoo_specs WHERE product_id = v_duplicate;
  DELETE FROM public.product_shampoo_specs WHERE product_id = v_canonical;
  INSERT INTO public.product_shampoo_specs(product_id, thickness, shampoo_bucket, scalp_route, cleansing_intensity) VALUES (v_canonical, 'normal', 'normal', 'balanced', 'gentle');
  INSERT INTO public.product_relationships(source_product_id, target_product_id, relationship_type) VALUES (v_duplicate, v_canonical, 'replaced_by');
  UPDATE public.products SET is_active = false, lifecycle_status = 'discontinued', is_chaarlie_recommended = false, updated_at = now() WHERE id = v_duplicate;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(v_affected_plan_source_states) AS state("planIdHash" text, "sourceRevision" bigint, "expectedSourceRevisionDelta" integer, "userProductIdHashes" jsonb)
    JOIN public.personal_plans plan ON encode(sha256(convert_to(plan.id::text, 'utf8')), 'hex') = state."planIdHash"
    WHERE plan.source_revision <> state."sourceRevision" + state."expectedSourceRevisionDelta"
  ) OR EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(v_affected_plan_source_states) AS state("planIdHash" text, "sourceRevision" bigint, "expectedSourceRevisionDelta" integer, "userProductIdHashes" jsonb)
    JOIN public.personal_plans plan ON encode(sha256(convert_to(plan.id::text, 'utf8')), 'hex') = state."planIdHash"
    CROSS JOIN LATERAL jsonb_array_elements_text(state."userProductIdHashes") user_product_hash
    LEFT JOIN public.personal_plan_routine_source_change_outbox outbox
      ON outbox.personal_plan_id = plan.id
     AND outbox.source_kind = 'user_product'
     AND encode(sha256(convert_to(outbox.source_key, 'utf8')), 'hex') = user_product_hash
    WHERE outbox.id IS NULL
       OR outbox.observed_revision <= state."sourceRevision"
       OR outbox.observed_revision > state."sourceRevision" + state."expectedSourceRevisionDelta"
  ) THEN
    RAISE EXCEPTION 'OGX repair source-revision or outbox delta failed' USING ERRCODE = '22000';
  END IF;

  IF (SELECT count(*) FROM public.products WHERE id IN (v_canonical, v_duplicate)) <> 2
     OR NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_canonical AND name = v_name AND is_active AND lifecycle_status = 'active' AND is_chaarlie_recommended)
     OR NOT EXISTS (SELECT 1 FROM public.products WHERE id = v_duplicate AND NOT is_active AND lifecycle_status = 'discontinued' AND NOT is_chaarlie_recommended)
     OR (SELECT count(*) FROM public.product_identifiers WHERE product_id = v_canonical) < 4
     OR EXISTS (SELECT 1 FROM public.product_identifiers WHERE product_id = v_duplicate)
     OR EXISTS (SELECT 1 FROM public.user_products WHERE catalog_product_id = v_duplicate AND identity_status = 'matched' AND ownership_status = 'owned')
     OR EXISTS (SELECT 1 FROM public.product_submissions WHERE approved_product_id = v_duplicate AND status IN ('approved', 'matched_existing'))
     OR EXISTS (
       SELECT 1 FROM public.personal_plan_product_drafts d
       JOIN jsonb_array_elements(v_draft_product_id_paths) draft_ref
         ON encode(sha256(convert_to(d.id::text, 'utf8')), 'hex') = draft_ref->>'idHash'
       CROSS JOIN LATERAL jsonb_array_elements(draft_ref->'paths') path(value)
       WHERE d.payload #>> ARRAY['products', (path.value->>1), 'identity', 'productId'] = v_duplicate::text
     )
     OR (SELECT count(*) FROM public.product_shampoo_specs WHERE product_id = v_canonical) <> 1
     OR EXISTS (SELECT 1 FROM public.product_shampoo_specs WHERE product_id = v_duplicate)
     OR NOT EXISTS (SELECT 1 FROM public.product_relationships WHERE source_product_id = v_duplicate AND target_product_id = v_canonical AND relationship_type = 'replaced_by') THEN
    RAISE EXCEPTION 'OGX repair postcondition failed' USING ERRCODE = '22000';
  END IF;
END
$repair$;

COMMIT;

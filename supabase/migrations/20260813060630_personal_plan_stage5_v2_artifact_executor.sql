-- Atomically installs the reviewed Stage-5 V2 family templates and
-- product-role pointers. The V1 rows remain untouched for code rollback.

CREATE OR REPLACE FUNCTION public.personal_plan_stage5_v2_canonical_json_v1(p_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $canonical$
  SELECT CASE pg_catalog.jsonb_typeof(p_value)
    WHEN 'object' THEN coalesce((
      SELECT '{' || pg_catalog.string_agg(
        pg_catalog.to_jsonb(entry.key)::text || ':' ||
        public.personal_plan_stage5_v2_canonical_json_v1(entry.value),
        ',' ORDER BY entry.key COLLATE "C"
      ) || '}'
      FROM pg_catalog.jsonb_each(p_value) AS entry(key, value)
    ), '{}')
    WHEN 'array' THEN coalesce((
      SELECT '[' || pg_catalog.string_agg(
        public.personal_plan_stage5_v2_canonical_json_v1(entry.value),
        ',' ORDER BY entry.ordinality
      ) || ']'
      FROM pg_catalog.jsonb_array_elements(p_value) WITH ORDINALITY AS entry(value, ordinality)
    ), '[]')
    ELSE p_value::text
  END
$canonical$;

REVOKE ALL ON FUNCTION public.personal_plan_stage5_v2_canonical_json_v1(jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.apply_personal_plan_stage5_v2_artifact_v1(
  p_artifact_json text,
  p_expected_artifact_fingerprint text,
  p_reviewed_by text
)
RETURNS TABLE(family_rows integer, product_rows integer, ledger_rows integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_batch_id constant text := 'personal-plan-stage5-v2-2026-08-12';
  v_artifact jsonb;
  v_computed_fingerprint text;
  v_family jsonb;
  v_item jsonb;
  v_family_key text;
  v_family_hash text;
  v_family_id uuid;
  v_product_id uuid;
  v_category text;
  v_role text;
  v_product_key text;
  v_content_fingerprint text;
  v_source_fingerprint text;
  v_expected_family_count integer;
  v_expected_product_count integer;
  v_expected_distinct_product_count integer;
  v_existing_family public.application_guidance_protocols%ROWTYPE;
  v_existing_product public.product_application_protocols%ROWTYPE;
  v_existing_ledger public.catalog_enrichment_applied_items%ROWTYPE;
  v_existing_ledger_count integer;
BEGIN
  IF p_reviewed_by <> 'nick' THEN
    RAISE EXCEPTION 'Stage 5 V2 reviewer must be nick';
  END IF;
  IF p_expected_artifact_fingerprint !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Stage 5 V2 fingerprint must be lowercase sha256';
  END IF;

  v_computed_fingerprint := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(p_artifact_json, 'UTF8'), 'sha256'),
    'hex'
  );
  IF v_computed_fingerprint <> p_expected_artifact_fingerprint THEN
    RAISE EXCEPTION 'Stage 5 V2 artifact fingerprint mismatch';
  END IF;
  BEGIN
    v_artifact := p_artifact_json::jsonb;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Stage 5 V2 artifact is invalid JSON';
  END;

  IF v_artifact->>'schema_version' IS DISTINCT FROM 'personal-plan-stage5-application-pointer-backfill-v2'
     OR v_artifact->>'source_kind' IS DISTINCT FROM 'reviewed_stage5_v1_artifacts'
     OR coalesce(v_artifact->>'snapshot_date', '') !~ '^2026-08-12$'
     OR pg_catalog.jsonb_typeof(v_artifact->'family_templates') IS DISTINCT FROM 'array'
     OR pg_catalog.jsonb_typeof(v_artifact->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Stage 5 V2 artifact header is invalid';
  END IF;

  v_expected_family_count := pg_catalog.jsonb_array_length(v_artifact->'family_templates');
  v_expected_product_count := pg_catalog.jsonb_array_length(v_artifact->'items');
  SELECT pg_catalog.count(DISTINCT item->>'product_id')::integer
  INTO v_expected_distinct_product_count
  FROM pg_catalog.jsonb_array_elements(v_artifact->'items') entries(item);
  IF v_expected_family_count < 1 OR v_expected_product_count < 1
     OR (v_artifact#>>'{observed_counts,family_templates}')::integer IS DISTINCT FROM v_expected_family_count
     OR (v_artifact#>>'{observed_counts,rows}')::integer IS DISTINCT FROM v_expected_product_count
     OR (v_artifact#>>'{observed_counts,products}')::integer IS DISTINCT FROM v_expected_distinct_product_count
     OR (v_artifact#>>'{observed_counts,exact_workflows}')::integer IS DISTINCT FROM (
       SELECT pg_catalog.count(*)::integer
       FROM pg_catalog.jsonb_array_elements(v_artifact->'items') entries(item)
       WHERE item->'exact_workflow_id' <> 'null'::jsonb
     )
     OR (v_artifact#>>'{observed_counts,composable_rows}')::integer IS DISTINCT FROM (
       SELECT pg_catalog.count(*)::integer
       FROM pg_catalog.jsonb_array_elements(v_artifact->'items') entries(item)
       WHERE item#>'{guidance_payload_v2,runtimeBlockerCode}' = 'null'::jsonb
     )
     OR (v_artifact#>>'{observed_counts,blocked_rows}')::integer IS DISTINCT FROM (
       SELECT pg_catalog.count(*)::integer
       FROM pg_catalog.jsonb_array_elements(v_artifact->'items') entries(item)
       WHERE item#>'{guidance_payload_v2,runtimeBlockerCode}' <> 'null'::jsonb
     )
     OR v_artifact#>'{observed_counts,by_category}' IS DISTINCT FROM (
       SELECT pg_catalog.jsonb_object_agg(counts.category, counts.row_count ORDER BY counts.category)
       FROM (
         SELECT
           item#>>'{guidance_payload_v2,scope,category}' AS category,
           pg_catalog.count(*)::integer AS row_count
         FROM pg_catalog.jsonb_array_elements(v_artifact->'items') entries(item)
         GROUP BY item#>>'{guidance_payload_v2,scope,category}'
       ) counts
     ) THEN
    RAISE EXCEPTION 'Stage 5 V2 artifact counts are invalid';
  END IF;
  IF v_expected_family_count <> (
       SELECT pg_catalog.count(DISTINCT family->>'guidanceKey')
       FROM pg_catalog.jsonb_array_elements(v_artifact->'family_templates') entries(family)
     ) THEN
    RAISE EXCEPTION 'Stage 5 V2 artifact contains duplicate family keys';
  END IF;
  IF v_expected_product_count <> (
       SELECT pg_catalog.count(DISTINCT (
         item->>'product_id',
         item#>>'{guidance_payload_v2,scope,category}',
         item->>'source_role'
       ))
       FROM pg_catalog.jsonb_array_elements(v_artifact->'items') entries(item)
     ) THEN
    RAISE EXCEPTION 'Stage 5 V2 artifact contains duplicate product roles';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-stage5-v2:' || v_batch_id, 0)
  );
  SELECT pg_catalog.count(*)::integer
  INTO v_existing_ledger_count
  FROM public.catalog_enrichment_applied_items applied
  WHERE applied.batch_id = v_batch_id;
  IF v_existing_ledger_count NOT IN (0, v_expected_product_count) THEN
    RAISE EXCEPTION 'Stage 5 V2 ledger is partial';
  END IF;

  FOR v_family IN
    SELECT family
    FROM pg_catalog.jsonb_array_elements(v_artifact->'family_templates') entries(family)
    ORDER BY family->>'guidanceKey'
  LOOP
    v_family_key := v_family->>'guidanceKey';
    IF (v_family->>'schemaVersion')::integer IS DISTINCT FROM 2
       OR v_family->>'contractKind' IS DISTINCT FROM 'family_template'
       OR v_family#>>'{scope,kind}' IS DISTINCT FROM 'application_family'
       OR coalesce(v_family#>>'{scope,category}', '') = ''
       OR coalesce(v_family->>'role', '') = ''
       OR coalesce(v_family->>'applicationFamily', '') = ''
       OR coalesce(v_family_key, '') !~ '\.v2$'
       OR pg_catalog.jsonb_typeof(v_family->'steps') IS DISTINCT FROM 'array'
       OR pg_catalog.jsonb_array_length(v_family->'steps') < 1 THEN
      RAISE EXCEPTION 'Stage 5 V2 family template is invalid: %', coalesce(v_family_key, '<missing>');
    END IF;

    v_family_hash := pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(v_family_key, 'UTF8'), 'sha256'),
      'hex'
    );
    v_family_id := (
      pg_catalog.substr(v_family_hash, 1, 8) || '-' ||
      pg_catalog.substr(v_family_hash, 9, 4) || '-5' ||
      pg_catalog.substr(v_family_hash, 14, 3) || '-8' ||
      pg_catalog.substr(v_family_hash, 18, 3) || '-' ||
      pg_catalog.substr(v_family_hash, 21, 12)
    )::uuid;

    SELECT protocol.* INTO v_existing_family
    FROM public.application_guidance_protocols protocol
    WHERE protocol.guidance_key = v_family_key
      AND protocol.locale = 'de'
      AND protocol.status = 'active';
    IF FOUND THEN
      IF v_existing_family.protocol_version <> 2
         OR v_existing_family.id <> v_family_id
         OR v_existing_family.scope_kind <> 'application_family'
         OR v_existing_family.category_key <> v_family#>>'{scope,category}'
         OR v_existing_family.role_key IS DISTINCT FROM v_family->>'role'
         OR v_existing_family.product_id IS NOT NULL
         OR v_existing_family.application_family <> v_family->>'applicationFamily'
         OR v_existing_family.contract_version <> 2
         OR v_existing_family.payload IS DISTINCT FROM v_family
         OR v_existing_family.status <> 'active'
         OR v_existing_family.verified_at IS NULL THEN
        RAISE EXCEPTION 'Stage 5 V2 family authority conflicts: %', v_family_key;
      END IF;
    ELSE
      INSERT INTO public.application_guidance_protocols (
        id, guidance_key, protocol_version, locale, scope_kind, category_key,
        role_key, product_id, application_family, contract_version, payload,
        status, verified_at
      ) VALUES (
        v_family_id, v_family_key, 2, 'de', 'application_family',
        v_family#>>'{scope,category}', v_family->>'role', NULL,
        v_family->>'applicationFamily', 2, v_family, 'active',
        (v_artifact->>'snapshot_date')::date::timestamptz
      );
    END IF;
  END LOOP;

  FOR v_item IN
    SELECT item
    FROM pg_catalog.jsonb_array_elements(v_artifact->'items') entries(item)
    ORDER BY item->>'product_id', item->>'source_role'
  LOOP
    BEGIN
      v_product_id := (v_item->>'product_id')::uuid;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'Stage 5 V2 product ID is invalid';
    END;
    v_category := v_item#>>'{guidance_payload_v2,scope,category}';
    v_role := v_item->>'source_role';
    v_product_key := 'v2:' || v_product_id::text || ':' || v_role;

    IF (v_item#>>'{guidance_payload_v2,schemaVersion}')::integer IS DISTINCT FROM 2
       OR v_item#>>'{guidance_payload_v2,contractKind}' IS DISTINCT FROM 'product_pointer'
       OR v_item#>>'{guidance_payload_v2,scope,kind}' IS DISTINCT FROM 'product'
       OR v_item#>>'{guidance_payload_v2,scope,productId}' IS DISTINCT FROM v_product_id::text
       OR coalesce(v_category, '') = ''
       OR coalesce(v_role, '') = ''
       OR v_item#>>'{guidance_payload_v2,sourceRole}' IS DISTINCT FROM v_role THEN
      RAISE EXCEPTION 'Stage 5 V2 product pointer is invalid: %', v_product_key;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.products product
      WHERE product.id = v_product_id
        AND product.category_key = v_category
        AND product.origin = 'curated'
        AND product.is_active = true
        AND product.lifecycle_status = 'active'
    ) THEN
      RAISE EXCEPTION 'Stage 5 V2 product is missing, inactive, or recategorized: %', v_product_key;
    END IF;

    SELECT protocol.* INTO v_existing_product
    FROM public.product_application_protocols protocol
    WHERE protocol.product_id = v_product_id
      AND protocol.category = v_category
      AND protocol.role = v_role;
    IF NOT FOUND OR v_existing_product.guidance_payload IS NULL THEN
      RAISE EXCEPTION 'Stage 5 V2 source protocol is missing: %', v_product_key;
    END IF;
    v_source_fingerprint := pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          public.personal_plan_stage5_v2_canonical_json_v1(
            pg_catalog.jsonb_build_object(
              'role', v_role,
              'payload', v_existing_product.guidance_payload
            )
          ),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
    IF v_source_fingerprint IS DISTINCT FROM v_item->>'source_fingerprint' THEN
      RAISE EXCEPTION 'Stage 5 V2 source protocol fingerprint diverged: %', v_product_key;
    END IF;
    IF v_existing_product.guidance_payload_v2 IS NULL THEN
      UPDATE public.product_application_protocols protocol
      SET guidance_payload_v2 = v_item->'guidance_payload_v2',
          updated_at = pg_catalog.clock_timestamp()
      WHERE protocol.product_id = v_product_id
        AND protocol.category = v_category
        AND protocol.role = v_role
        AND protocol.guidance_payload_v2 IS NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Stage 5 V2 source protocol changed during apply: %', v_product_key;
      END IF;
    ELSIF v_existing_product.guidance_payload_v2 IS DISTINCT FROM v_item->'guidance_payload_v2' THEN
      RAISE EXCEPTION 'Stage 5 V2 product authority conflicts: %', v_product_key;
    END IF;

    v_content_fingerprint := pg_catalog.encode(
      extensions.digest(pg_catalog.convert_to(v_item::text, 'UTF8'), 'sha256'),
      'hex'
    );
    SELECT applied.* INTO v_existing_ledger
    FROM public.catalog_enrichment_applied_items applied
    WHERE applied.batch_id = v_batch_id
      AND applied.product_key = v_product_key;
    IF FOUND THEN
      IF v_existing_ledger.batch_fingerprint <> v_computed_fingerprint
         OR v_existing_ledger.content_fingerprint <> v_content_fingerprint
         OR v_existing_ledger.product_id <> v_product_id
         OR v_existing_ledger.reviewed_by <> 'nick' THEN
        RAISE EXCEPTION 'Stage 5 V2 ledger conflicts with retry: %', v_product_key;
      END IF;
    ELSE
      INSERT INTO public.catalog_enrichment_applied_items (
        batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
      ) VALUES (
        v_batch_id, v_product_key, v_computed_fingerprint, v_content_fingerprint,
        v_product_id, 'nick'
      );
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT
    (
      SELECT pg_catalog.count(*)::integer
      FROM public.application_guidance_protocols protocol
      WHERE protocol.contract_version = 2
        AND protocol.status = 'active'
        AND protocol.guidance_key IN (
          SELECT family->>'guidanceKey'
          FROM pg_catalog.jsonb_array_elements(v_artifact->'family_templates') entries(family)
        )
    ),
    (
      SELECT pg_catalog.count(*)::integer
      FROM public.product_application_protocols protocol
      WHERE protocol.guidance_payload_v2 IS NOT NULL
        AND (protocol.product_id, protocol.category, protocol.role) IN (
          SELECT
            (item->>'product_id')::uuid,
            item#>>'{guidance_payload_v2,scope,category}',
            item->>'source_role'
          FROM pg_catalog.jsonb_array_elements(v_artifact->'items') entries(item)
        )
    ),
    (
      SELECT pg_catalog.count(*)::integer
      FROM public.catalog_enrichment_applied_items applied
      WHERE applied.batch_id = v_batch_id
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.apply_personal_plan_stage5_v2_artifact_v1(text, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_personal_plan_stage5_v2_artifact_v1(text, text, text)
  TO service_role;

-- READ ONLY. Run with a service-role/Postgres connection and save the single
-- JSON result for human comparison with before.json. Do not copy user IDs,
-- emails, or payload text into Git. UUIDs are hashed before they leave SQL.
WITH constants AS (
  SELECT
    '2ecd3c9d-90f6-45a3-a72c-daefed50be10'::uuid AS canonical_id,
    'f41badc9-16e3-41c1-ab6c-23541fffade0'::uuid AS duplicate_id
), snapshot AS (
  SELECT jsonb_build_object(
    'canonicalProduct', (
      SELECT jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'categoryKey', p.category_key,
        'origin', p.origin,
        'isActive', p.is_active,
        'lifecycleStatus', p.lifecycle_status,
        'isChaarlieRecommended', p.is_chaarlie_recommended
      ) FROM public.products p, constants c WHERE p.id = c.canonical_id
    ),
    'duplicateProduct', (
      SELECT jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'categoryKey', p.category_key,
        'origin', p.origin,
        'isActive', p.is_active,
        'lifecycleStatus', p.lifecycle_status,
        'isChaarlieRecommended', p.is_chaarlie_recommended
      ) FROM public.products p, constants c WHERE p.id = c.duplicate_id
    ),
    'duplicateIdentifierFingerprint', (
      SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object(
        'type', i.identifier_type, 'value', i.normalized_identifier_value,
        'source', i.source
      ) ORDER BY i.identifier_type, i.normalized_identifier_value)::text, '[]'), 'utf8')), 'hex')
      FROM public.product_identifiers i, constants c WHERE i.product_id = c.duplicate_id
    ),
    'duplicateIdentifiers', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'type', i.identifier_type, 'value', i.identifier_value, 'source', i.source
      ) ORDER BY i.identifier_type, i.normalized_identifier_value), '[]'::jsonb)
      FROM public.product_identifiers i, constants c WHERE i.product_id = c.duplicate_id
    ),
    'duplicateShampooSpecs', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'thickness', s.thickness, 'shampooBucket', s.shampoo_bucket,
        'scalpRoute', s.scalp_route, 'cleansingIntensity', s.cleansing_intensity
      ) ORDER BY s.thickness, s.shampoo_bucket), '[]'::jsonb)
      FROM public.product_shampoo_specs s, constants c WHERE s.product_id = c.duplicate_id
    ),
    'matchedUserProductIdHashes', (
      SELECT coalesce(jsonb_agg(encode(sha256(convert_to(up.id::text, 'utf8')), 'hex') ORDER BY up.id), '[]'::jsonb)
      FROM public.user_products up, constants c
      WHERE up.catalog_product_id = c.duplicate_id AND up.identity_status = 'matched' AND up.ownership_status = 'owned'
    ),
    'matchedUserProductRevisionFingerprint', (
      SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object(
        'idHash', encode(sha256(convert_to(up.id::text, 'utf8')), 'hex'), 'updatedAt', up.updated_at
      ) ORDER BY up.id)::text, '[]'), 'utf8')), 'hex')
      FROM public.user_products up, constants c
      WHERE up.catalog_product_id = c.duplicate_id AND up.identity_status = 'matched' AND up.ownership_status = 'owned'
    ),
    'approvedSubmissionIdHashes', (
      SELECT coalesce(jsonb_agg(encode(sha256(convert_to(s.id::text, 'utf8')), 'hex') ORDER BY s.id), '[]'::jsonb)
      FROM public.product_submissions s, constants c
      WHERE s.approved_product_id = c.duplicate_id AND s.status IN ('approved', 'matched_existing')
    ),
    'approvedSubmissionLinks', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'submissionIdHash', encode(sha256(convert_to(s.id::text, 'utf8')), 'hex'),
        'userProductIdHash', CASE WHEN s.user_product_id IS NULL THEN NULL ELSE encode(sha256(convert_to(s.user_product_id::text, 'utf8')), 'hex') END
      ) ORDER BY s.id), '[]'::jsonb)
      FROM public.product_submissions s, constants c
      WHERE s.approved_product_id = c.duplicate_id AND s.status IN ('approved', 'matched_existing')
    ),
    'activeDraftIdHashes', (
      SELECT coalesce(jsonb_agg(encode(sha256(convert_to(d.id::text, 'utf8')), 'hex') ORDER BY d.id), '[]'::jsonb)
      FROM public.personal_plan_product_drafts d, constants c
      WHERE d.status = 'active' AND d.payload::text LIKE '%' || c.duplicate_id::text || '%'
    ),
    'draftProductIdPaths', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'idHash', encode(sha256(convert_to(d.id::text, 'utf8')), 'hex'),
        'revision', d.revision,
        'paths', refs.paths
      ) ORDER BY d.id), '[]'::jsonb)
      FROM public.personal_plan_product_drafts d
      CROSS JOIN constants c
      CROSS JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_array('products', (item.ordinality - 1)::text, 'identity', 'productId') ORDER BY item.ordinality) AS paths
        FROM jsonb_array_elements(coalesce(d.payload->'products', '[]'::jsonb)) WITH ORDINALITY AS item(value, ordinality)
        WHERE item.value #>> '{identity,productId}' = c.duplicate_id::text
      ) refs
      WHERE d.status = 'active' AND jsonb_array_length(coalesce(refs.paths, '[]'::jsonb)) > 0
    ),
    'allDuplicateUuidStringPaths', (
      WITH RECURSIVE walk(draft_id, path, value) AS (
        SELECT d.id, ARRAY[]::text[], d.payload
        FROM public.personal_plan_product_drafts d, constants c
        WHERE d.status = 'active' AND d.payload::text LIKE '%' || c.duplicate_id::text || '%'
        UNION ALL
        SELECT walk.draft_id, walk.path || object_item.key, object_item.value
        FROM walk CROSS JOIN LATERAL jsonb_each(walk.value) object_item
        WHERE jsonb_typeof(walk.value) = 'object'
        UNION ALL
        SELECT walk.draft_id, walk.path || (array_item.ordinality - 1)::text, array_item.value
        FROM walk CROSS JOIN LATERAL jsonb_array_elements(walk.value) WITH ORDINALITY array_item(value, ordinality)
        WHERE jsonb_typeof(walk.value) = 'array'
      )
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'idHash', encode(sha256(convert_to(walk.draft_id::text, 'utf8')), 'hex'),
        'path', to_jsonb(walk.path)
      ) ORDER BY walk.draft_id, walk.path), '[]'::jsonb)
      FROM walk, constants c
      WHERE jsonb_typeof(walk.value) = 'string'
        AND trim(both '"' FROM walk.value::text) = c.duplicate_id::text
    ),
    'activeDraftRevisionFingerprint', (
      SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object(
        'idHash', encode(sha256(convert_to(d.id::text, 'utf8')), 'hex'), 'revision', d.revision
      ) ORDER BY d.id)::text, '[]'), 'utf8')), 'hex')
      FROM public.personal_plan_product_drafts d, constants c
      WHERE d.status = 'active' AND d.payload::text LIKE '%' || c.duplicate_id::text || '%'
    ),
    'affectedPlanSourceStates', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'planIdHash', encode(sha256(convert_to(plan.id::text, 'utf8')), 'hex'),
        'sourceRevision', plan.source_revision,
        'expectedSourceRevisionDelta', owner_links.link_count,
        'userProductIdHashes', owner_links.user_product_id_hashes
      ) ORDER BY plan.id), '[]'::jsonb)
      FROM (
        SELECT up.user_id,
          count(*)::integer AS link_count,
          jsonb_agg(encode(sha256(convert_to(up.id::text, 'utf8')), 'hex') ORDER BY up.id) AS user_product_id_hashes
        FROM public.user_products up, constants c
        WHERE up.catalog_product_id = c.duplicate_id
          AND up.identity_status = 'matched' AND up.ownership_status = 'owned'
        GROUP BY up.user_id
      ) owner_links
      JOIN public.personal_plans plan ON plan.user_id = owner_links.user_id
    )
  ) AS body
)
SELECT jsonb_build_object(
  'captureStatus', 'ready_for_review',
  'snapshotFingerprint', encode(sha256(convert_to(body::text, 'utf8')), 'hex'),
  'body', body
) AS privacy_safe_before_image
FROM snapshot;

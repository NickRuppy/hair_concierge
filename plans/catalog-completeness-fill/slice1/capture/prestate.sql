-- READ-ONLY prestate capture for Slice 1 (run as one statement, TimeZone UTC so
-- to_jsonb(timestamptz) prints the form the migration guards compare against).
-- products.embedding is never captured (vector, not restorable byte-exactly).
SET TimeZone = 'UTC';
WITH ids(id) AS (
  SELECT unnest(ARRAY[
    -- Group A (Redken 2b7db7e3 is context only: no write, Stage-3 sanity fixture)
    '9b664b11-fd11-47e3-9b7e-76e34736b43e','9f94c225-61ec-455d-b303-f39e885e222a',
    'e6896862-523b-42b3-967d-41cbd16acf64','35a372b6-c7ef-45cb-be0b-99cef476f247',
    'e781ca9e-886d-40a1-bfe1-48177cfbf381','45f4fe15-c439-476d-8a86-3b2aac5053bd',
    '5dc2fae3-a0ca-4e6c-9c30-02dd192772f0','4e99706a-2232-4ee6-ba1b-9ca1029a7364',
    '2b7db7e3-2058-4178-8a03-7d05f4a1d447',
    -- Group B (K18 38dace91: cadence copy; Epres f8a63590: net content, Group E)
    '38dace91-0fba-49ee-a93f-ac36e488fe4b','f8a63590-9d80-454a-8008-e2a56321e64c',
    '04a83f16-e610-4883-b44d-038d3a343787','2490911e-1c8c-413b-924c-0604f3f922e0',
    'e5fd7ff9-f7d7-44d5-a600-f44bdec939a8','2c809d0d-fbce-435a-bbde-aa4270aaf48d',
    '9e5da870-1ab8-40f3-a74c-7088cbb31b2f',
    -- Group C
    '21a94166-3813-4c0f-8912-508fb8f704f1','6b01025d-9e72-4514-b42e-bbb6065fbe1c',
    'c574ee6f-ad22-45c0-b936-57b847d93433',
    -- Group D
    'b761256d-c0d2-4413-9fa5-8ab950ef69bf','f8a8fd56-aeb0-4096-8d9d-5af484e3889f',
    '88c230c5-1020-4648-a10e-c2a1e8c87e0e','4f67cb6d-4b28-490b-9817-e8fc8e91b010',
    '62ff4f08-3ff2-49f3-9e93-e6fd0f395a4d','5f4f1300-bc15-4ce0-9ed8-035feb606bde',
    '931892fb-cc29-4e50-b402-6aae0a494389','7fb31d10-ff21-410b-9dc2-2d1ad34b9130',
    'ba326dab-99d8-4b82-a1c5-de9aee2578a4','ea88a333-b11c-45c3-bbda-c51f912ee56f',
    '694c4568-9235-4893-ab54-96a75b3c4f27','e5cfad78-ea22-49a5-911a-cb1f3109fa1c',
    -- Group D: Neqi Smooth Strength Rosemary Oil (oil -> scalp_care, F03/F04)
    '010cf825-4892-4f78-bf20-26ad72122c60',
    -- Group E
    '55727898-2a5e-4f01-ace1-bd91521d98ab','c6e80f39-20ba-401e-b041-6ee7c89a5996'
  ]::uuid[])
)
SELECT jsonb_build_object(
  'captured_at', to_jsonb(now()),
  'products', (SELECT jsonb_agg(to_jsonb(t) - 'embedding' ORDER BY t.id) FROM public.products t WHERE t.id IN (SELECT id FROM ids)),
  'product_leave_in_specs', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id), '[]') FROM public.product_leave_in_specs t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_leave_in_fit_specs', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id), '[]') FROM public.product_leave_in_fit_specs t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_leave_in_eligibility', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id, t.thickness, t.need_bucket, t.styling_context), '[]') FROM public.product_leave_in_eligibility t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_application_protocols', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id, t.id), '[]') FROM public.product_application_protocols t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_identifiers', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id, t.id), '[]') FROM public.product_identifiers t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_mask_specs', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id), '[]') FROM public.product_mask_specs t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_oil_specs', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id), '[]') FROM public.product_oil_specs t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_oil_eligibility', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id, t.thickness, t.oil_subtype), '[]') FROM public.product_oil_eligibility t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_shampoo_specs', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id, t.thickness), '[]') FROM public.product_shampoo_specs t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_conditioner_specs', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id, t.thickness), '[]') FROM public.product_conditioner_specs t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_conditioner_rerank_specs', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id), '[]') FROM public.product_conditioner_rerank_specs t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_bondbuilder_specs', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id), '[]') FROM public.product_bondbuilder_specs t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_scalp_care_specs', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id), '[]') FROM public.product_scalp_care_specs t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_thickness_eligibility', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id, t.category_key, t.thickness), '[]') FROM public.product_thickness_eligibility t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_concern_eligibility', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id, t.category_key, t.concern_key), '[]') FROM public.product_concern_eligibility t WHERE t.product_id IN (SELECT id FROM ids)),
  'product_relationships', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id), '[]') FROM public.product_relationships t WHERE t.source_product_id IN (SELECT id FROM ids) OR t.target_product_id IN (SELECT id FROM ids)),
  'personal_plan_product_search_dispositions', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.product_id), '[]') FROM public.personal_plan_product_search_dispositions t WHERE t.product_id IN (SELECT id FROM ids)),
  -- F01 (Codex review): the shared rinse-off scalp template the migration retires
  -- (version 2) and replaces (version 3). Every row of the key, any status.
  'application_guidance_protocols', (SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.protocol_version, t.id), '[]') FROM public.application_guidance_protocols t WHERE t.guidance_key = 'scalp.rinse-off.v2'),
  -- Context only (never written): every product protocol on the rinse-off scalp family,
  -- so the rehearsal composes their guidance through the DB-backed repository.
  'rinse_off_scalp_care_pointers', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'product_id', p.product_id, 'role', p.role, 'category', p.category, 'brand', pr.brand, 'product_name', pr.name, 'guidance_payload_v2', p.guidance_payload_v2) ORDER BY p.product_id, p.id), '[]') FROM public.product_application_protocols p JOIN public.products pr ON pr.id = p.product_id WHERE p.application_family = 'rinse_off_scalp_care'),
  -- Evidence: keys only (3 MB of existing provenance is never touched).
  'personal_plan_catalog_fact_evidence_keys', (SELECT coalesce(jsonb_agg(jsonb_build_array(t.product_id, t.fact_key, t.source_url, t.batch_id) ORDER BY t.product_id, t.fact_key, t.source_url), '[]') FROM public.personal_plan_catalog_fact_evidence t WHERE t.product_id IN (SELECT id FROM ids)),
  'catalog_enrichment_applied_items_for_batch', (SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]') FROM public.catalog_enrichment_applied_items t WHERE t.batch_id LIKE 'S5R-06-%' OR t.batch_id LIKE 'S5-24-%'),
  'gtin_owners', (SELECT coalesce(jsonb_agg(jsonb_build_array(t.canonical_gtin14, t.product_id, t.id) ORDER BY t.canonical_gtin14), '[]') FROM public.product_identifiers t WHERE t.canonical_gtin14 IN ('00018084067994','04070765027518','08700216939508','03600524135805','08700216939140')),
  'references', (SELECT jsonb_object_agg(ids.id, jsonb_build_object(
     'user_products', (SELECT count(*) FROM public.user_products WHERE catalog_product_id = ids.id),
     'user_product_usage', (SELECT count(*) FROM public.user_product_usage WHERE product_id = ids.id),
     'product_submissions_approved', (SELECT count(*) FROM public.product_submissions WHERE approved_product_id = ids.id),
     'personal_plan_product_drafts', (SELECT count(*) FROM public.personal_plan_product_drafts WHERE payload::text LIKE '%' || ids.id || '%'),
     'personal_plan_portfolio_versions', (SELECT count(*) FROM public.personal_plan_portfolio_versions WHERE snapshot::text LIKE '%' || ids.id || '%'),
     'personal_plan_routine_versions', (SELECT count(*) FROM public.personal_plan_routine_versions WHERE payload::text LIKE '%' || ids.id || '%'),
     'personal_plan_routine_proposals', (SELECT count(*) FROM public.personal_plan_routine_proposals WHERE delta::text LIKE '%' || ids.id || '%'),
     'personal_plan_refinement_drafts', (SELECT count(*) FROM public.personal_plan_refinement_drafts d WHERE to_jsonb(d)::text LIKE '%' || ids.id || '%')))
   FROM ids WHERE ids.id IN ('21a94166-3813-4c0f-8912-508fb8f704f1','c574ee6f-ad22-45c0-b936-57b847d93433','010cf825-4892-4f78-bf20-26ad72122c60')),
  -- F04: member reference rows the Neqi recategorisation must move with it. Only the
  -- columns the guards and the rehearsal need; no user id, names, images or payloads.
  'link_rows', jsonb_build_object(
    'product_submissions', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', s.id, 'category', s.category, 'status', s.status, 'source', s.source,
        'approved_product_id', s.approved_product_id, 'previous_product_id', s.previous_product_id,
        'user_product_usage_id', s.user_product_usage_id, 'user_product_id', s.user_product_id,
        'intake_method', s.intake_method, 'frequency_range', s.frequency_range,
        'has_front_image_path', s.front_image_path IS NOT NULL, 'has_barcode_image_path', s.barcode_image_path IS NOT NULL,
        'created_at', s.created_at, 'updated_at', s.updated_at) ORDER BY s.id), '[]')
      FROM public.product_submissions s
      WHERE s.approved_product_id = '010cf825-4892-4f78-bf20-26ad72122c60' OR s.previous_product_id = '010cf825-4892-4f78-bf20-26ad72122c60'),
    'user_product_usage', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', u.id, 'category', u.category, 'product_id', u.product_id,
        'product_submission_id', u.product_submission_id, 'match_status', u.match_status,
        'frequency_range', u.frequency_range, 'source', u.source, 'intake_method', u.intake_method,
        'created_at', u.created_at, 'updated_at', u.updated_at) ORDER BY u.id), '[]')
      FROM public.user_product_usage u WHERE u.product_id = '010cf825-4892-4f78-bf20-26ad72122c60'),
    'user_products', (SELECT count(*) FROM public.user_products WHERE catalog_product_id = '010cf825-4892-4f78-bf20-26ad72122c60'),
    'owner_has_scalp_care_usage', (SELECT coalesce(bool_or(EXISTS (SELECT 1 FROM public.user_product_usage u2 WHERE u2.user_id = u.user_id AND u2.category = 'scalp_care')), false)
      FROM public.user_product_usage u WHERE u.product_id = '010cf825-4892-4f78-bf20-26ad72122c60')
  )
) AS prestate;

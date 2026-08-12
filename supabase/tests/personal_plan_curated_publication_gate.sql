begin;
select plan(13);

select has_function(
  'public',
  'validate_personal_plan_curated_publication',
  'curated publication trigger function exists'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.products'::regclass
      and tgname = 'validate_personal_plan_curated_publication_on_insert'
      and not tgisinternal
      and tgdeferrable and tginitdeferred
  ),
  'products cannot become globally curated without the publication trigger'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.products'::regclass
      and tgname = 'validate_personal_plan_curated_publication_on_visibility_transition'
      and tgdeferrable and tginitdeferred
  ),
  'only a true global-visibility transition schedules the deferred curated gate'
);
select alike(
  pg_get_triggerdef((
    select oid from pg_trigger
    where tgrelid = 'public.products'::regclass
      and tgname = 'validate_personal_plan_curated_publication_on_visibility_transition'
  )),
  '%category_key%',
  'a repaired NULL category cannot bypass deferred curated completeness'
);
select alike(
  pg_get_functiondef('public.personal_plan_create_or_reuse_user_product(uuid,text,uuid)'::regprocedure),
  '%owned.user_id = p_user_id%',
  'direct capture function remains owner-scoped for user-submitted products'
);
select alike(
  pg_get_functiondef('public.product_intake_approve_reviewed_product(uuid,jsonb,jsonb,text,timestamptz,text)'::regprocedure),
  '%guidance_payload%',
  'approval persists canonical protocol guidance in the product transaction'
);

set constraints all immediate;
insert into public.products (
  id, name, brand, category, category_key, suitable_thicknesses,
  is_active, lifecycle_status, origin, is_chaarlie_recommended
) values (
  '33333333-3333-4333-8333-333333333333', 'Incomplete publication fixture',
  'Fixture', 'Maske', 'mask', array['normal']::text[],
  false, 'active', 'curated', false
);
select throws_ok(
  $$update public.products set is_active = true where id = '33333333-3333-4333-8333-333333333333'$$,
  'curated publication requires complete category facts and exact canonical protocol',
  'an incomplete curated product cannot transition to global visibility'
);

insert into public.products (
  id, name, brand, category, category_key, suitable_thicknesses,
  is_active, lifecycle_status, origin, is_chaarlie_recommended
) values (
  '55555555-5555-4555-8555-555555555555', 'Incomplete shampoo facts fixture',
  'Fixture', 'Shampoo', 'shampoo', array['normal']::text[],
  false, 'active', 'curated', false
);
insert into public.product_shampoo_specs (
  product_id, thickness, shampoo_bucket, scalp_route, cleansing_intensity
) values (
  '55555555-5555-4555-8555-555555555555', 'normal', 'normal', null, null
);
insert into public.product_application_protocols (
  product_id, category, role, source_url, source_text, guidance_payload
) values (
  '55555555-5555-4555-8555-555555555555', 'shampoo', 'shampoo_everyday',
  'https://example.test/shampoo', 'Source-backed shampoo protocol',
  jsonb_build_object(
    'scope', jsonb_build_object(
      'kind', 'product',
      'productId', '55555555-5555-4555-8555-555555555555',
      'category', 'shampoo'
    ),
    'evidence', jsonb_build_array(jsonb_build_object('sourceUrl', 'https://example.test/shampoo'))
  )
);
select throws_ok(
  $$update public.products set is_active = true where id = '55555555-5555-4555-8555-555555555555'$$,
  'curated publication requires complete category facts and exact canonical protocol',
  'nullable shampoo facts cannot bypass curated publication with an otherwise complete protocol'
);

insert into public.product_categories (
  key, display_name_de, is_catalog_supported, is_intake_supported, sort_order
) values (
  'dry_shampoo', 'Trockenshampoo', true, true, 80
) on conflict (key) do nothing;
insert into public.products (
  id, name, brand, category, category_key, suitable_thicknesses,
  is_active, lifecycle_status, origin, is_chaarlie_recommended
) values (
  '66666666-6666-4666-8666-666666666666', 'Complete dry shampoo fixture',
  'Fixture', 'Trockenshampoo', 'dry_shampoo', array[]::text[],
  false, 'active', 'curated', false
);
insert into public.product_dry_shampoo_specs (
  product_id, primary_effect, hair_color_fit, scalp_sensitivity_fit, format
) values (
  '66666666-6666-4666-8666-666666666666', 'classic_refresh', 'universal', 'sensitive_ok', 'aerosol_spray'
);
insert into public.product_application_protocols (
  product_id, category, role, source_url, source_text, guidance_payload
) values (
  '66666666-6666-4666-8666-666666666666', 'dry_shampoo', 'root_refresh_bridge',
  'https://example.test/dry-shampoo', 'Source-backed dry shampoo protocol',
  jsonb_build_object(
    'scope', jsonb_build_object(
      'kind', 'product',
      'productId', '66666666-6666-4666-8666-666666666666',
      'category', 'dry_shampoo'
    ),
    'evidence', jsonb_build_array(jsonb_build_object('sourceUrl', 'https://example.test/dry-shampoo'))
  )
);
update public.products
set is_active = true
where id = '66666666-6666-4666-8666-666666666666';
select lives_ok(
  $$set constraints all immediate$$,
  'Dry Shampoo publication relies on exact refresh facts rather than a fabricated hair-thickness fact'
);

insert into public.products (
  id, name, brand, category, category_key,
  is_active, lifecycle_status, origin, is_chaarlie_recommended
) values (
  '44444444-4444-4444-8444-444444444444', 'Complete heat publication fixture',
  'Fixture', 'Hitzeschutz', 'heat_protectant',
  false, 'active', 'curated', false
);
insert into public.product_heat_protectant_specs (product_id, provides_heat_protection)
values ('44444444-4444-4444-8444-444444444444', true);
insert into public.product_application_protocols (
  product_id, category, role, application_state, reapplication,
  source_url, source_text, guidance_payload
) values (
  '44444444-4444-4444-8444-444444444444', 'heat_protectant', 'pre_heat_protection', 'damp', 'required',
  'https://example.test/heat', 'Source-backed heat protocol',
  jsonb_build_object(
    'scope', jsonb_build_object(
      'kind', 'product',
      'productId', '44444444-4444-4444-8444-444444444444',
      'category', 'heat_protectant'
    ),
    'evidence', jsonb_build_array(jsonb_build_object('sourceUrl', 'https://example.test/heat'))
  )
);
update public.products
set is_active = true
where id = '44444444-4444-4444-8444-444444444444';
select lives_ok(
  $$set constraints all immediate$$,
  'a complete curated product can become globally visible'
);
select lives_ok(
  $test$
  do $block$
  declare
    manifest_json text := jsonb_build_object(
      'schema_version', 'personal-plan-stage5-product-dispositions-v1',
      'batch_id', 'S5-99-test-disposition',
      'frozen_cohort_fingerprint', repeat('a', 64),
      'review', jsonb_build_object('state', 'approved_by_nick', 'reviewed_by', 'nick'),
      'items', jsonb_build_array(jsonb_build_object(
        'product_id', '44444444-4444-4444-8444-444444444444',
        'expected_current_category', 'heat_protectant',
        'target_category', 'heat_protectant',
        'disposition', 'awaiting_exact_analysis',
        'reason_code', 'insufficient_finished_product_evidence',
        'reason', 'Fixture disposition exercises the table-returning RPC lookup.',
        'sources', jsonb_build_array(jsonb_build_object(
          'label', 'Fixture source',
          'url', 'https://example.test/heat',
          'text', 'Fixture evidence summary',
          'source_type', 'manufacturer',
          'checked_at', '2026-08-12'
        ))
      ))
    )::text;
  begin
    perform *
    from public.apply_personal_plan_product_search_dispositions_v1(
      manifest_json,
      encode(extensions.digest(convert_to(manifest_json, 'UTF8'), 'sha256'), 'hex'),
      'nick'
    );
    perform *
    from public.apply_personal_plan_product_search_dispositions_v1(
      manifest_json,
      encode(extensions.digest(convert_to(manifest_json, 'UTF8'), 'sha256'), 'hex'),
      'nick'
    );
  end;
  $block$;
  $test$,
  'the disposition RPC qualifies product_id and replays an exact manifest'
);
select is(
  (
    select disposition
    from public.personal_plan_product_search_dispositions
    where product_id = '44444444-4444-4444-8444-444444444444'
  ),
  'awaiting_exact_analysis',
  'the disposition RPC stores the reviewed result'
);
delete from public.personal_plan_product_search_dispositions
where product_id = '44444444-4444-4444-8444-444444444444';
set constraints all immediate;
select throws_ok(
  $$delete from public.product_application_protocols where product_id = '44444444-4444-4444-8444-444444444444'$$,
  'curated publication requires complete category facts and exact canonical protocol',
  'deleting a canonical protocol cannot make a visible curated product incomplete'
);
set constraints all deferred;

select * from finish();
rollback;

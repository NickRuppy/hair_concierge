begin;
select plan(10);

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
set constraints all immediate;
select throws_ok(
  $$delete from public.product_application_protocols where product_id = '44444444-4444-4444-8444-444444444444'$$,
  'curated publication requires complete category facts and exact canonical protocol',
  'deleting a canonical protocol cannot make a visible curated product incomplete'
);
set constraints all deferred;

select * from finish();
rollback;

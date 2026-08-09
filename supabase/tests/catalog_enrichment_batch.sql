begin;

select plan(33);

select has_table('public', 'catalog_enrichment_applied_items', 'B1 has an idempotency ledger');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.catalog_enrichment_applied_items'::regclass), 'B1 ledger has RLS');
select ok(not has_table_privilege('authenticated', 'public.catalog_enrichment_applied_items', 'select, insert, update, delete'), 'browser roles cannot access B1 ledger');
select ok(has_table_privilege('service_role', 'public.catalog_enrichment_applied_items', 'select'), 'service role can read the B1 ledger for verification');
select ok(not has_table_privilege('service_role', 'public.catalog_enrichment_applied_items', 'insert, update, delete'), 'service role cannot mutate the B1 ledger directly');
select ok(has_function_privilege('service_role', 'public.catalog_enrichment_apply_batch(text,text,text)'::regprocedure, 'execute'), 'service role can execute B1 RPC');
select ok(not has_function_privilege('authenticated', 'public.catalog_enrichment_apply_batch(text,text,text)'::regprocedure, 'execute'), 'authenticated cannot execute B1 RPC');
select ok(not has_function_privilege('anon', 'public.catalog_enrichment_apply_batch(text,text,text)'::regprocedure, 'execute'), 'anon cannot execute B1 RPC');
select ok((select 'search_path=""' = any(proconfig) from pg_catalog.pg_proc where oid='public.catalog_enrichment_apply_batch(text,text,text)'::regprocedure), 'B1 RPC has an empty search path');
select col_has_check('public', 'product_identifiers', 'identifier_type', 'manufacturer_sku is accepted by identifier constraint');
select ok(exists(select 1 from public.brands where id='7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1' and canonical_name='taft'), 'exact taft identity is seeded');
select ok(exists(select 1 from public.brand_aliases where brand_id='7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1' and normalized_alias='schwarzkopf taft'), 'Schwarzkopf taft alias is seeded');
select ok(exists(select 1 from public.product_lines where brand_id='525123e1-1376-4fca-91b0-4eeb99c0bc50' and canonical_name='Elvital Dream Length'), 'L Oreal Dream Length parent is preserved');
select ok(exists(select 1 from public.product_lines where brand_id='354b561c-5a0f-400c-8d89-39bc7231876b' and canonical_name='Derma X Pro'), 'Head and Shoulders Derma X Pro parent is preserved');

insert into public.brands (id, canonical_name, normalized_name) values
  ('58bcafd6-a884-4337-8c8d-8d8369f2117c','Balea','balea'),
  ('a286e2c2-6b44-41f3-a37b-f57d4ed1e93c','got2b','got2b'),
  ('d1a06eff-1c23-472e-908e-f5364edb1bec','Jean&Len','jean len'),
  ('1c460ddf-75b8-4db6-9a33-748dfe7a5da0','Gliss','gliss'),
  ('c3481711-82bb-436b-8ae8-654f013387c6','Isana','isana')
on conflict (id) do nothing;
insert into public.product_lines (id, brand_id, canonical_name, normalized_name) values
  ('7acc1a31-fe34-4e3a-8ee9-634a0761943c','58bcafd6-a884-4337-8c8d-8d8369f2117c','Professional','professional'),
  ('f1d4f755-ed3c-4762-a15e-8b905e3d1a8b','1c460ddf-75b8-4db6-9a33-748dfe7a5da0','Scalp Balance','scalp balance'),
  ('e117d1fb-1398-42da-9bcb-669b9696f6b1','c3481711-82bb-436b-8ae8-654f013387c6','Professional','professional')
on conflict (id) do nothing;

create function public.b1_test_raw_batch(p_invalid boolean default false) returns text language sql as $$
  with items(product_key, category_key, brand_id, line_id, recommended) as (
    values
      ('balea-two-phase-200ml','heat_protectant','58bcafd6-a884-4337-8c8d-8d8369f2117c'::uuid,null::uuid,false),
      ('balea-ultralight-200ml','heat_protectant','58bcafd6-a884-4337-8c8d-8d8369f2117c'::uuid,null::uuid,true),
      ('got2b-schutzengel-200ml','heat_protectant','a286e2c2-6b44-41f3-a37b-f57d4ed1e93c'::uuid,null::uuid,true),
      ('jean-len-beat-the-heat-100ml','heat_protectant','d1a06eff-1c23-472e-908e-f5364edb1bec'::uuid,null::uuid,true),
      ('loreal-elvital-dream-length-defeat-the-heat-150ml','heat_protectant','525123e1-1376-4fca-91b0-4eeb99c0bc50'::uuid,'424f3e04-4a35-4b52-a23a-a33c06b996b7'::uuid,true),
      ('taft-aloe-boost-hydra-protect-150ml','heat_protectant','7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid,'4cfd54ce-fd3f-4d5a-a06d-ff4b74163480'::uuid,false),
      ('taft-gliss-lovely-long-150ml','heat_protectant','7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1'::uuid,'33bb265a-f7a5-4fce-a2bb-9d6d1b24d9cf'::uuid,true),
      ('balea-professional-aha-scalp-peeling','scalp_care','58bcafd6-a884-4337-8c8d-8d8369f2117c'::uuid,'7acc1a31-fe34-4e3a-8ee9-634a0761943c'::uuid,true),
      ('balea-professional-sensitive-scalp-serum','scalp_care','58bcafd6-a884-4337-8c8d-8d8369f2117c'::uuid,'7acc1a31-fe34-4e3a-8ee9-634a0761943c'::uuid,true),
      ('eucerin-dermocapillaire-urea-intensive-tonic','scalp_care','eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01'::uuid,'be663588-e88c-48e2-ae10-cfd320ffd444'::uuid,true),
      ('gliss-scalp-balance-clarifying-serum','scalp_care','1c460ddf-75b8-4db6-9a33-748dfe7a5da0'::uuid,'f1d4f755-ed3c-4762-a15e-8b905e3d1a8b'::uuid,true),
      ('head-shoulders-derma-x-pro-scalp-leave-in','scalp_care','354b561c-5a0f-400c-8d89-39bc7231876b'::uuid,'ab40e16d-0fc1-44c5-b6c6-ae59f81ef7c8'::uuid,true),
      ('isana-professional-aha-pha-scalp-peeling','scalp_care','c3481711-82bb-436b-8ae8-654f013387c6'::uuid,'e117d1fb-1398-42da-9bcb-669b9696f6b1'::uuid,true),
      ('loreal-elvital-fiber-booster-scalp-serum','scalp_care','525123e1-1376-4fca-91b0-4eeb99c0bc50'::uuid,'cfb409a0-c4d3-4d8f-b605-69f23e68dd1a'::uuid,true),
      ('the-ordinary-multi-peptide-hair-density-serum','scalp_care','c7e8f24b-f765-4d2d-a0d9-45f0d6d2d4a9'::uuid,null::uuid,true)
  ) select jsonb_build_object('schema_version','personal-plan-catalog-enrichment-b1','batch_id','personal-plan-launch-v1','accepted_base_sha','580c3c118bc979679aee7b5782ad29c3dd0622ca','b0_index_fingerprint','6347a416f47dd48615bcfbf82863c99823028b3c83dffc9b1a63c8bcf490342e','products',jsonb_agg(jsonb_strip_nulls(jsonb_build_object('product_key',product_key,'content_fingerprint',case when p_invalid and product_key='got2b-schutzengel-200ml' then 'not-a-fingerprint' else md5(product_key)||md5(product_key) end,'category_key',category_key,'product',jsonb_build_object('name','B1 test '||product_key,'brand','B1 test brand '||product_key,'category',category_key,'affiliate_link','https://example.test/'||product_key,'image_url','https://example.test/assets/'||product_key||'.webp','price_eur',1.23,'currency','EUR','origin','curated','is_active',true,'lifecycle_status','active','is_chaarlie_recommended',recommended,'purchase_link_status',case when recommended then 'available' else 'unavailable' end,'purchase_link_checked_at','2026-08-09T00:00:00Z','price_checked_at','2026-08-09T00:00:00Z','brand_id',brand_id,'product_line_id',line_id),'image_asset',jsonb_build_object('storage_bucket','product-images','storage_path','catalog-enrichment/test/'||product_key||'.webp','public_url','https://example.test/assets/'||product_key||'.webp','source_page_url','https://example.test/source/'||product_key,'source_image_url',null,'source_type','retailer','quality_confidence','high','processing_method','local','asset_sha256',repeat('a',64),'manifest_batch_id','personal-plan-launch-v1','user_approved',true,'notes',null),'identifiers',jsonb_build_array(jsonb_build_object('type','manufacturer_sku','value','b1-'||product_key,'source','test')),'heat_spec',case when category_key='heat_protectant' then jsonb_build_object('format','spray','provides_heat_protection',true) else null end,'scalp_spec',case when category_key='scalp_care' then jsonb_build_object('primary_role','scalp_comfort','presentation_format','serum','rinse_mode','leave_on','application_instructions','test') else null end,'protocols',jsonb_build_array(jsonb_build_object('category',category_key,'role',case when category_key='heat_protectant' then 'pre_heat_protection' else 'scalp_comfort' end,'cadence',null,'application_stage','test','application_state',case when category_key='heat_protectant' then 'either' else null end,'placement','test','contact_time_seconds',null,'rinse_action','leave_on','reapplication',case when category_key='heat_protectant' then 'required' else 'not_stated' end,'instruction_modifiers','[]'::jsonb,'source_label','test','source_url','https://example.test','source_text','test')))) order by product_key))::text from items;
$$;

create function public.b1_test_batch(p_invalid boolean default false) returns text language sql as $$
  with raw as (
    select public.b1_test_raw_batch(p_invalid)::jsonb as payload
  )
  select jsonb_set(
    payload,
    '{products}',
    (
      select jsonb_agg(
        jsonb_set(item.value, '{product,brand}', to_jsonb(brand.canonical_name))
        order by item.value->>'product_key'
      )
      from jsonb_array_elements(payload->'products') item(value)
      join public.brands brand on brand.id=(item.value->'product'->>'brand_id')::uuid
    )
  )::text
  from raw;
$$;

create function public.b1_test_mutation(p_path text[], p_value jsonb) returns text language sql as $$
  select jsonb_set(public.b1_test_batch()::jsonb, p_path, p_value)::text;
$$;

create function public.b1_test_identifier_collision() returns text language sql as $$
  select jsonb_set(
    jsonb_set(public.b1_test_batch()::jsonb, array['products','0','identifiers','0','type'], to_jsonb('barcode'::text)),
    array['products','0','identifiers','0','value'],
    to_jsonb('PZN:123'::text)
  )::text;
$$;

select throws_ok($$select * from public.catalog_enrichment_apply_batch(public.b1_test_batch(true), encode(extensions.digest(convert_to(public.b1_test_batch(true),'UTF8'),'sha256'),'hex'), 'nick')$$, null, 'catalog enrichment item is invalid: got2b-schutzengel-200ml', 'invalid item rolls back the whole batch');
select is((select count(*)::integer from public.products where name like 'B1 test %'), 0, 'invalid item leaves no partial product rows');
select throws_ok($$select * from public.catalog_enrichment_apply_batch(public.b1_test_mutation(array['products','0','product','brand_id'], to_jsonb('a286e2c2-6b44-41f3-a37b-f57d4ed1e93c'::text)), encode(extensions.digest(convert_to(public.b1_test_mutation(array['products','0','product','brand_id'], to_jsonb('a286e2c2-6b44-41f3-a37b-f57d4ed1e93c'::text)),'UTF8'),'sha256'),'hex'), 'nick')$$, null, 'catalog enrichment identity is not approved: balea-professional-aha-scalp-peeling', 'wrong exact identity is rejected');
select throws_ok($$select * from public.catalog_enrichment_apply_batch(public.b1_test_mutation(array['products','0','protocols','0','role'], to_jsonb('not_approved'::text)), encode(extensions.digest(convert_to(public.b1_test_mutation(array['products','0','protocols','0','role'], to_jsonb('not_approved'::text)),'UTF8'),'sha256'),'hex'), 'nick')$$, null, 'catalog enrichment protocol is invalid: balea-professional-aha-scalp-peeling', 'invalid category role is rejected');
insert into public.products (id, name) values ('00000000-0000-4000-8000-000000000001', 'B1 partial ledger fixture');
insert into public.catalog_enrichment_applied_items (batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by) values ('personal-plan-launch-v1', 'balea-two-phase-200ml', repeat('a',64), repeat('b',64), '00000000-0000-4000-8000-000000000001', 'nick');
select throws_ok($$select * from public.catalog_enrichment_apply_batch(public.b1_test_batch(), encode(extensions.digest(convert_to(public.b1_test_batch(),'UTF8'),'sha256'),'hex'), 'nick')$$, null, 'catalog enrichment partial ledger state', 'a partial batch ledger fails closed');
delete from public.catalog_enrichment_applied_items where product_id='00000000-0000-4000-8000-000000000001';
delete from public.products where id='00000000-0000-4000-8000-000000000001';
insert into public.products (id, name) values ('00000000-0000-4000-8000-000000000002', 'B1 identifier fixture');
insert into public.product_identifiers (product_id, identifier_type, identifier_value, source) values ('00000000-0000-4000-8000-000000000002', 'barcode', 'PZN123', 'test');
select throws_ok($$select * from public.catalog_enrichment_apply_batch(public.b1_test_identifier_collision(), encode(extensions.digest(convert_to(public.b1_test_identifier_collision(),'UTF8'),'sha256'),'hex'), 'nick')$$, null, 'catalog enrichment identifier collision: balea-professional-aha-scalp-peeling', 'identifier collision uses the canonical type-specific normalizer');
delete from public.product_identifiers where product_id='00000000-0000-4000-8000-000000000002';
delete from public.products where id='00000000-0000-4000-8000-000000000002';
select lives_ok($$select * from public.catalog_enrichment_apply_batch(public.b1_test_batch(), encode(extensions.digest(convert_to(public.b1_test_batch(),'UTF8'),'sha256'),'hex'), 'nick')$$, 'exact 15-item approved shape applies atomically');
select is((select count(*)::integer from public.catalog_enrichment_applied_items where batch_id='personal-plan-launch-v1'), 15, 'all 15 ledger entries were written');
select is((select count(*)::integer from public.products where name like 'B1 test %'), 15, 'all 15 products were written');
select is((select count(*)::integer from public.product_image_assets where manifest_batch_id='personal-plan-launch-v1'), 15, 'all 15 image provenance rows were written');
select is((select count(*)::integer from public.product_identifiers where identifier_value like 'b1-%'), 15, 'all 15 identifiers including manufacturer_sku were written');
select is((select count(*)::integer from public.product_heat_protectant_specs where product_id in (select product_id from public.catalog_enrichment_applied_items)), 7, 'all seven Heat specs were written');
select is((select count(*)::integer from public.product_scalp_care_specs where product_id in (select product_id from public.catalog_enrichment_applied_items)), 8, 'all eight Scalp specs were written');
select is((select count(*)::integer from public.product_application_protocols where product_id in (select product_id from public.catalog_enrichment_applied_items)), 15, 'all 15 protocols were written');
select is((select count(*)::integer from public.products where name like 'B1 test %' and is_chaarlie_recommended=false), 2, 'two explicit non-recommendations are retained');
select lives_ok($$select * from public.catalog_enrichment_apply_batch(public.b1_test_batch(), encode(extensions.digest(convert_to(public.b1_test_batch(),'UTF8'),'sha256'),'hex'), 'nick')$$, 'same fingerprint retries with original IDs');
select throws_ok($$select * from public.catalog_enrichment_apply_batch(public.b1_test_batch(true), encode(extensions.digest(convert_to(public.b1_test_batch(true),'UTF8'),'sha256'),'hex'), 'nick')$$, null, 'catalog enrichment conflicting or partial retry: balea-professional-aha-scalp-peeling', 'changed batch fingerprint conflicts after application');
select is((select count(*)::integer from public.product_submissions where created_at > '2026-08-09T00:00:00Z'), 0, 'B1 does not write product submissions');
select is((select count(*)::integer from public.user_product_usage where created_at > '2026-08-09T00:00:00Z'), 0, 'B1 does not write user product usage');

select * from finish();
rollback;

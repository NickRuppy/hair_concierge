begin;
select plan(12);

select has_table('public', 'catalog_enrichment_applied_items', 'Heat has an idempotency ledger');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.catalog_enrichment_applied_items'::regclass), 'Heat ledger has RLS');
select ok(not has_table_privilege('authenticated', 'public.catalog_enrichment_applied_items', 'select, insert, update, delete'), 'browser roles cannot access Heat ledger');
select ok(has_function_privilege('service_role', 'public.apply_catalog_enrichment_personal_plan_heat_v1(text,text,text)'::regprocedure, 'execute'), 'service role can execute Heat RPC');
select ok(not has_function_privilege('authenticated', 'public.apply_catalog_enrichment_personal_plan_heat_v1(text,text,text)'::regprocedure, 'execute'), 'authenticated cannot execute Heat RPC');
select ok(not has_function_privilege('anon', 'public.apply_catalog_enrichment_personal_plan_heat_v1(text,text,text)'::regprocedure, 'execute'), 'anon cannot execute Heat RPC');
select ok((select 'search_path=""' = any(proconfig) from pg_catalog.pg_proc where oid='public.apply_catalog_enrichment_personal_plan_heat_v1(text,text,text)'::regprocedure), 'Heat RPC has an empty search path');
select col_has_check('public', 'product_identifiers', 'identifier_type', 'manufacturer_sku is accepted');
select ok(exists(select 1 from public.brands where id='7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1' and canonical_name='taft'), 'taft is reconciled');
select ok(exists(select 1 from public.brand_aliases where brand_id='7a2a7445-8f92-4f35-96c3-d7ba06bf1bc1' and normalized_alias='schwarzkopf taft'), 'taft alias is reconciled');
select ok(exists(select 1 from public.product_lines where id='424f3e04-4a35-4b52-a23a-a33c06b996b7' and brand_id='525123e1-1376-4fca-91b0-4eeb99c0bc50'), 'L Oreal line is reconciled');
select ok(exists(select 1 from public.product_categories where key='heat_protectant' and is_catalog_supported and is_intake_supported), 'category readiness dependency enables Heat catalog and intake support');

select * from finish();
rollback;

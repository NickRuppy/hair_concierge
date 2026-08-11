begin;
select plan(20);

select has_table('public', 'catalog_enrichment_applied_items', 'Scalp reuses the Heat idempotency ledger');
select ok((select relrowsecurity from pg_catalog.pg_class where oid='public.catalog_enrichment_applied_items'::regclass), 'Scalp ledger has RLS');
select ok(not has_table_privilege('authenticated', 'public.catalog_enrichment_applied_items', 'select, insert, update, delete'), 'browser roles cannot access Scalp ledger');
select ok(not has_table_privilege('service_role', 'public.catalog_enrichment_applied_items', 'insert, update, delete'), 'service role cannot directly mutate the Scalp ledger outside the SECURITY DEFINER RPC');
select ok(has_function_privilege('service_role', 'public.apply_catalog_enrichment_personal_plan_heat_v1(text,text,text)'::regprocedure, 'execute'), 'Heat RPC prerequisite is present');
select ok(has_function_privilege('service_role', 'public.apply_catalog_enrichment_personal_plan_scalp_v1(text,text,text)'::regprocedure, 'execute'), 'service role can execute Scalp RPC');
select ok(not has_function_privilege('authenticated', 'public.apply_catalog_enrichment_personal_plan_scalp_v1(text,text,text)'::regprocedure, 'execute'), 'authenticated cannot execute Scalp RPC');
select ok(not has_function_privilege('anon', 'public.apply_catalog_enrichment_personal_plan_scalp_v1(text,text,text)'::regprocedure, 'execute'), 'anon cannot execute Scalp RPC');
select ok((select prosecdef from pg_catalog.pg_proc where oid='public.apply_catalog_enrichment_personal_plan_scalp_v1(text,text,text)'::regprocedure), 'Scalp RPC is SECURITY DEFINER');
select ok((select 'search_path=""' = any(proconfig) from pg_catalog.pg_proc where oid='public.apply_catalog_enrichment_personal_plan_scalp_v1(text,text,text)'::regprocedure), 'Scalp RPC has an empty search path');
select col_has_check('public', 'product_identifiers', 'identifier_type', 'manufacturer_sku is accepted for Scalp identifiers');
select ok(exists(select 1 from public.product_categories where key='scalp_care' and is_catalog_supported and is_intake_supported), 'category readiness dependency enables Scalp catalog and intake support');

select ok(exists(select 1 from public.brands where id='eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01' and canonical_name='Eucerin'), 'Eucerin seed is reconciled');
select ok(exists(select 1 from public.brands where id='354b561c-5a0f-400c-8d89-39bc7231876b' and canonical_name='Head & Shoulders'), 'Head and Shoulders parent seed is reconciled');
select ok(exists(select 1 from public.brands where id='c7e8f24b-f765-4d2d-a0d9-45f0d6d2d4a9' and canonical_name='The Ordinary'), 'The Ordinary seed is reconciled');
select ok(exists(select 1 from public.product_lines where id='be663588-e88c-48e2-ae10-cfd320ffd444' and brand_id='eb2c78a1-bb96-4d64-9fb3-4e2c0d0c2a01' and canonical_name='DermoCapillaire Urea'), 'Eucerin DermoCapillaire Urea seed is reconciled');
select ok(exists(select 1 from public.product_lines where id='ab40e16d-0fc1-44c5-b6c6-ae59f81ef7c8' and brand_id='354b561c-5a0f-400c-8d89-39bc7231876b' and canonical_name='Derma X Pro'), 'Head and Shoulders Derma X Pro seed is reconciled');
select ok(exists(select 1 from public.product_lines where id='cfb409a0-c4d3-4d8f-b605-69f23e68dd1a' and brand_id='525123e1-1376-4fca-91b0-4eeb99c0bc50' and canonical_name='Elvital Fiber Booster'), 'L Oreal Elvital Fiber Booster seed is reconciled');
select is((select count(*)::integer from public.catalog_enrichment_applied_items where batch_id='personal-plan-scalp-launch-v1'), 0, 'pre-apply Scalp ledger has zero rows after the real-package transaction rolls back');
select is((select count(*)::integer from public.catalog_enrichment_applied_items where batch_id='personal-plan-heat-launch-v1'), 0, 'Scalp static test does not recreate or mutate the Heat ledger');

select * from finish();
rollback;

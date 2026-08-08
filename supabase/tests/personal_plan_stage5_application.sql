begin;
select plan(18);

select has_table('public', 'application_day_type_definitions', 'day definitions are present');
select has_table('public', 'application_guidance_protocols', 'guidance protocols are present');
select is((select count(*)::integer from public.application_day_type_definitions where status = 'active'), 8, 'eight active canonical day types');
select is((select count(*)::integer from public.application_day_type_definitions where locale = 'de'), 8, 'day types are German');

select ok(not has_table_privilege('anon', 'public.application_day_type_definitions', 'select'), 'anon cannot read day definitions');
select ok(not has_table_privilege('authenticated', 'public.application_day_type_definitions', 'select'), 'authenticated cannot read day definitions');
select ok(not has_table_privilege('anon', 'public.application_guidance_protocols', 'select'), 'anon cannot read protocols');
select ok(not has_table_privilege('authenticated', 'public.application_guidance_protocols', 'select'), 'authenticated cannot read protocols');
select ok(not has_table_privilege('anon', 'public.application_day_type_definitions', 'insert, update, delete'), 'anon cannot write day definitions');
select ok(not has_table_privilege('authenticated', 'public.application_guidance_protocols', 'insert, update, delete'), 'authenticated cannot write protocols');
select ok(has_table_privilege('service_role', 'public.application_day_type_definitions', 'select'), 'service role reads day definitions');
select ok(has_table_privilege('service_role', 'public.application_guidance_protocols', 'select'), 'service role reads protocols');
select ok(not has_table_privilege('service_role', 'public.application_day_type_definitions', 'insert, update, delete'), 'service role cannot write day definitions');
select ok(not has_table_privilege('service_role', 'public.application_guidance_protocols', 'insert, update, delete'), 'service role cannot write protocols');

select throws_ok($$delete from public.application_day_type_definitions where day_type_key = 'rest_day' and status = 'active'$$, null, 'active application content must be retired, not deleted', 'active day definitions cannot be deleted');
select throws_ok($$update public.application_day_type_definitions set label = 'forged' where day_type_key = 'rest_day' and status = 'active'$$, null, 'active application content is immutable; only active-to-retired is allowed', 'active day definitions cannot be changed');
select lives_ok($$update public.application_day_type_definitions set status = 'retired' where day_type_key = 'rest_day' and status = 'active'$$, 'active day definitions can retire');
select throws_ok($$delete from public.application_guidance_protocols where id = (select id from public.application_guidance_protocols where status = 'active' limit 1)$$, null, 'active application content must be retired, not deleted', 'active protocol cannot be deleted');

select * from finish();
rollback;

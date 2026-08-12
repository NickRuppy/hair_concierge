begin;

select plan(19);

select has_table(
  'public',
  'regular_quiz_test_enrollments',
  'regular quiz field-test enrollments exist'
);
select col_is_pk(
  'public',
  'regular_quiz_test_enrollments',
  'id',
  'regular quiz enrollment has a primary key'
);
select is(
  (
    select column_default
      from information_schema.columns
     where table_schema = 'public'
       and table_name = 'personal_plan_test_campaigns'
       and column_name = 'flow_kind'
  ),
  '''personal_plan''::text',
  'existing campaign rows default to the Personal Plan flow'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.activate_regular_quiz_field_test(uuid,uuid,uuid,uuid,text)'::regprocedure,
    'EXECUTE'
  )
  and has_function_privilege(
    'service_role',
    'public.activate_regular_quiz_field_test(uuid,uuid,uuid,uuid,text)'::regprocedure,
    'EXECUTE'
  ),
  'regular quiz activation remains service-only'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'regular-db-one@guest.chaarlie.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'regular-db-two@guest.chaarlie.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '91000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'regular-db-three@guest.chaarlie.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.personal_plan_test_campaigns (
  id, name, token_hash, flow_kind, starts_at, expires_at, max_activations, access_duration_hours
) values
  ('92000000-0000-4000-8000-000000000001', 'Regular DB contract', repeat('a', 64), 'regular_quiz', now() - interval '1 minute', now() + interval '30 days', 10, 168),
  ('92000000-0000-4000-8000-000000000002', 'Regular DB capacity', repeat('b', 64), 'regular_quiz', now() - interval '1 minute', now() + interval '30 days', 1, 168);

insert into public.leads (id, name, email, marketing_consent, quiz_answers, quiz_kind) values
  ('93000000-0000-4000-8000-000000000001', '', 'regular-one@example.invalid', false, '{}'::jsonb, 'legacy'),
  ('93000000-0000-4000-8000-000000000002', '', 'regular-two@example.invalid', false, '{}'::jsonb, 'legacy'),
  ('93000000-0000-4000-8000-000000000003', '', 'regular-three@example.invalid', false, '{}'::jsonb, 'legacy');

insert into public.funnel_sessions (
  id, visitor_id, package_key, landing_slug, channel, landing_variant,
  offer_variant, quiz_variant, first_seen_at, last_seen_at, lead_id
) values
  ('94000000-0000-4000-8000-000000000001', '95000000-0000-4000-8000-000000000001', 'default_organic', 'organic', 'organic', 'organic', 'organic-plan-v1', 'legacy', now(), now(), '93000000-0000-4000-8000-000000000001'),
  ('94000000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-000000000002', 'default_organic', 'organic', 'organic', 'organic', 'organic-plan-v1', 'legacy', now(), now(), '93000000-0000-4000-8000-000000000002'),
  ('94000000-0000-4000-8000-000000000003', '95000000-0000-4000-8000-000000000003', 'default_organic', 'organic', 'organic', 'organic', 'organic-plan-v1', 'legacy', now(), now(), '93000000-0000-4000-8000-000000000003');

select lives_ok(
  $$ select * from public.bind_regular_quiz_field_test_funnel(
    '92000000-0000-4000-8000-000000000001',
    '94000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001'
  ) $$,
  'exact legacy lead and default organic session can be bound'
);
select is(
  (select test_kind from public.funnel_sessions where id = '94000000-0000-4000-8000-000000000001'),
  'field_test',
  'binding marks the exact funnel session as a field test'
);
select is(
  (select field_test_campaign_id from public.funnel_sessions where id = '94000000-0000-4000-8000-000000000001'),
  '92000000-0000-4000-8000-000000000001'::uuid,
  'binding records the exact regular campaign'
);
select is(
  (select reused from public.activate_regular_quiz_field_test(
    '92000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'regular-db-activation-1'
  )),
  false,
  'first activation creates regular quiz access'
);
select ok(
  exists (select 1 from public.regular_quiz_test_enrollments where campaign_id = '92000000-0000-4000-8000-000000000001' and lead_id = '93000000-0000-4000-8000-000000000001' and user_id = '91000000-0000-4000-8000-000000000001')
  and exists (select 1 from public.manual_access_grants where user_id = '91000000-0000-4000-8000-000000000001' and reason = 'tester' and revoked_at is null),
  'activation creates the exact enrollment and tester grant'
);
select ok(
  (select user_id from public.leads where id = '93000000-0000-4000-8000-000000000001') = '91000000-0000-4000-8000-000000000001'::uuid
  and (select user_id from public.funnel_sessions where id = '94000000-0000-4000-8000-000000000001') = '91000000-0000-4000-8000-000000000001'::uuid,
  'activation links the exact legacy lead and funnel session to the guest'
);
select is(
  (select reused from public.activate_regular_quiz_field_test(
    '92000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'regular-db-activation-2'
  )),
  true,
  'exact activation retry reuses the enrollment'
);
select is(
  (select count(*)::integer from public.regular_quiz_test_enrollments where campaign_id = '92000000-0000-4000-8000-000000000001' and lead_id = '93000000-0000-4000-8000-000000000001'),
  1,
  'retry does not create a second enrollment'
);
select throws_ok(
  $$ select * from public.activate_regular_quiz_field_test(
    '92000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000001',
    '93000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'regular-db-conflict'
  ) $$,
  '23505', 'field-test enrollment conflicts with this guest',
  'a different guest cannot reuse a regular enrollment'
);

select lives_ok($$ select * from public.bind_regular_quiz_field_test_funnel('92000000-0000-4000-8000-000000000002', '94000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002') $$, 'capacity campaign accepts its first exact guest');
select lives_ok($$ select * from public.activate_regular_quiz_field_test('92000000-0000-4000-8000-000000000002', '94000000-0000-4000-8000-000000000002', '93000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000002', 'regular-db-capacity-1') $$, 'capacity campaign activates its first guest');
select lives_ok($$ select * from public.bind_regular_quiz_field_test_funnel('92000000-0000-4000-8000-000000000002', '94000000-0000-4000-8000-000000000003', '93000000-0000-4000-8000-000000000003') $$, 'capacity campaign binds a second guest before activation');
select throws_ok($$ select * from public.activate_regular_quiz_field_test('92000000-0000-4000-8000-000000000002', '94000000-0000-4000-8000-000000000003', '93000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000003', 'regular-db-capacity-2') $$, '22023', 'field-test campaign is unavailable', 'capacity blocks a second regular activation');

select is(public.revoke_personal_plan_field_test_campaign('92000000-0000-4000-8000-000000000001'), true, 'flow-aware revocation succeeds for the regular campaign');
select ok(
  exists (select 1 from public.regular_quiz_test_enrollments where campaign_id = '92000000-0000-4000-8000-000000000001' and status = 'revoked' and revoked_at is not null)
  and exists (select 1 from public.manual_access_grants where user_id = '91000000-0000-4000-8000-000000000001' and revoked_at is not null),
  'regular campaign revocation ends its enrollment and grant'
);

select * from finish();

rollback;

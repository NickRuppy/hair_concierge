begin;

select plan(22);

select ok(
  to_regprocedure('public.prepare_personal_plan_test_owner(uuid,jsonb,jsonb)') is not null,
  'synthetic owner preparation function exists'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.prepare_personal_plan_test_owner(uuid,jsonb,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'browser users cannot prepare the synthetic owner'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.prepare_personal_plan_test_owner(uuid,jsonb,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'service role can prepare the synthetic owner'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    'a1a10000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'customer@example.invalid', '', now(),
    '{"personal_plan_test_owner":true}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a1a10000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'personal-plan-qa@hairconscierge.test', '', now(),
    '{"personal_plan_test_owner":true}'::jsonb, '{}'::jsonb, now(), now()
  );

select throws_ok(
  $$
    select public.prepare_personal_plan_test_owner(
      'a1a10000-0000-4000-8000-000000000001',
      '{"kind":"personal_plan","version":3,"answers":{}}'::jsonb,
      '{}'::jsonb
    )
  $$,
  '22023',
  'personal plan test owner identity mismatch',
  'the RPC refuses a different email even when app metadata is forged'
);

select throws_ok(
  $$
    select public.prepare_personal_plan_test_owner(
      'a1a10000-0000-4000-8000-000000000002',
      '{"kind":"personal_plan","answers":{}}'::jsonb,
      '{}'::jsonb
    )
  $$,
  '22023',
  'invalid personal plan test owner source',
  'the RPC rejects an incomplete quiz envelope instead of accepting SQL null comparisons'
);

select throws_ok(
  $$
    select public.prepare_personal_plan_test_owner(
      'a1a10000-0000-4000-8000-000000000002',
      '{"kind":"personal_plan","version":4,"answers":{}}'::jsonb,
      '{}'::jsonb
    )
  $$,
  '22023',
  'invalid personal plan test owner source',
  'the RPC rejects the wrong quiz-envelope version'
);

select lives_ok(
  $$
    select public.prepare_personal_plan_test_owner(
      'a1a10000-0000-4000-8000-000000000002',
      '{"kind":"personal_plan","version":3,"answers":{"texture":"wavy"}}'::jsonb,
      '{"structure":"wavy"}'::jsonb
    )
  $$,
  'the exact sentinel owner can be prepared atomically'
);

select is(
  (select is_admin from public.profiles where id = 'a1a10000-0000-4000-8000-000000000002'),
  false,
  'the reusable owner does not receive global admin privileges'
);
select is(
  (
    select count(*)::integer
      from public.leads
     where user_id = 'a1a10000-0000-4000-8000-000000000002'
       and id = 'b2a10000-0000-4000-8000-000000000002'
  ),
  1,
  'one completed Personal Plan quiz lead is owned by the test user'
);
select ok(
  exists (
    select 1
      from public.funnel_sessions
     where id = 'b2a10000-0000-4000-8000-000000000003'
       and user_id = 'a1a10000-0000-4000-8000-000000000002'
       and lead_id = 'b2a10000-0000-4000-8000-000000000002'
       and is_internal_test = true
       and test_kind = 'field_test'
       and field_test_campaign_id = 'b2a10000-0000-4000-8000-000000000001'
  ),
  'the funnel carries both canonical synthetic analytics markers'
);
select ok(
  exists (
    select 1
      from public.manual_access_grants
     where id = 'b2a10000-0000-4000-8000-000000000008'
       and user_id = 'a1a10000-0000-4000-8000-000000000002'
       and reason = 'tester'
       and expires_at = '2099-01-01T00:00:00.000Z'::timestamptz
       and revoked_at is null
  ),
  'a narrow reusable tester grant replaces global admin access'
);
select ok(
  exists (
    select 1
      from public.personal_plan_test_enrollments
     where id = 'b2a10000-0000-4000-8000-000000000009'
       and campaign_id = 'b2a10000-0000-4000-8000-000000000001'
       and user_id = 'a1a10000-0000-4000-8000-000000000002'
       and manual_access_grant_id = 'b2a10000-0000-4000-8000-000000000008'
       and prepared_artifact_id = 'b2a10000-0000-4000-8000-000000000006'
       and status = 'active'
       and expires_at = '2099-01-01T00:00:00.000Z'::timestamptz
       and revoked_at is null
  ),
  'the exact synthetic enrollment grants Personal Plan rollout access only'
);
select ok(
  exists (
    select 1
      from public.billing_one_time_purchases
     where id = 'b2a10000-0000-4000-8000-000000000005'
       and user_id = 'a1a10000-0000-4000-8000-000000000002'
       and status = 'paid'
       and metadata @> '{"is_internal_test":true,"personal_plan_test_owner":true}'::jsonb
  ),
  'the synthetic paid source is visibly internal to payment monitoring'
);
select ok(
  exists (
    select 1
      from public.personal_plan_prepared_artifacts
     where id = 'b2a10000-0000-4000-8000-000000000006'
       and user_id = 'a1a10000-0000-4000-8000-000000000002'
       and lead_id = 'b2a10000-0000-4000-8000-000000000002'
       and status = 'attached'
  ),
  'the completed quiz artifact is attached to the owner'
);
select is(
  (
    select count(*)::integer
      from public.customerio_profile_sync_outbox
     where lead_id = 'b2a10000-0000-4000-8000-000000000002'
  ),
  0,
  'atomic preparation leaves no Customer.io delivery job'
);

select lives_ok(
  $$
    select public.prepare_personal_plan_test_owner(
      'a1a10000-0000-4000-8000-000000000002',
      '{"kind":"personal_plan","version":3,"answers":{"texture":"wavy"}}'::jsonb,
      '{"structure":"wavy"}'::jsonb
    )
  $$,
  'an exact preparation replay is idempotent'
);
select is(
  (
    select count(*)::integer
      from public.billing_one_time_purchases
     where user_id = 'a1a10000-0000-4000-8000-000000000002'
  ),
  1,
  'idempotent preparation does not duplicate paid sources'
);

insert into public.personal_plans (user_id, enrollment_purchase_source_id)
values (
  'a1a10000-0000-4000-8000-000000000002',
  'b2a10000-0000-4000-8000-000000000005'
);

select lives_ok(
  $$
    select public.personal_plan_erase_owner_data(
      'a1a10000-0000-4000-8000-000000000002'
    )
  $$,
  'the canonical reset RPC erases progressed owner state'
);
select is(
  (
    select count(*)::integer
      from public.personal_plans
     where user_id = 'a1a10000-0000-4000-8000-000000000002'
  ),
  0,
  'reset removes the synthetic owner Personal Plan'
);
select ok(
  exists (
    select 1 from public.billing_one_time_purchases
     where id = 'b2a10000-0000-4000-8000-000000000005'
       and user_id = 'a1a10000-0000-4000-8000-000000000002'
  )
  and exists (
    select 1 from public.personal_plan_prepared_artifacts
     where id = 'b2a10000-0000-4000-8000-000000000006'
       and user_id = 'a1a10000-0000-4000-8000-000000000002'
  )
  and exists (
    select 1 from public.personal_plan_test_enrollments
     where id = 'b2a10000-0000-4000-8000-000000000009'
       and user_id = 'a1a10000-0000-4000-8000-000000000002'
       and status = 'active'
  ),
  'reset preserves the paid source, prepared artifact, and narrow tester access'
);

insert into public.leads (
  id, name, email, user_id, quiz_kind, quiz_answers
) values (
  'b2a10000-0000-4000-8000-000000000099',
  'Conflicting owner state',
  'personal-plan-qa@hairconscierge.test',
  'a1a10000-0000-4000-8000-000000000002',
  'personal_plan',
  '{}'::jsonb
);

select throws_ok(
  $$
    select public.prepare_personal_plan_test_owner(
      'a1a10000-0000-4000-8000-000000000002',
      '{"kind":"personal_plan","version":3,"answers":{"texture":"wavy"}}'::jsonb,
      '{"structure":"wavy"}'::jsonb
    )
  $$,
  '23505',
  'personal plan test owner has conflicting lead state',
  'an ambiguous second lead makes preparation fail closed'
);

select is(
  (
    select count(*)::integer
      from public.billing_one_time_purchases
     where user_id = 'a1a10000-0000-4000-8000-000000000002'
  ),
  1,
  'a refused replay cannot change the canonical paid source'
);

select * from finish();

rollback;

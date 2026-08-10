begin;

select plan(15);

select has_table(
  'public',
  'personal_plan_test_campaigns',
  'field-test campaigns exist'
);
select has_table(
  'public',
  'personal_plan_test_enrollments',
  'field-test enrollments exist'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.activate_personal_plan_field_test(uuid,uuid,uuid,uuid,text)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated users cannot execute field-test activation'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.activate_personal_plan_field_test(uuid,uuid,uuid,uuid,text)'::regprocedure,
    'EXECUTE'
  ),
  'service role can execute field-test activation'
);
select ok(
  not has_table_privilege('anon', 'public.manual_access_grants', 'INSERT')
  and not has_table_privilege('anon', 'public.manual_access_grants', 'UPDATE')
  and not has_table_privilege('anon', 'public.manual_access_grants', 'DELETE')
  and not has_table_privilege('authenticated', 'public.manual_access_grants', 'INSERT')
  and not has_table_privilege('authenticated', 'public.manual_access_grants', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.manual_access_grants', 'DELETE'),
  'browser roles cannot write manual access grants directly'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '81000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'field-test-db@guest.chaarlie.invalid',
  '',
  now(),
  '{"access_kind":"field_test"}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.personal_plan_test_campaigns (
  id, name, token_hash, starts_at, expires_at, max_activations, access_duration_hours
) values (
  '82000000-0000-4000-8000-000000000002',
  'DB contract',
  repeat('a', 64),
  now() - interval '1 minute',
  now() + interval '30 days',
  100,
  168
);

insert into public.leads (
  id, name, email, marketing_consent, quiz_answers, quiz_kind
) values (
  '83000000-0000-4000-8000-000000000003',
  '',
  'participant@example.invalid',
  false,
  '{}'::jsonb,
  'personal_plan'
);

insert into public.funnel_sessions (
  id, visitor_id, package_key, landing_slug, channel, landing_variant,
  offer_variant, quiz_variant, first_seen_at, last_seen_at, lead_id
) values (
  '84000000-0000-4000-8000-000000000004',
  '85000000-0000-4000-8000-000000000005',
  'meta_personal_plan_v1',
  'haarplan',
  'meta',
  'personal-plan-quiz',
  'personal-plan-v1',
  'personal-plan-quiz-v1',
  now(),
  now(),
  '83000000-0000-4000-8000-000000000003'
);

insert into public.personal_plan_prepared_artifacts (
  id, answer_hash, claim_token_hash, quiz_answers, canonical_profile,
  fallback_metadata, priorities, diagnostic_scores, public_offer_model,
  locked_plan, status, lead_id, expires_at, attached_at
) values (
  '86000000-0000-4000-8000-000000000006',
  repeat('b', 64),
  repeat('c', 64),
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  'attached',
  '83000000-0000-4000-8000-000000000003',
  now() + interval '1 hour',
  now()
);

select lives_ok(
  $$
    select * from public.bind_personal_plan_field_test_funnel(
      '82000000-0000-4000-8000-000000000002',
      '84000000-0000-4000-8000-000000000004',
      '83000000-0000-4000-8000-000000000003'
    )
  $$,
  'exact campaign, session, and lead can be bound'
);

select is(
  (
    select reused
      from public.activate_personal_plan_field_test(
        '82000000-0000-4000-8000-000000000002',
        '84000000-0000-4000-8000-000000000004',
        '83000000-0000-4000-8000-000000000003',
        '81000000-0000-4000-8000-000000000001',
        'field-test-db-activation-1'
      )
  ),
  false,
  'first activation creates access'
);

select is(
  (
    select reused
      from public.activate_personal_plan_field_test(
        '82000000-0000-4000-8000-000000000002',
        '84000000-0000-4000-8000-000000000004',
        '83000000-0000-4000-8000-000000000003',
        '81000000-0000-4000-8000-000000000001',
        'field-test-db-activation-2'
      )
  ),
  true,
  'exact activation retry reuses the enrollment'
);

select is(
  (
    select user_id
      from public.personal_plan_prepared_artifacts
     where id = '86000000-0000-4000-8000-000000000006'
  ),
  '81000000-0000-4000-8000-000000000001'::uuid,
  'activation binds the exact artifact owner'
);

select is(
  (
    select user_id
      from public.leads
     where id = '83000000-0000-4000-8000-000000000003'
  ),
  '81000000-0000-4000-8000-000000000001'::uuid,
  'activation binds the exact lead owner for profile projection'
);

select is(
  (
    select count(*)::integer
      from public.manual_access_grants
     where user_id = '81000000-0000-4000-8000-000000000001'
       and reason = 'tester'
       and revoked_at is null
  ),
  1,
  'activation creates one active tester grant'
);

update public.manual_access_grants
   set revoked_at = now()
 where user_id = '81000000-0000-4000-8000-000000000001'
   and reason = 'tester';

select throws_ok(
  $$
    select * from public.activate_personal_plan_field_test(
      '82000000-0000-4000-8000-000000000002',
      '84000000-0000-4000-8000-000000000004',
      '83000000-0000-4000-8000-000000000003',
      '81000000-0000-4000-8000-000000000001',
      'field-test-db-activation-revoked'
    )
  $$,
  '22023',
  'field-test enrollment is unavailable',
  'a revoked tester grant cannot be reported as a reusable activation'
);

select is(
  public.revoke_personal_plan_field_test_campaign(
    '82000000-0000-4000-8000-000000000002'
  ),
  true,
  'campaign revocation succeeds'
);

select is(
  (
    select status
      from public.personal_plan_test_enrollments
     where campaign_id = '82000000-0000-4000-8000-000000000002'
  ),
  'revoked',
  'campaign revocation ends the enrollment'
);

select ok(
  exists (
    select 1
      from public.manual_access_grants
     where user_id = '81000000-0000-4000-8000-000000000001'
       and revoked_at is not null
  ),
  'campaign revocation ends the tester grant'
);

select * from finish();

rollback;

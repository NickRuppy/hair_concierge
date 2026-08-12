begin;

select plan(13);

select has_column(
  'public', 'personal_plan_need_versions', 'stage1_source_kind',
  'initial needs retain their Stage-1 source kind'
);
select has_column(
  'public', 'personal_plan_need_versions', 'stage1_source_lead_id',
  'legacy initial needs retain their exact lead source'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb,text,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'the provenance-writing transition remains service-only'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.personal_plan_create_or_reuse_initial_need(uuid,uuid,uuid,integer,text,text,jsonb,jsonb,text,uuid)'::regprocedure,
    'EXECUTE'
  ),
  'service role can write a provenance-checked initial need'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.personal_plan_get_own_routing_source()'::regprocedure,
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.personal_plan_get_own_routing_source()'::regprocedure,
    'EXECUTE'
  ),
  'only authenticated callers can use the public owner-routing boundary'
);
select ok(
  (select prosecdef from pg_catalog.pg_proc where oid = 'private.personal_plan_get_own_routing_source()'::regprocedure)
  and not (select prosecdef from pg_catalog.pg_proc where oid = 'public.personal_plan_get_own_routing_source()'::regprocedure),
  'RLS bypass stays private while the exposed wrapper is security-invoker'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'legacy-plan-a@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', 'a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'legacy-plan-b@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.leads (
  id, name, email, marketing_consent, quiz_answers, quiz_kind, user_id
) values
  ('a2000000-0000-4000-8000-000000000001', '', 'legacy-plan-a@example.invalid', false, '{}'::jsonb, 'legacy', 'a1000000-0000-4000-8000-000000000001'),
  ('a2000000-0000-4000-8000-000000000002', '', 'legacy-plan-b@example.invalid', false, '{}'::jsonb, 'legacy', 'a1000000-0000-4000-8000-000000000002');

select is(
  public.personal_plan_create_or_reuse_initial_need(
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    null,
    1,
    'legacy-source-test',
    repeat('a', 64),
    '{"kind":"legacy_quiz","version":1,"leadId":"a2000000-0000-4000-8000-000000000001","answers":{}}'::jsonb,
    '{"saved":true}'::jsonb,
    'legacy_quiz_lead',
    'a2000000-0000-4000-8000-000000000001'
  )->>'outcome',
  'completed',
  'an exact owned legacy lead creates the immutable initial need'
);
select is(
  (
    select stage1_source_kind
    from public.personal_plan_need_versions
    where user_id = 'a1000000-0000-4000-8000-000000000001'
      and kind = 'initial'
  ),
  'legacy_quiz_lead',
  'the initial need records legacy source provenance'
);
select is(
  (
    select stage1_source_lead_id
    from public.personal_plan_need_versions
    where user_id = 'a1000000-0000-4000-8000-000000000001'
      and kind = 'initial'
  ),
  'a2000000-0000-4000-8000-000000000001'::uuid,
  'the initial need records the exact legacy lead'
);
select is(
  public.personal_plan_create_or_reuse_initial_need(
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001',
    null,
    1,
    'legacy-source-test',
    repeat('b', 64),
    '{}'::jsonb,
    '{}'::jsonb,
    'legacy_quiz_lead',
    'a2000000-0000-4000-8000-000000000002'
  )->>'reasonCode',
  'source_owner_mismatch',
  'a foreign legacy lead cannot become another owner source'
);

insert into public.billing_subscriptions (
  id, user_id, provider, provider_subscription_id, provider_status,
  entitlement_status, interval, current_period_end, metadata
) values (
  'a3000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'stripe',
  'sub_legacy_source_test',
  'active',
  'active',
  'month',
  now() + interval '1 month',
  '{"pricing_catalog":"personal_plan_launch_v1","checkout_session_id":"cs_legacy_source_test"}'::jsonb
);
insert into public.funnel_sessions (
  id, visitor_id, package_key, channel, landing_variant, offer_variant,
  quiz_variant, first_seen_at, last_seen_at, purchase_completed_at,
  lead_id, user_id, purchase_provider, purchase_reference
) values (
  'a4000000-0000-4000-8000-000000000001',
  'a5000000-0000-4000-8000-000000000001',
  'default_organic',
  'organic',
  'organic',
  'organic-plan-v1',
  'legacy-quiz-v1',
  now(),
  now(),
  now(),
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'stripe',
  'cs_legacy_source_test'
);

insert into public.personal_plan_one_time_checkout_consents (
  id, lead_id, funnel_session_id, user_id, product_kind, offer_variant,
  copy_version, consent_text, consent_text_sha256, accepted_at,
  confirmation_provider, confirmation_status, confirmation_reference,
  confirmation_sent_at, confirmation_delivered_at, generation_started_at,
  generation_completed_at, generated_content_sha256, delivery_provider,
  delivery_reference, delivered_at
) values (
  'a6000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'personal_plan_once',
  'legacy-source-test',
  'legacy-source-test-v1',
  'Test consent',
  repeat('c', 64),
  now() - interval '1 day',
  'test',
  'delivered',
  'legacy-source-confirmation',
  now() - interval '1 day',
  now() - interval '1 day',
  now() - interval '1 day',
  now() - interval '1 day',
  repeat('d', 64),
  'test',
  'legacy-source-delivery',
  now() - interval '1 day'
);
insert into public.billing_one_time_purchases (
  id, user_id, provider, product_kind, provider_transaction_id,
  amount_minor, currency, status, paid_at, consent_id
) values (
  'a7000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'stripe',
  'personal_plan_once',
  'pi_legacy_source_old',
  2999,
  'eur',
  'paid',
  now() - interval '1 day',
  'a6000000-0000-4000-8000-000000000001'
);

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is(
  public.personal_plan_get_own_routing_source()->>'quiz_source_kind',
  'legacy',
  'the authenticated routing source returns only the exact owner quiz kind'
);
select is(
  public.personal_plan_get_own_routing_source()->>'source_id',
  'a3000000-0000-4000-8000-000000000001',
  'the newest qualifying purchase wins across subscription and one-time sources'
);
select is(
  public.personal_plan_get_own_routing_source()->'plan'->>'current_initial_need_version_id',
  (
    select current_initial_need_version_id::text
    from public.personal_plans
    where user_id = 'a1000000-0000-4000-8000-000000000001'
  ),
  'the authenticated routing source returns the minimal durable frontier'
);
reset role;

select * from finish();
rollback;

begin;

select plan(4);

select lives_ok(
  $$
    select *
    from public.create_waitlist_signup(
      'launch_1_2026_08',
      'waitlist-db-regression@example.invalid',
      'Regression',
      true,
      '{}'::jsonb,
      repeat('a', 64)
    )
  $$,
  'a waitlist signup can create its outbox row'
);

select lives_ok(
  $$
    select *
    from public.create_waitlist_signup(
      'launch_1_2026_08',
      'waitlist-db-regression@example.invalid',
      'Changed name must not overwrite',
      true,
      '{}'::jsonb,
      repeat('b', 64)
    )
  $$,
  'a duplicate waitlist signup remains idempotent'
);

select is(
  (
    select count(*)::integer
    from public.waitlist_signups
    where campaign = 'launch_1_2026_08'
      and normalized_email = 'waitlist-db-regression@example.invalid'
  ),
  1,
  'the duplicate keeps one authoritative signup'
);

select is(
  (
    select count(*)::integer
    from public.waitlist_customerio_outbox as outbox
    join public.waitlist_signups as signup on signup.id = outbox.signup_id
    where signup.campaign = 'launch_1_2026_08'
      and signup.normalized_email = 'waitlist-db-regression@example.invalid'
      and outbox.event_type = 'waitlist_signup'
  ),
  1,
  'the duplicate keeps one Customer.io signup event'
);

select * from finish();

rollback;

begin;

select plan(1);

select ok(
  to_regprocedure('public.prepare_personal_plan_test_owner(uuid,jsonb,jsonb)') is null,
  'the retired Personal Plan test-owner preparation function is absent'
);

select * from finish();

rollback;

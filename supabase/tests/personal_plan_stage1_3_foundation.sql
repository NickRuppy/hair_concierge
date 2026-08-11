begin;

select plan(92);

select has_table('public', 'personal_plans', 'one owner-scoped Personal Plan root exists');
select has_table('public', 'personal_plan_need_versions', 'immutable need versions exist');
select has_table('public', 'personal_plan_refinement_drafts', 'revisioned refinement drafts exist');
select has_table('public', 'user_products', 'reusable owned-product identities exist');
select has_table('public', 'personal_plan_product_drafts', 'revisioned product drafts exist');
select has_table('public', 'personal_plan_portfolio_versions', 'immutable portfolio versions exist');
select has_table('public', 'personal_plan_routine_versions', 'immutable Routine versions exist');
select has_table('public', 'personal_plan_routine_proposals', 'whole Routine proposals exist');
select has_table('public', 'personal_plan_routine_source_change_outbox', 'durable source-change outbox exists');
select is(
  (
    select jsonb_object_agg(
      key,
      jsonb_build_object(
        'catalogSupported', is_catalog_supported,
        'intakeSupported', is_intake_supported
      )
    )
    from public.product_categories
    where key in ('heat_protectant', 'scalp_care')
  ),
  '{"heat_protectant":{"catalogSupported":true,"intakeSupported":true},"scalp_care":{"catalogSupported":true,"intakeSupported":true}}'::jsonb,
  'category readiness updates production-shaped Heat Protectant and inserts Scalp Care'
);

select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.personal_plans'::regclass),
  true,
  'plan root has RLS enabled'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.personal_plan_need_versions'::regclass),
  true,
  'need versions have RLS enabled'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.personal_plan_product_drafts'::regclass),
  true,
  'product drafts have RLS enabled'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.personal_plan_portfolio_versions'::regclass),
  true,
  'portfolio versions have RLS enabled'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.personal_plan_routine_versions'::regclass),
  true,
  'Routine versions have RLS enabled'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.personal_plan_routine_proposals'::regclass),
  true,
  'Routine proposals have RLS enabled'
);
select is(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.personal_plan_routine_source_change_outbox'::regclass),
  true,
  'outbox rows have RLS enabled'
);

select ok(
  not has_table_privilege('authenticated', 'public.personal_plans', 'INSERT'),
  'authenticated users cannot insert plan roots directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.personal_plan_portfolio_versions', 'UPDATE'),
  'authenticated users cannot mutate portfolio versions directly'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.personal_plan_complete_product_draft_and_stage_routine(uuid,uuid,uuid,bigint,bigint,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'the atomic completion RPC is not browser-executable'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.personal_plan_complete_product_draft_and_stage_routine(uuid,uuid,uuid,bigint,bigint,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'the atomic completion RPC is service-role executable'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.personal_plan_confirm_routine_proposal(uuid,uuid,uuid,bigint)'::regprocedure,
    'EXECUTE'
  ),
  'the Routine confirmation RPC is not browser-executable'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.personal_plan_create_or_load_product_draft(uuid,uuid,uuid,integer,jsonb,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'authenticated users cannot create Stage-3 drafts directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.personal_plan_save_product_draft(uuid,uuid,bigint,text,jsonb,jsonb)'::regprocedure,
    'EXECUTE'
  ),
  'the Stage-3 CAS transition is service-role executable'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.personal_plan_erase_owner_data(uuid)'::regprocedure,
    'EXECUTE'
  ),
  'the account-erasure transition is not browser-executable'
);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'personal-plan-a@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'personal-plan-b@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'personal-plan-c@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'personal-plan-d@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.personal_plans (id, user_id) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003');

insert into public.personal_plan_need_versions (
  id, user_id, personal_plan_id, kind, schema_version, computation_version,
  input_hash, input_snapshot, output_snapshot
) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'initial', 1, 'test', repeat('a', 64), '{}'::jsonb, '{}'::jsonb),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'initial', 1, 'test', repeat('b', 64), '{}'::jsonb, '{}'::jsonb),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'initial', 1, 'test', repeat('c', 64), '{}'::jsonb, '{}'::jsonb);

insert into public.personal_plan_need_versions (
  id, user_id, personal_plan_id, kind, parent_need_version_id, schema_version,
  computation_version, input_hash, input_snapshot, output_snapshot
) values
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'refined', '30000000-0000-0000-0000-000000000001', 1, 'test', repeat('d', 64), '{}'::jsonb, '{}'::jsonb),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'refined', '30000000-0000-0000-0000-000000000003', 1, 'test', repeat('e', 64), '{}'::jsonb, '{}'::jsonb),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', 'refined', '30000000-0000-0000-0000-000000000005', 1, 'test', repeat('f', 64), '{}'::jsonb, '{}'::jsonb);

update public.personal_plans set
  current_initial_need_version_id = case id
    when '20000000-0000-0000-0000-000000000001'::uuid then '30000000-0000-0000-0000-000000000001'::uuid
    when '20000000-0000-0000-0000-000000000002'::uuid then '30000000-0000-0000-0000-000000000003'::uuid
    else '30000000-0000-0000-0000-000000000005'::uuid
  end,
  current_refined_need_version_id = case id
    when '20000000-0000-0000-0000-000000000001'::uuid then '30000000-0000-0000-0000-000000000002'::uuid
    when '20000000-0000-0000-0000-000000000002'::uuid then '30000000-0000-0000-0000-000000000004'::uuid
    else '30000000-0000-0000-0000-000000000006'::uuid
  end;

select is(
  public.personal_plan_create_or_reuse_initial_need(
    '10000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002',
    1, 'test', repeat('9', 64), '{}'::jsonb, '{"saved":true}'::jsonb
  )->>'outcome',
  'completed',
  'Stage-1 create locks and creates the one plan/initial-need pair'
);
select is(
  public.personal_plan_create_or_reuse_initial_need(
    '10000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002',
    1, 'test', repeat('9', 64), '{}'::jsonb, '{"saved":true}'::jsonb
  )->>'needVersionId',
  (select current_initial_need_version_id::text from public.personal_plans where user_id = '10000000-0000-0000-0000-000000000004'),
  'Stage-1 replay reuses the guarded current initial head'
);
select is(
  public.personal_plan_create_or_reuse_initial_need(
    '10000000-0000-0000-0000-000000000004', '90000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000002',
    1, 'test', repeat('9', 64), '{}'::jsonb, '{"forgedOnReplay":true}'::jsonb
  )->'outputSnapshot',
  '{"saved":true}'::jsonb,
  'Stage-1 replay returns the immutable saved snapshot rather than the newly supplied payload'
);

insert into public.personal_plan_refinement_drafts (
  id, user_id, personal_plan_id, base_initial_need_version_id, schema_version
) values (
  '35000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000005', 1
);
select is(
  public.personal_plan_save_refinement_draft(
    '10000000-0000-0000-0000-000000000003', '35000000-0000-0000-0000-000000000001', 0, '{"washFrequency":"twice_weekly"}'::jsonb, array['wash_frequency']
  )->>'outcome',
  'saved',
  'Stage-2 save performs one guarded compare-and-set'
);
select is(
  public.personal_plan_save_refinement_draft(
    '10000000-0000-0000-0000-000000000003', '35000000-0000-0000-0000-000000000001', 0, '{}'::jsonb, '{}'::text[]
  )->>'outcome',
  'revision_conflict',
  'stale Stage-2 save returns a revision conflict without overwriting answers'
);
select is(
  public.personal_plan_complete_refinement_draft(
    '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '35000000-0000-0000-0000-000000000001',
    1, 1, 'test', repeat('8', 64), '{}'::jsonb, '{}'::jsonb
  )->>'outcome',
  'completed',
  'Stage-2 completion freezes a refined need and advances the guarded head'
);
select is(
  public.personal_plan_complete_refinement_draft(
    '10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '35000000-0000-0000-0000-000000000001',
    1, 1, 'test', repeat('8', 64), '{}'::jsonb, '{}'::jsonb
  )->>'outcome',
  'already_completed',
  'Stage-2 completion replay returns the frozen refined need'
);

select is(
  public.personal_plan_create_or_load_product_draft(
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    (select current_refined_need_version_id from public.personal_plans where id='20000000-0000-0000-0000-000000000003'),
    1,
    '{"shampoo":"test-v1"}'::jsonb,
    '{"schemaVersion":1,"pass":"product_capture","orderedCategories":["shampoo"],"products":[],"roleAssignments":[],"uncoveredRoles":[],"decisions":[],"completedCaptureCategories":[],"completedDecisionKeys":[]}'::jsonb
  )->>'status',
  'active',
  'Stage-3 load creates one active canonical draft for the current refined source'
);
select is(
  public.personal_plan_create_or_load_product_draft(
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    (select current_refined_need_version_id from public.personal_plans where id='20000000-0000-0000-0000-000000000003'),
    1,
    '{"shampoo":"test-v1"}'::jsonb,
    '{}'::jsonb
  )->>'id',
  (select id::text from public.personal_plan_product_drafts where personal_plan_id='20000000-0000-0000-0000-000000000003' and status='active'),
  'concurrent/replayed Stage-3 creation returns the same draft identity'
);
select is(
  public.personal_plan_save_product_draft(
    '10000000-0000-0000-0000-000000000003',
    (select id from public.personal_plan_product_drafts where personal_plan_id='20000000-0000-0000-0000-000000000003' and status='active'),
  0,
  'product_capture',
  '{"categoryCursor":"shampoo","completedCaptureCategories":[],"completedDecisionKeys":[]}'::jsonb,
  '{"schemaVersion":1,"pass":"product_capture","orderedCategories":["shampoo"],"products":[],"roleAssignments":[],"uncoveredRoles":[],"decisions":[],"completedCaptureCategories":[],"completedDecisionKeys":[]}'::jsonb
  )->>'outcome',
  'saved',
  'Stage-3 mutation performs one service-only compare-and-set'
);
select is(
  public.personal_plan_save_product_draft(
    '10000000-0000-0000-0000-000000000003',
    (select id from public.personal_plan_product_drafts where personal_plan_id='20000000-0000-0000-0000-000000000003' and status='active'),
    0,
    'product_capture',
    '{}'::jsonb,
    '{}'::jsonb
  )->>'outcome',
  'revision_conflict',
  'a stale Stage-3 mutation returns the canonical conflict without overwriting'
);
create temporary table test_stage3_stale_source_draft on commit drop as
select id
from public.personal_plan_product_drafts
where personal_plan_id='20000000-0000-0000-0000-000000000003' and status='active';
insert into public.personal_plan_need_versions (
  id, user_id, personal_plan_id, kind, parent_need_version_id, schema_version,
  computation_version, input_hash, input_snapshot, output_snapshot
) values (
  '30000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000003',
  'refined', '30000000-0000-0000-0000-000000000005', 1, 'test', repeat('7', 64), '{}'::jsonb, '{}'::jsonb
);
update public.personal_plans
set current_refined_need_version_id='30000000-0000-0000-0000-000000000007', revision=revision+1
where id='20000000-0000-0000-0000-000000000003';
select is(
  public.personal_plan_save_product_draft(
    '10000000-0000-0000-0000-000000000003',
    (select id from test_stage3_stale_source_draft),
    1,
    'product_capture',
    '{"categoryCursor":"shampoo","completedCaptureCategories":[],"completedDecisionKeys":[]}'::jsonb,
    '{"schemaVersion":1,"pass":"product_capture","sourceGuard":"must-not-persist","orderedCategories":["shampoo"],"products":[],"roleAssignments":[],"uncoveredRoles":[],"decisions":[],"completedCaptureCategories":[],"completedDecisionKeys":[]}'::jsonb
  )->>'outcome',
  'stale_source',
  'a Stage-3 save rejects an active draft after the refined pointer has moved'
);
select is(
  (select revision from public.personal_plan_product_drafts where id=(select id from test_stage3_stale_source_draft)),
  1::bigint,
  'a stale refined-source save does not advance the old draft revision'
);
select is(
  (select payload->>'sourceGuard' from public.personal_plan_product_drafts where id=(select id from test_stage3_stale_source_draft)),
  null,
  'a stale refined-source save does not overwrite the old draft payload'
);
select is(
  public.personal_plan_create_or_load_product_draft(
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    (select current_refined_need_version_id from public.personal_plans where id='20000000-0000-0000-0000-000000000003'),
    1,
    '{}'::jsonb,
    '{}'::jsonb
  )->>'outcome',
  'stale_source',
  'cross-owner Stage-3 draft creation is rejected'
);

insert into public.products (
  id, name, category, category_key, is_active, lifecycle_status, is_chaarlie_recommended
) values (
  '70000000-0000-0000-0000-000000000001', 'Personal Plan DB Test Conditioner',
  'Conditioner', 'conditioner', true, 'active', false
);
select is(
  public.personal_plan_create_or_reuse_user_product(
    '10000000-0000-0000-0000-000000000004', 'conditioner',
    '70000000-0000-0000-0000-000000000001'
  )->>'outcome',
  'ready',
  'confirmed catalog ownership creates a reusable user-product identity'
);
select is(
  public.personal_plan_create_or_reuse_user_product(
    '10000000-0000-0000-0000-000000000004', 'conditioner',
    '70000000-0000-0000-0000-000000000001'
  )#>>'{userProduct,id}',
  (select id::text from public.user_products where user_id='10000000-0000-0000-0000-000000000004' and catalog_product_id='70000000-0000-0000-0000-000000000001'),
  'confirmed exact-product ownership retries reuse the stable row'
);
select is(
  (select count(*)::integer from public.user_products where user_id='10000000-0000-0000-0000-000000000004' and catalog_product_id='70000000-0000-0000-0000-000000000001'),
  1,
  'exact owner/category/catalog identity remains unique under retry'
);
select is(
  public.product_intake_create_submission_for_user_product(
    '10000000-0000-0000-0000-000000000004',
    '71000000-0000-0000-0000-000000000001',
    'shampoo',
    'weekly_1x',
    'photo',
    null,
    null,
    'tmp/10000000-0000-0000-0000-000000000004/personal-plan-db-test/front.jpg',
    null,
    null,
    repeat('a', 64),
    now()
  )#>>'{userProduct,identity_status}',
  'pending_review',
  'photo-first intake atomically creates a pending user product without invented label text'
);
select is(
  public.product_intake_create_submission_for_user_product(
    '10000000-0000-0000-0000-000000000004',
    '71000000-0000-0000-0000-000000000001',
    'shampoo', 'weekly_1x', 'photo', null, null,
    'tmp/10000000-0000-0000-0000-000000000004/personal-plan-db-test/front.jpg', null, null, repeat('a', 64), now()
  )->>'replayed',
  'true',
  'a lowercase SHA-256 fingerprint replays the same open Personal Plan submission'
);
select throws_ok(
  $$select public.product_intake_create_submission_for_user_product(
      '10000000-0000-0000-0000-000000000004',
      '71000000-0000-0000-0000-000000000001',
      'shampoo', 'weekly_1x', 'photo', null, null,
      'tmp/10000000-0000-0000-0000-000000000004/personal-plan-db-test/front.jpg', null, null, repeat('b', 64), now()
    )$$,
  '23505',
  'personal plan idempotency key was reused with different input',
  'a different lowercase SHA-256 fingerprint conflicts with the same open Personal Plan submission'
);
select is(
  (select count(*)::integer from public.user_product_usage where user_id='10000000-0000-0000-0000-000000000004'),
  0,
  'Personal Plan intake does not mutate legacy user_product_usage rows'
);

select throws_ok(
  $$insert into public.personal_plan_need_versions (
      user_id, personal_plan_id, kind, schema_version, computation_version, input_hash, input_snapshot, output_snapshot
    ) values (
      '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'initial', 1, 'test', repeat('1', 64), '{}'::jsonb, '{}'::jsonb
    )$$,
  '23503',
  'insert or update on table "personal_plan_need_versions" violates foreign key constraint "personal_plan_need_versions_personal_plan_id_user_id_fkey"',
  'cross-owner immutable child rows are rejected by the composite owner foreign key'
);

select throws_ok(
  $$update public.personal_plan_need_versions set output_snapshot = '{"forged":true}'::jsonb where id = '30000000-0000-0000-0000-000000000002'$$,
  '22000',
  'personal plan version rows are immutable',
  'immutable need versions reject updates even for the database test role'
);

update public.personal_plan_product_drafts
set status = 'stale'
where personal_plan_id = '20000000-0000-0000-0000-000000000003'
  and status = 'active';

insert into public.personal_plan_product_drafts (
  id, user_id, personal_plan_id, refined_need_version_id, contract_version, category_authority_versions
) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 1, '{}'::jsonb),
  ('40000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000004', 1, '{}'::jsonb),
  (
    '40000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    (select current_refined_need_version_id from public.personal_plans where id = '20000000-0000-0000-0000-000000000003'),
    1,
    '{}'::jsonb
  );

create function pg_temp.complete_draft(p_user_id uuid, p_plan_id uuid, p_draft_id uuid, p_revision bigint, p_portfolio jsonb default '{}'::jsonb, p_source_revision bigint default null)
returns jsonb language sql as $$
  select public.personal_plan_complete_product_draft_and_stage_routine(
    p_user_id, p_plan_id, p_draft_id, p_revision, coalesce(p_source_revision, (select source_revision from public.personal_plans where id=p_plan_id)),
    1,
    jsonb_build_object(
      'schemaVersion', 1,
      'personalPlanId', p_plan_id,
      'refinedVersionId', (select refined_need_version_id from public.personal_plan_product_drafts where id=p_draft_id),
      'sourceDraftRevision', p_revision,
      'categoryResolutions', '[]'::jsonb,
      'ownedProducts', '[]'::jsonb,
      'plannedPurchases', '[]'::jsonb,
      'pendingProducts', '[]'::jsonb,
      'uncoveredRoles', '[]'::jsonb
    ) || p_portfolio,
    1, 'test-compiler', '{}'::jsonb, 'test-source-fingerprint',
    '{"steps":[]}'::jsonb, '{"changed":[]}'::jsonb
  )
$$;

create function pg_temp.portfolio_at_size(
  p_plan_id uuid, p_draft_id uuid, p_revision bigint, p_target_bytes integer
) returns jsonb language plpgsql as $$
declare
  v_snapshot jsonb;
  v_padding integer;
begin
  v_snapshot := jsonb_build_object(
    'schemaVersion', 1,
    'portfolioVersionId', '90000000-0000-0000-0000-000000000009',
    'personalPlanId', p_plan_id,
    'refinedVersionId', (select refined_need_version_id from public.personal_plan_product_drafts where id=p_draft_id),
    'sourceDraftRevision', p_revision,
    'categoryResolutions', '[]'::jsonb,
    'ownedProducts', '[]'::jsonb,
    'plannedPurchases', '[]'::jsonb,
    'pendingProducts', '[]'::jsonb,
    'uncoveredRoles', '[]'::jsonb,
    'createdAt', now(),
    'padding', ''
  );
  v_padding := p_target_bytes - octet_length(v_snapshot::text);
  if v_padding < 0 then raise exception 'target is smaller than portfolio envelope'; end if;
  return v_snapshot || jsonb_build_object('padding', repeat('x', v_padding));
end;
$$;

select is(
  pg_temp.complete_draft(
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    '40000000-0000-0000-0000-000000000003',
    0,
    pg_temp.portfolio_at_size(
      '20000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000003',
      0,
      524288
    )
  )->>'status',
  'completed',
  'the exact 524288-byte stored portfolio boundary completes atomically'
);

select is(
  pg_temp.complete_draft('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 0)->>'status',
  'completed',
  'Stage-3 completion atomically stages a portfolio and Routine proposal'
);
select is((select count(*)::integer from public.personal_plan_portfolio_versions where source_product_draft_id = '40000000-0000-0000-0000-000000000001'), 1, 'completion inserts exactly one immutable portfolio');
select is((select count(*)::integer from public.personal_plan_routine_versions where source_product_draft_id = '40000000-0000-0000-0000-000000000001'), 1, 'completion inserts exactly one immutable Routine');
select is((select count(*)::integer from public.personal_plan_routine_proposals where personal_plan_id = '20000000-0000-0000-0000-000000000001' and status = 'pending'), 1, 'completion inserts exactly one pending whole proposal');
select ok((select active_routine_version_id is null from public.personal_plans where id = '20000000-0000-0000-0000-000000000001'), 'staging never activates a Routine');
select is(
  pg_temp.complete_draft('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 0)->>'status',
  'already_completed',
  'lost-response replay reuses the stable completion outcome'
);
select is((select count(*)::integer from public.personal_plan_portfolio_versions where source_product_draft_id = '40000000-0000-0000-0000-000000000001'), 1, 'completion replay does not duplicate the portfolio');

select is(
  pg_temp.complete_draft('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 1)->>'status',
  'revision_conflict',
  'stale Stage-3 expected revisions return a reloadable conflict'
);
select is((select status from public.personal_plan_product_drafts where id = '40000000-0000-0000-0000-000000000002'), 'active', 'revision conflict leaves the editable draft active');
select is(
  public.personal_plan_enqueue_routine_source_change('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'user_product', 'compile-gap')::text,
  '1',
  'a source event after compilation advances the source revision'
);
select is(
  pg_temp.complete_draft('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 0, '{}'::jsonb, 0)->>'status',
  'source_revision_conflict',
  'a source event between compile and stage is a typed CAS conflict'
);
select is((select count(*)::integer from public.personal_plan_portfolio_versions where source_product_draft_id = '40000000-0000-0000-0000-000000000002'), 0, 'source revision conflict writes no portfolio, Routine, proposal, or completion state');
select is(public.personal_plan_enqueue_routine_source_change('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'user_product', 'unrelated-pending'), 2::bigint, 'an unrelated pending outbox row records the fresh source revision');
select is(public.personal_plan_enqueue_routine_source_change('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'user_product', 'unrelated-pending'), 3::bigint, 'a newer coalesced unrelated row retains its latest observed revision');
select is(public.personal_plan_enqueue_routine_source_change('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'user_product', 'leased-source'), 4::bigint, 'a leased source row also advances the source revision before stage');
update public.personal_plan_routine_source_change_outbox
   set status='processing', lease_token='80000000-0000-0000-0000-000000000002', lease_expires_at=now() + interval '60 seconds'
 where personal_plan_id='20000000-0000-0000-0000-000000000002' and source_key='leased-source';
select is(
  pg_temp.complete_draft(
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000002',
    0,
    pg_temp.portfolio_at_size(
      '20000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000002',
      0,
      524289
    )
  )->>'status',
  'snapshot_too_large',
  'oversized portfolio snapshots fail before any immutable completion write'
);
select is((select count(*)::integer from public.personal_plan_portfolio_versions where source_product_draft_id = '40000000-0000-0000-0000-000000000002'), 0, 'oversized completion rolls back the portfolio write');
select is((select status from public.personal_plan_product_drafts where id = '40000000-0000-0000-0000-000000000002'), 'active', 'oversized completion preserves the editable draft');
select is(
  pg_temp.complete_draft('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 0, '{}'::jsonb, 4)->>'status',
  'completed',
  'the fresh source CAS token permits atomic stage completion'
);
select is((select status || ':' || observed_revision::text from public.personal_plan_routine_source_change_outbox where personal_plan_id='20000000-0000-0000-0000-000000000002' and source_key='unrelated-pending'), 'pending:3', 'completion does not acknowledge a newer coalesced unrelated pending outbox row');
select is((select status || ':' || lease_token::text from public.personal_plan_routine_source_change_outbox where personal_plan_id='20000000-0000-0000-0000-000000000002' and source_key='leased-source'), 'processing:80000000-0000-0000-0000-000000000002', 'completion preserves an unrelated processing lease');
select is((select processed_revision::text || ':' || available_at::text from public.personal_plan_routine_source_change_outbox where personal_plan_id='20000000-0000-0000-0000-000000000002' and source_kind='portfolio_version'), (select observed_revision::text || ':infinity' from public.personal_plan_routine_source_change_outbox where personal_plan_id='20000000-0000-0000-0000-000000000002' and source_kind='portfolio_version'), 'completion acknowledges only its exact new portfolio-version row and revision');
select is(
  public.personal_plan_confirm_routine_proposal(
    '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
    (select pending_routine_proposal_id from public.personal_plans where id = '20000000-0000-0000-0000-000000000001'), 1
  )->>'outcome',
  'accepted',
  'only explicit whole-proposal confirmation can activate the staged Routine'
);
select ok((select active_routine_version_id is not null and pending_routine_proposal_id is null from public.personal_plans where id = '20000000-0000-0000-0000-000000000001'), 'confirmation moves the active pointer and clears pending');
select is(
  public.personal_plan_confirm_routine_proposal(
    '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
    (select id from public.personal_plan_routine_proposals where personal_plan_id = '20000000-0000-0000-0000-000000000001'), 2
  )->>'outcome',
  'already_accepted',
  'confirmation replay remains idempotent'
);

select is(public.personal_plan_enqueue_routine_source_change('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'user_product', 'product-a'), 2::bigint, 'first trusted source change advances source revision after the evaluated Stage-3 baseline');
select is(public.personal_plan_enqueue_routine_source_change('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'user_product', 'product-a'), 3::bigint, 'repeated source facts advance the monotonic source revision');
select is((select count(*)::integer from public.personal_plan_routine_source_change_outbox where personal_plan_id = '20000000-0000-0000-0000-000000000001' and source_kind = 'user_product' and source_key = 'product-a'), 1, 'source changes coalesce into one durable outbox row');
select is((select observed_revision from public.personal_plan_routine_source_change_outbox where personal_plan_id = '20000000-0000-0000-0000-000000000001' and source_kind = 'user_product' and source_key = 'product-a'), 3::bigint, 'coalesced outbox rows retain the newest observed revision');
insert into public.personal_plan_routine_versions (
  id, user_id, personal_plan_id, source_refined_need_version_id, source_portfolio_version_id,
  source_product_draft_id, source_product_draft_revision, schema_version, compiler_version,
  authority_versions, source_fingerprint, payload_hash, payload
) values (
  '50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000002',
  (select id from public.personal_plan_portfolio_versions where source_product_draft_id = '40000000-0000-0000-0000-000000000001'),
  '40000000-0000-0000-0000-000000000001', 0, 1, 'test-compiler', '{}'::jsonb, 'new-source', repeat('1', 64), '{"steps":["successor"]}'::jsonb
);
insert into public.personal_plan_routine_proposals (
  id, user_id, personal_plan_id, base_routine_version_id, candidate_routine_version_id,
  origin, source_revision, source_fingerprint, proposal_fingerprint, delta
) values (
  '60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
  (select active_routine_version_id from public.personal_plans where id = '20000000-0000-0000-0000-000000000001'),
  '50000000-0000-0000-0000-000000000001', 'source_sync', 3, 'new-source', repeat('2', 64), '{"changed":["library"]}'::jsonb
);
update public.personal_plans set pending_routine_proposal_id = '60000000-0000-0000-0000-000000000001', revision = revision + 1
where id = '20000000-0000-0000-0000-000000000001';
select is(public.personal_plan_enqueue_routine_source_change('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'user_product', 'product-a'), 4::bigint, 'new source facts advance the source revision before successor confirmation');
select is(
  public.personal_plan_confirm_routine_proposal(
    '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 3
  )->>'outcome',
  'stale_source',
  'a successor proposal cannot activate after a newer source fact'
);
select is((select active_routine_version_id::text from public.personal_plans where id = '20000000-0000-0000-0000-000000000001'), (select base_routine_version_id::text from public.personal_plan_routine_proposals where id = '60000000-0000-0000-0000-000000000001'), 'stale proposal confirmation preserves the previous active Routine');

update public.personal_plan_routine_source_change_outbox
set available_at = now() + interval '1 hour'
where status = 'pending'
  and not (
    personal_plan_id = '20000000-0000-0000-0000-000000000001'
    and source_kind = 'user_product'
    and source_key = 'product-a'
  );
select is((select count(*)::integer from public.personal_plan_claim_routine_source_changes(1, 60)), 1, 'the outbox claim transition leases one due coalesced row');
select ok(
  public.personal_plan_finish_routine_source_change(
    (select id from public.personal_plan_routine_source_change_outbox where personal_plan_id = '20000000-0000-0000-0000-000000000001' and source_key = 'product-a'),
    (select lease_token from public.personal_plan_routine_source_change_outbox where personal_plan_id = '20000000-0000-0000-0000-000000000001' and source_key = 'product-a'),
    4
  ),
  'the outbox finisher accepts its current lease and observed revision'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select is((select count(*)::integer from public.personal_plans), 1, 'RLS exposes only the authenticated owner plan');
select is((select count(*)::integer from public.personal_plan_routine_proposals), 2, 'RLS exposes the authenticated owner proposals and hides proposals owned by other users');
select throws_ok(
  $$update public.personal_plans set revision = 99 where id = '20000000-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table personal_plans',
  'RLS grants no direct authenticated plan mutation'
);
reset role;

select throws_ok(
  $$update public.personal_plan_portfolio_versions set snapshot = '{"forged":true}'::jsonb where source_product_draft_id = '40000000-0000-0000-0000-000000000001'$$,
  '22000',
  'personal plan version rows are immutable',
  'immutable portfolio versions reject service-side update mistakes'
);
select throws_ok(
  $$delete from public.personal_plan_routine_versions where source_product_draft_id = '40000000-0000-0000-0000-000000000001'$$,
  '22000',
  'personal plan version rows are immutable',
  'immutable Routine versions reject service-side delete mistakes'
);

select lives_ok(
  $$select public.personal_plan_erase_owner_data('10000000-0000-0000-0000-000000000001')$$,
  'the privileged account-erasure step removes an owner aggregate in dependency order'
);
select is(
  (
    select count(*)::integer from (
      select user_id from public.personal_plans union all
      select user_id from public.personal_plan_need_versions union all
      select user_id from public.personal_plan_refinement_drafts union all
      select user_id from public.personal_plan_product_drafts union all
      select user_id from public.personal_plan_portfolio_versions union all
      select user_id from public.personal_plan_routine_versions union all
      select user_id from public.personal_plan_routine_proposals union all
      select user_id from public.personal_plan_routine_source_change_outbox union all
      select user_id from public.user_products
    ) owner_rows
    where user_id = '10000000-0000-0000-0000-000000000001'
  ),
  0,
  'account erasure leaves no owner-linked Personal Plan row'
);
select is(
  (select count(*)::integer from public.personal_plans where user_id = '10000000-0000-0000-0000-000000000002'),
  1,
  'account erasure preserves another owner aggregate'
);

select * from finish();

rollback;

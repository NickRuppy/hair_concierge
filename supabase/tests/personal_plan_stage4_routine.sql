begin;

select plan(56);

select has_function('public', 'personal_plan_complete_draft_activate_initial_v1', 'versioned first-Routine activation RPC exists');
select has_function('public', 'personal_plan_stage_routine_successor', 'successor staging RPC exists');
select has_function('public', 'personal_plan_reject_routine_proposal', 'proposal rejection RPC exists');
select has_function('public', 'personal_plan_record_routine_no_semantic_change', 'no-change RPC exists');
select ok(not has_function_privilege('authenticated', 'public.personal_plan_stage_routine_successor(uuid,uuid,uuid,bigint,bigint,uuid,uuid,uuid,bigint,integer,text,jsonb,text,jsonb,jsonb,text[],text)'::regprocedure, 'EXECUTE'), 'authenticated cannot stage successors');
select ok(not has_function_privilege('authenticated', 'public.personal_plan_complete_draft_activate_initial_v1(uuid,uuid,uuid,bigint,bigint,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb)'::regprocedure, 'EXECUTE'), 'authenticated cannot auto-activate an initial Routine');
select ok(not has_function_privilege('authenticated', 'public.personal_plan_reject_routine_proposal(uuid,uuid,uuid,bigint)'::regprocedure, 'EXECUTE'), 'authenticated cannot reject proposals');
select ok(not has_function_privilege('authenticated', 'public.personal_plan_record_routine_no_semantic_change(uuid,uuid,uuid,bigint,bigint,text)'::regprocedure, 'EXECUTE'), 'authenticated cannot record no-change results');
select ok(has_function_privilege('service_role', 'public.personal_plan_stage_routine_successor(uuid,uuid,uuid,bigint,bigint,uuid,uuid,uuid,bigint,integer,text,jsonb,text,jsonb,jsonb,text[],text)'::regprocedure, 'EXECUTE'), 'service role can stage successors');
select ok(has_function_privilege('service_role', 'public.personal_plan_complete_draft_activate_initial_v1(uuid,uuid,uuid,bigint,bigint,integer,jsonb,integer,text,jsonb,text,jsonb,jsonb)'::regprocedure, 'EXECUTE'), 'service role can auto-activate an initial Routine');
select ok(has_function_privilege('service_role', 'public.personal_plan_reject_routine_proposal(uuid,uuid,uuid,bigint)'::regprocedure, 'EXECUTE'), 'service role can reject proposals');
select ok(has_function_privilege('service_role', 'public.personal_plan_record_routine_no_semantic_change(uuid,uuid,uuid,bigint,bigint,text)'::regprocedure, 'EXECUTE'), 'service role can record no-change results');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at) values
  ('00000000-0000-0000-0000-000000000000', '11000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'routine-lifecycle-a@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'routine-lifecycle-b@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '11000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'routine-initial-activation@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
insert into public.leads (id, name, email, marketing_consent, quiz_answers, quiz_kind, user_id) values
  ('11100000-0000-0000-0000-000000000001', '', 'routine-lifecycle-a@example.invalid', false, '{}'::jsonb, 'legacy', '11000000-0000-0000-0000-000000000001'),
  ('11100000-0000-0000-0000-000000000002', '', 'routine-lifecycle-b@example.invalid', false, '{}'::jsonb, 'legacy', '11000000-0000-0000-0000-000000000002'),
  ('11100000-0000-0000-0000-000000000003', '', 'routine-initial-activation@example.invalid', false, '{}'::jsonb, 'legacy', '11000000-0000-0000-0000-000000000003');
insert into public.personal_plans (id, user_id, current_refined_need_version_id) values
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', null),
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', null),
  ('21000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000003', null);
insert into public.personal_plan_need_versions (
  id, user_id, personal_plan_id, kind, parent_need_version_id,
  prepared_artifact_source_id, stage1_source_kind, stage1_source_lead_id,
  schema_version, computation_version, input_hash, input_snapshot, output_snapshot
) values
  ('31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'initial', null, null, 'legacy_quiz_lead', '11100000-0000-0000-0000-000000000001', 1, 'test', repeat('1', 64), '{}'::jsonb, '{}'::jsonb),
  ('31000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'refined', '31000000-0000-0000-0000-000000000001', null, null, null, 1, 'test', repeat('2', 64), '{}'::jsonb, '{}'::jsonb),
  ('31000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'initial', null, null, 'legacy_quiz_lead', '11100000-0000-0000-0000-000000000002', 1, 'test', repeat('3', 64), '{}'::jsonb, '{}'::jsonb),
  ('31000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', 'refined', '31000000-0000-0000-0000-000000000003', null, null, null, 1, 'test', repeat('4', 64), '{}'::jsonb, '{}'::jsonb),
  ('31000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000003', 'initial', null, null, 'legacy_quiz_lead', '11100000-0000-0000-0000-000000000003', 1, 'test', repeat('5', 64), '{}'::jsonb, '{}'::jsonb),
  ('31000000-0000-0000-0000-000000000006', '11000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000003', 'refined', '31000000-0000-0000-0000-000000000005', null, null, null, 1, 'test', repeat('6', 64), '{}'::jsonb, '{}'::jsonb);
update public.personal_plans set current_refined_need_version_id = case id
  when '21000000-0000-0000-0000-000000000001'::uuid then '31000000-0000-0000-0000-000000000002'::uuid
  when '21000000-0000-0000-0000-000000000002'::uuid then '31000000-0000-0000-0000-000000000004'::uuid
  else '31000000-0000-0000-0000-000000000006'::uuid end;
insert into public.personal_plan_product_drafts (id, user_id, personal_plan_id, refined_need_version_id, contract_version, revision, status) values
  ('41000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002', 1, 1, 'completed'),
  ('41000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000004', 1, 1, 'completed'),
  ('41000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000006', 1, 0, 'active');
insert into public.personal_plan_portfolio_versions (id, user_id, personal_plan_id, refined_need_version_id, source_product_draft_id, source_product_draft_revision, schema_version, category_authority_versions, content_hash, snapshot) values
  ('42000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000001', 1, 1, '{}'::jsonb, repeat('5', 64), '{}'::jsonb),
  ('42000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000004', '41000000-0000-0000-0000-000000000002', 1, 1, '{}'::jsonb, repeat('6', 64), '{}'::jsonb);
insert into public.personal_plan_routine_versions (id, user_id, personal_plan_id, source_refined_need_version_id, source_portfolio_version_id, source_product_draft_id, source_product_draft_revision, schema_version, compiler_version, authority_versions, source_fingerprint, payload_hash, payload) values
  ('51000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 1, 1, 'test', '{}'::jsonb, 'active', repeat('7', 64), '{"steps":["active"]}'::jsonb);
update public.personal_plans set active_routine_version_id = '51000000-0000-0000-0000-000000000001' where id = '21000000-0000-0000-0000-000000000001';

-- This third plan stays draft-active so the additive first-Routine path can
-- be exercised without changing the legacy successor fixtures above.
insert into public.products (id, name, category, category_key, is_active, lifecycle_status, is_chaarlie_recommended) values
  ('71000000-0000-0000-0000-000000000001', 'Initial activation shampoo', 'Shampoo', 'shampoo', true, 'active', false);
insert into public.user_products (id, user_id, category, catalog_product_id, identity_status, ownership_status) values
  ('81000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000003', 'shampoo', '71000000-0000-0000-0000-000000000001', 'matched', 'owned');

create function pg_temp.complete_initial(p_source_revision bigint default null)
returns jsonb language sql as $$
  select public.personal_plan_complete_draft_activate_initial_v1(
    '11000000-0000-0000-0000-000000000003',
    '21000000-0000-0000-0000-000000000003',
    '41000000-0000-0000-0000-000000000003',
    0,
    coalesce(p_source_revision, (select source_revision from public.personal_plans where id = '21000000-0000-0000-0000-000000000003')),
    1,
    jsonb_build_object(
      'schemaVersion', 1,
      'personalPlanId', '21000000-0000-0000-0000-000000000003',
      'refinedVersionId', '31000000-0000-0000-0000-000000000006',
      'sourceDraftRevision', 0,
      'categoryResolutions', '[]'::jsonb,
      'ownedProducts', jsonb_build_array(jsonb_build_object(
        'userProductId', '81000000-0000-0000-0000-000000000001',
        'category', 'shampoo',
        'productId', '71000000-0000-0000-0000-000000000001'
      )),
      'plannedPurchases', '[]'::jsonb,
      'pendingProducts', '[]'::jsonb,
      'uncoveredRoles', '[]'::jsonb
    ),
    1,
    'test-initial-compiler',
    '{}'::jsonb,
    'initial-routine-source',
    '{"steps":["initial"]}'::jsonb,
    '{"changed":["initial"]}'::jsonb
  )
$$;

select is(pg_temp.complete_initial(0)->>'status', 'source_revision_conflict', 'first-Routine activation rejects a stale source CAS token');
select is((select count(*)::integer from public.personal_plan_portfolio_versions where source_product_draft_id = '41000000-0000-0000-0000-000000000003'), 0, 'stale initial activation writes no immutable portfolio or Routine');
select is((select status from public.personal_plan_product_drafts where id = '41000000-0000-0000-0000-000000000003'), 'active', 'stale initial activation preserves the editable draft');

-- Simulate source work that arrives after the compiled source token.  The
-- activation must settle only captured rows and leave newer work pending.
insert into public.personal_plan_routine_source_change_outbox (
  user_id, personal_plan_id, source_kind, source_key, observed_revision
) values (
  '11000000-0000-0000-0000-000000000003',
  '21000000-0000-0000-0000-000000000003',
  'user_product',
  'newer-source-work',
  (select source_revision + 1 from public.personal_plans where id = '21000000-0000-0000-0000-000000000003')
);

select is(pg_temp.complete_initial()->>'status', 'completed', 'first completed product draft activates its Routine atomically');
select is(
  (select active_routine_version_id::text from public.personal_plans where id = '21000000-0000-0000-0000-000000000003'),
  (select id::text from public.personal_plan_routine_versions where source_product_draft_id = '41000000-0000-0000-0000-000000000003'),
  'first activation returns the immutable Routine as the active pointer'
);
select ok((select pending_routine_proposal_id is null from public.personal_plans where id = '21000000-0000-0000-0000-000000000003'), 'first activation leaves no pending Routine confirmation');
select is((select count(*)::integer from public.personal_plan_routine_proposals where personal_plan_id = '21000000-0000-0000-0000-000000000003'), 0, 'first activation creates no Routine proposal');
select is((select status from public.personal_plan_product_drafts where id = '41000000-0000-0000-0000-000000000003'), 'completed', 'first activation completes its product draft');
select is(
  (select processed_revision::text || ':' || available_at::text from public.personal_plan_routine_source_change_outbox where personal_plan_id = '21000000-0000-0000-0000-000000000003' and source_key = '81000000-0000-0000-0000-000000000001'),
  '1:infinity',
  'first activation consumes the captured product source outbox row'
);
select is(
  (select status || ':' || processed_revision::text || ':' || observed_revision::text from public.personal_plan_routine_source_change_outbox where personal_plan_id = '21000000-0000-0000-0000-000000000003' and source_key = 'newer-source-work'),
  'pending:0:2',
  'first activation preserves newer source work for successor staging'
);
select is(pg_temp.complete_initial()->>'status', 'already_completed', 'lost-response replay returns the stable initial completion');
select is(
  pg_temp.complete_initial()->>'portfolioVersionId',
  (select id::text from public.personal_plan_portfolio_versions where source_product_draft_id = '41000000-0000-0000-0000-000000000003'),
  'initial completion replay retains its portfolio ID'
);
select is(
  pg_temp.complete_initial()->>'routineVersionId',
  (select active_routine_version_id::text from public.personal_plans where id = '21000000-0000-0000-0000-000000000003'),
  'initial completion replay retains its active Routine ID'
);

create function pg_temp.stage(p_payload jsonb default '{"steps":["next"]}'::jsonb, p_delta jsonb default '{"changed":["next"]}'::jsonb, p_origin text default 'source_sync', p_expected_active uuid default '51000000-0000-0000-0000-000000000001', p_expected_revision bigint default null, p_expected_source_revision bigint default null)
returns jsonb language sql as $$
  select public.personal_plan_stage_routine_successor('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', p_expected_active, coalesce(p_expected_revision, (select revision from public.personal_plans where id = '21000000-0000-0000-0000-000000000001')), coalesce(p_expected_source_revision, (select source_revision from public.personal_plans where id = '21000000-0000-0000-0000-000000000001')), '31000000-0000-0000-0000-000000000002', '42000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 1, 1, 'test', '{}'::jsonb, 'source-a', p_payload, p_delta, array['operation-a'], p_origin)
$$;

select is(pg_temp.stage()->>'outcome', 'staged', 'service lifecycle stages a successor without activation');
select ok((select pending_routine_proposal_id is not null from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'), 'staging sets the pending pointer');
select is((select active_routine_version_id::text from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'), '51000000-0000-0000-0000-000000000001', 'staging preserves the active Routine');
select is(pg_temp.stage()->>'outcome', 'already_staged', 'same semantic successor is idempotent');
select is((select count(*)::integer from public.personal_plan_routine_versions where personal_plan_id = '21000000-0000-0000-0000-000000000001'), 2, 'idempotent successor reuses its immutable candidate');
select is(pg_temp.stage('{"steps":["newer"]}'::jsonb, '{"changed":["newer"]}'::jsonb)->>'outcome', 'staged', 'a distinct successor stages');
select is((select status from public.personal_plan_routine_proposals where personal_plan_id = '21000000-0000-0000-0000-000000000001' order by created_at limit 1), 'superseded', 'a newer candidate supersedes the prior pending proposal');
select is((select count(*)::integer from public.personal_plan_routine_proposals where personal_plan_id = '21000000-0000-0000-0000-000000000001' and status = 'pending'), 1, 'only one successor proposal remains pending');
select is(public.personal_plan_reject_routine_proposal('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', (select pending_routine_proposal_id from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'), (select revision from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'))->>'outcome', 'rejected', 'current successor can be rejected');
select is((select active_routine_version_id::text from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'), '51000000-0000-0000-0000-000000000001', 'rejection preserves the active Routine byte-for-byte');
select ok((select pending_routine_proposal_id is null from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'), 'rejection clears the pending pointer');
select ok((select last_rejected_auto_fingerprint is not null from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'), 'automatic rejection records its semantic fingerprint');
select is(pg_temp.stage('{"steps":["newer"]}'::jsonb, '{"changed":["newer"]}'::jsonb)->>'outcome', 'suppressed_rejected', 'rejected automatic semantic output is suppressed');

insert into public.personal_plan_routine_versions (id, user_id, personal_plan_id, source_refined_need_version_id, source_portfolio_version_id, source_product_draft_id, source_product_draft_revision, schema_version, compiler_version, authority_versions, source_fingerprint, payload_hash, payload) values
  ('51000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000004', '42000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', 1, 1, 'test', '{}'::jsonb, 'initial', repeat('8', 64), '{"steps":["initial"]}'::jsonb);
insert into public.personal_plan_routine_proposals (id, user_id, personal_plan_id, base_routine_version_id, candidate_routine_version_id, origin, source_revision, source_fingerprint, proposal_fingerprint, delta) values
  ('61000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', null, '51000000-0000-0000-0000-000000000002', 'stage3_completion', 0, 'initial', repeat('9', 64), '{}'::jsonb);
update public.personal_plans set pending_routine_proposal_id = '61000000-0000-0000-0000-000000000001' where id = '21000000-0000-0000-0000-000000000002';
select is(public.personal_plan_reject_routine_proposal('11000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', 0)->>'outcome', 'initial_proposal_not_rejectable', 'initial proposal cannot be rejected before any active Routine');
select ok((select pending_routine_proposal_id = '61000000-0000-0000-0000-000000000001'::uuid from public.personal_plans where id = '21000000-0000-0000-0000-000000000002'), 'initial rejection denial preserves its pending proposal');

select is(public.personal_plan_record_routine_no_semantic_change('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', (select revision from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'), 0, 'evaluated-a')->>'outcome', 'no_semantic_change', 'no-change records an evaluated source fingerprint');
select is((select last_evaluated_source_fingerprint from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'), 'evaluated-a', 'no-change writes only the evaluated fingerprint');
select is((select revision from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'), 3::bigint, 'no-change does not increment the plan revision');
select is(public.personal_plan_enqueue_routine_source_change('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 'user_product', 'stale-test'), 1::bigint, 'source change advances the source revision');
select is(public.personal_plan_record_routine_no_semantic_change('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 3, 0, 'evaluated-b')->>'outcome', 'source_revision_conflict', 'stale source token is rejected');
select is(pg_temp.stage('{"steps":["stale"]}'::jsonb, '{}'::jsonb, 'editor', '51000000-0000-0000-0000-000000000099', 3, 1)->>'outcome', 'stale_active_version', 'stale active version is rejected');
select is(pg_temp.stage('{"steps":["stale"]}'::jsonb, '{}'::jsonb, 'editor', '51000000-0000-0000-0000-000000000001', 2, 1)->>'outcome', 'revision_conflict', 'stale plan revision is rejected');
select is(pg_temp.stage('{"steps":["editor-restage"]}'::jsonb, '{"changed":["editor-restage"]}'::jsonb, 'editor')->>'outcome', 'staged', 'editor proposal stages before re-stage regression');
select is(public.personal_plan_reject_routine_proposal('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', (select pending_routine_proposal_id from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'), (select revision from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'))->>'outcome', 'rejected', 'editor proposal can be rejected before identical re-stage');
select is(pg_temp.stage('{"steps":["editor-restage"]}'::jsonb, '{"changed":["editor-restage"]}'::jsonb, 'editor')->>'outcome', 'already_staged', 'identical rejected editor proposal is re-staged');
select is((select proposal.status from public.personal_plans plan join public.personal_plan_routine_proposals proposal on proposal.id = plan.pending_routine_proposal_id where plan.id = '21000000-0000-0000-0000-000000000001'), 'pending', 'pending pointer only references a pending re-staged proposal');
select is(public.personal_plan_reject_routine_proposal('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', (select pending_routine_proposal_id from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'), (select revision from public.personal_plans where id = '21000000-0000-0000-0000-000000000001'))->>'outcome', 'rejected', 're-staged editor proposal remains rejectable');
select is(public.personal_plan_stage_routine_successor('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002', null, 0, 0, '31000000-0000-0000-0000-000000000004', '42000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', 1, 1, 'test', '{}'::jsonb, 'foreign', '{}'::jsonb, '{}'::jsonb, '{}'::text[], 'editor')->>'outcome', 'invalid_source', 'foreign owner cannot stage another plan');

set role service_role;
select lives_ok($$select public.personal_plan_record_routine_no_semantic_change('11000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 3, 1, 'evaluated-service')$$, 'service role executes the lifecycle RPC path');
select throws_ok($$update public.personal_plan_routine_versions set payload = '{"forged":true}'::jsonb where id = '51000000-0000-0000-0000-000000000001'$$, '22000', 'personal plan version rows are immutable', 'immutable Routine versions reject service-role updates');
select throws_ok($$delete from public.personal_plan_routine_versions where id = '51000000-0000-0000-0000-000000000001'$$, '22000', 'personal plan version rows are immutable', 'immutable Routine versions reject service-role deletes');
reset role;

select * from finish();

rollback;

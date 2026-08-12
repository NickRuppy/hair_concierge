begin;
select plan(13);
select has_table('public', 'personal_plan_catalog_fact_evidence', 'fact evidence ledger exists');
select has_function('public', 'apply_personal_plan_exact_catalog_bundle_v1', array['text','text','text'], 'exact bundle executor exists');
select ok(not has_function_privilege('anon', 'public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text)', 'execute'), 'anon cannot apply a bundle');
select ok(not has_function_privilege('authenticated', 'public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text)', 'execute'), 'authenticated cannot apply a bundle');
select ok(has_function_privilege('service_role', 'public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text)', 'execute'), 'service role may apply a reviewed bundle');
create temporary table exact_bundle_fixture(bundle text not null, fingerprint text not null) on commit drop;

insert into public.products (
  id, name, brand, category, category_key, suitable_thicknesses,
  is_active, lifecycle_status, origin, is_chaarlie_recommended
) values (
  '22222222-2222-4222-8222-222222222222', 'Exact bundle fixture',
  'Fixture', 'Maske', 'mask', array['normal']::text[],
  true, 'active', 'curated', false
);
insert into public.product_mask_specs (
  product_id, weight, concentration, balance_direction, ingredient_flags
) values (
  '22222222-2222-4222-8222-222222222222', 'medium', 'medium', 'balanced', array[]::text[]
);

do $apply$
declare
  bundle_json jsonb := jsonb_build_object(
    'schema_version', 'personal-plan-exact-catalog-bundle-v1',
    'batch_id', 'S5-99-bundle-contract',
    'items', jsonb_build_array(jsonb_build_object(
      'product_id', '22222222-2222-4222-8222-222222222222',
      'product_name', 'Exact bundle fixture',
      'expected_current_category', 'mask',
      'target_category', 'mask',
      'facts', jsonb_build_object(
        'category', 'mask',
        'values', jsonb_build_object(
          'repair_support_level', 'medium',
          'functional_benefits', jsonb_build_array('shine')
        ),
        'sources', jsonb_build_array(jsonb_build_object(
          'label', 'Hersteller',
          'url', 'https://example.com/exact-mask',
          'text', 'Nach der Haarwaesche auftragen und ausspuelen.',
          'sourceType', 'manufacturer',
          'checkedAt', '2026-08-11'
        ))
      ),
      'protocols', jsonb_build_array(jsonb_build_object(
        'role', 'intensive_conditioning_mask',
        'cadence', null,
        'source', jsonb_build_object(
          'label', 'Hersteller',
          'url', 'https://example.com/exact-mask',
          'text', 'Nach der Haarwaesche auftragen und ausspuelen.',
          'sourceType', 'manufacturer',
          'checkedAt', '2026-08-11'
        ),
        'guidance_payload', jsonb_build_object(
          'schemaVersion', 1,
          'guidanceKey', 'exact-bundle-fixture',
          'protocolVersion', 1,
          'locale', 'de',
          'scope', jsonb_build_object(
            'kind', 'product',
            'category', 'mask',
            'productId', '22222222-2222-4222-8222-222222222222'
          ),
          'role', 'intensive_care',
          'applicationFamily', 'post_shampoo_rinse_out_mask',
          'compatibleDayTypes', jsonb_build_array('intensive_care_day'),
          'exactGuidanceRequired', true,
          'sequence', jsonb_build_object(
            'anchor', 'post_cleanse_rinse_off',
            'before', jsonb_build_array(),
            'after', jsonb_build_array('wet_cleanse'),
            'conflictsWith', jsonb_build_array()
          ),
          'requirements', jsonb_build_object(
            'requiredCatalogFacts', jsonb_build_array(),
            'requiredProtocolFacts', jsonb_build_array(),
            'requiredProfileFacts', jsonb_build_array()
          ),
          'protocolFacts', jsonb_build_object(
            'applicationArea', 'lengths_ends',
            'rinse', 'rinse_out',
            'contactTimeSeconds', null,
            'conditionerRelationship', 'replaces_conditioner',
            'reapplication', 'none',
            'amount', null,
            'cautions', jsonb_build_array()
          ),
          'steps', jsonb_build_array(
            jsonb_build_object(
              'stepKey', 'apply',
              'action', 'apply_product',
              'copyTemplateDe', 'In die Laengen geben.'
            ),
            jsonb_build_object(
              'stepKey', 'rinse',
              'action', 'rinse',
              'copyTemplateDe', 'Gruendlich ausspuelen.'
            )
          ),
          'evidence', jsonb_build_array(jsonb_build_object(
            'sourceUrl', 'https://example.com/exact-mask',
            'sourceType', 'manufacturer',
            'checkedAt', '2026-08-11'
          ))
        )
      ))
    ))
  );
  bundle text := bundle_json::text;
  fingerprint text := encode(extensions.digest(convert_to(bundle, 'UTF8'), 'sha256'), 'hex');
begin
  insert into exact_bundle_fixture(bundle, fingerprint) values (bundle, fingerprint);
  insert into public.product_application_protocols(
    product_id, category, role, cadence, application_stage, application_state,
    placement, contact_time_seconds, rinse_action, reapplication,
    instruction_modifiers, source_label, source_url, source_text, guidance_payload
  )
  select
    '22222222-2222-4222-8222-222222222222',
    'mask',
    bundle_json#>>'{items,0,protocols,0,role}',
    bundle_json#>'{items,0,protocols,0,cadence}',
    bundle_json#>>'{items,0,protocols,0,guidance_payload,sequence,anchor}',
    null,
    bundle_json#>>'{items,0,protocols,0,guidance_payload,protocolFacts,applicationArea}',
    null,
    bundle_json#>>'{items,0,protocols,0,guidance_payload,protocolFacts,rinse}',
    null,
    '[]'::jsonb,
    bundle_json#>>'{items,0,protocols,0,source,label}',
    bundle_json#>>'{items,0,protocols,0,source,url}',
    (
      select string_agg(step->>'copyTemplateDe', ' ' order by ordinality)
      from jsonb_array_elements(bundle_json#>'{items,0,protocols,0,guidance_payload,steps}')
        with ordinality as steps(step, ordinality)
    ),
    bundle_json#>'{items,0,protocols,0,guidance_payload}';
  perform * from public.apply_personal_plan_exact_catalog_bundle_v1(bundle, fingerprint, 'nick');
  perform * from public.apply_personal_plan_exact_catalog_bundle_v1(bundle, fingerprint, 'nick');
end;
$apply$;
set constraints all immediate;

select is((select repair_support_level from public.product_mask_specs where product_id='22222222-2222-4222-8222-222222222222'), 'medium', 'bundle writes exact Mask authority facts');
select is((select count(*)::integer from public.product_application_protocols where product_id='22222222-2222-4222-8222-222222222222' and role='intensive_conditioning_mask'), 1, 'bundle writes one exact canonical protocol');
select is((select count(*)::integer from public.personal_plan_catalog_fact_evidence where product_id='22222222-2222-4222-8222-222222222222'), 1, 'bundle records source-backed fact evidence once');
select is((select count(*)::integer from public.catalog_enrichment_applied_items where product_key='bundle:22222222-2222-4222-8222-222222222222'), 1, 'bundle replay keeps one guarded ledger item');
select is((select guidance_payload#>>'{scope,productId}' from public.product_application_protocols where product_id='22222222-2222-4222-8222-222222222222' and role='intensive_conditioning_mask'), '22222222-2222-4222-8222-222222222222', 'stored guidance remains scoped to the exact product');
select is((select source_text from public.product_application_protocols where product_id='22222222-2222-4222-8222-222222222222' and role='intensive_conditioning_mask'), 'Nach der Haarwaesche auftragen und ausspuelen.', 'bundle upgrades deterministic legacy Mask source text to the reviewed summary');
update public.product_application_protocols set source_text='Drifted protocol provenance' where product_id='22222222-2222-4222-8222-222222222222' and role='intensive_conditioning_mask';
select throws_ok(
  format(
    'select * from public.apply_personal_plan_exact_catalog_bundle_v1(%L,%L,%L)',
    (select bundle from exact_bundle_fixture),
    (select fingerprint from exact_bundle_fixture),
    'nick'
  ),
  'P0001',
  'exact catalog bundle protocol conflicts with existing authority: 22222222-2222-4222-8222-222222222222:intensive_conditioning_mask',
  'bundle replay rejects protocol source text drift'
);
update public.product_application_protocols set source_text='In die Laengen geben. Gruendlich ausspuelen.', source_label='Drifted label' where product_id='22222222-2222-4222-8222-222222222222' and role='intensive_conditioning_mask';
select throws_ok(
  format(
    'select * from public.apply_personal_plan_exact_catalog_bundle_v1(%L,%L,%L)',
    (select bundle from exact_bundle_fixture),
    (select fingerprint from exact_bundle_fixture),
    'nick'
  ),
  'P0001',
  'exact catalog bundle protocol conflicts with existing authority: 22222222-2222-4222-8222-222222222222:intensive_conditioning_mask',
  'legacy source text cannot bypass another immutable protocol conflict'
);
select * from finish();
rollback;

begin;
select plan(19);

select ok(
  not exists (
    select 1
    from public.products
    where id = 'c4b9eaef-dfeb-41ea-9d28-9901660406b7'
      and is_active = true
  ),
  'Bali overnight leave-on treatment is excluded from the active Mask cohort'
);
select is(
  (
    select name
    from public.products
    where id = 'd0e4bc78-2aeb-4e88-8abf-08aa28fbfba4'
  ),
  'Bali Curls Deep Repair Mask',
  'Bali moisture Mask uses its current canonical identity'
);
select ok(
  exists (
    select 1
    from public.product_identifiers
    where product_id = 'd0e4bc78-2aeb-4e88-8abf-08aa28fbfba4'
      and identifier_type = 'gtin'
      and normalized_identifier_value = '4262391990001'
  ),
  'Bali Deep Repair and legacy Deep Hydration resolve to one physical GTIN'
);
select ok(
  exists (
    select 1
    from public.product_identifiers
    where product_id = '29fc985e-3b7e-4567-b7bc-b416583139fe'
      and normalized_identifier_value = '4070765053357'
  ),
  'Balea reparierend points at the current German successor GTIN'
);
select ok(
  exists (
    select 1
    from public.product_identifiers
    where product_id = '077a94ae-fede-4773-9435-17022c2b89c0'
      and normalized_identifier_value = '8700216502672'
  ),
  'Pantene Mask points at the current retailer GTIN'
);
select ok(
  exists (
    select 1
    from public.product_identifiers
    where product_id = 'b2e7e679-a6ba-4ba3-93d7-1fd35f6e6c75'
      and normalized_identifier_value = '3600542510127'
  ),
  'Wahre Schaetze Mask points at the current retailer GTIN'
);
select is(
  (
    select name
    from public.products
    where id = '1568b623-f411-4ed6-a89f-e797bb1b48f5'
  ),
  'Alterra Intensiv Repair Haarmaske Feuchtigkeit',
  'Alterra Mask points at the current exact commercial product'
);
select ok(
  exists (
    select 1
    from public.product_identifiers
    where product_id = '1568b623-f411-4ed6-a89f-e797bb1b48f5'
      and normalized_identifier_value = '4068134014122'
  ),
  'Alterra Mask points at the current retailer GTIN'
);

select is(
  (
    select count(*)::integer
    from public.application_guidance_protocols
    where guidance_key in (
      'shampoo-standard-rinse-out-cleanse',
      'conditioner-standard-rinse-out-conditioning'
    )
      and protocol_version = 1
      and status = 'retired'
  ),
  2,
  'V1 wash-family protocols are retired without being rewritten'
);
select is(
  (
    select count(*)::integer
    from public.application_guidance_protocols
    where guidance_key in (
      'shampoo-standard-rinse-out-cleanse',
      'conditioner-standard-rinse-out-conditioning'
    )
      and protocol_version = 2
      and status = 'active'
  ),
  2,
  'V2 wash-family protocols are the active immutable authority'
);
select is(
  (
    select payload->'compatibleDayTypes'
    from public.application_guidance_protocols
    where guidance_key = 'shampoo-standard-rinse-out-cleanse'
      and protocol_version = 2
  ),
  '["wash_day","intensive_care_day","bond_repair_day"]'::jsonb,
  'ordinary Shampoo guidance covers every composite day that uses it'
);
select is(
  (
    select payload->'compatibleDayTypes'
    from public.application_guidance_protocols
    where guidance_key = 'conditioner-standard-rinse-out-conditioning'
      and protocol_version = 2
  ),
  '["wash_day","intensive_care_day","bond_repair_day","clarifying_wash_day"]'::jsonb,
  'ordinary Conditioner guidance covers every composite day that uses it'
);

select has_column(
  'public',
  'product_application_protocols',
  'guidance_payload',
  'exact product protocols store canonical Stage 5 guidance'
);
select has_function(
  'public',
  'apply_personal_plan_stage5_protocol_batch_v1',
  array['text', 'text', 'text'],
  'guarded Stage 5 protocol executor exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.apply_personal_plan_stage5_protocol_batch_v1(text,text,text)',
    'execute'
  ),
  'anon cannot execute the protocol batch'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.apply_personal_plan_stage5_protocol_batch_v1(text,text,text)',
    'execute'
  ),
  'authenticated users cannot execute the protocol batch'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.apply_personal_plan_stage5_protocol_batch_v1(text,text,text)',
    'execute'
  ),
  'service role can execute the reviewed protocol batch'
);

insert into public.products (
  id,
  name,
  brand,
  category,
  category_key,
  is_active,
  lifecycle_status,
  origin,
  is_chaarlie_recommended
) values (
  '11111111-1111-4111-8111-111111111111',
  'Stage 5 protocol fixture',
  'Fixture',
  'Shampoo',
  'shampoo',
  true,
  'active',
  'curated',
  true
);

do $apply$
declare
  batch text := '{"batch_id":"S5-99-contract-test","protocols":[{"cadence":null,"category_key":"shampoo","guidance_payload":{"applicationFamily":"targeted_treatment_shampoo","compatibleDayTypes":["wash_day"],"evidence":[{"checkedAt":"2026-08-10","sourceType":"manufacturer","sourceUrl":"https://example.com/fixture"}],"exactGuidanceRequired":true,"guidanceKey":"stage5-contract-fixture","locale":"de","protocolFacts":{"amount":null,"applicationArea":"scalp_roots","cautions":[],"conditionerRelationship":"not_applicable","contactTimeSeconds":null,"reapplication":"none","rinse":"rinse_out"},"protocolVersion":1,"requirements":{"requiredCatalogFacts":[],"requiredProfileFacts":[],"requiredProtocolFacts":[]},"role":"cleanse","schemaVersion":1,"scope":{"category":"shampoo","kind":"product","productId":"11111111-1111-4111-8111-111111111111"},"sequence":{"after":[],"anchor":"wet_cleanse","before":[],"conflictsWith":[]},"steps":[{"action":"apply_product","copyTemplateDe":"Sanft auf die nasse Kopfhaut geben.","stepKey":"apply"},{"action":"rinse","copyTemplateDe":"Gründlich ausspülen.","stepKey":"rinse"}]},"product_id":"11111111-1111-4111-8111-111111111111","product_name":"Stage 5 protocol fixture","role":"shampoo_dandruff","source_label":"Fixture source","source_text":"Sanft anwenden und ausspülen.","source_url":"https://example.com/fixture"}],"schema_version":"personal-plan-stage5-protocol-apply-v1"}';
begin
  perform * from public.apply_personal_plan_stage5_protocol_batch_v1(
    batch,
    encode(extensions.digest(convert_to(batch, 'UTF8'), 'sha256'), 'hex'),
    'nick'
  );
  perform * from public.apply_personal_plan_stage5_protocol_batch_v1(
    batch,
    encode(extensions.digest(convert_to(batch, 'UTF8'), 'sha256'), 'hex'),
    'nick'
  );
end;
$apply$;

select is(
  (
    select count(*)::integer
    from public.product_application_protocols
    where product_id = '11111111-1111-4111-8111-111111111111'
      and category = 'shampoo'
      and role = 'shampoo_dandruff'
  ),
  1,
  'reviewed exact protocol inserts once and replay remains idempotent'
);
select is(
  (
    select guidance_payload#>>'{scope,productId}'
    from public.product_application_protocols
    where product_id = '11111111-1111-4111-8111-111111111111'
      and role = 'shampoo_dandruff'
  ),
  '11111111-1111-4111-8111-111111111111',
  'stored canonical guidance remains scoped to the exact product'
);

select * from finish();
rollback;

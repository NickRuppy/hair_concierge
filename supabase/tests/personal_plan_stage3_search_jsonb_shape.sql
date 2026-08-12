begin;

select plan(3);

-- Production data predates the typed authority columns. Model malformed legacy
-- JSON shapes directly so the catalog-wide CTE cannot take down unrelated search.
alter table public.product_leave_in_specs
  drop constraint if exists product_leave_in_specs_plan_roles_check;
alter table public.product_leave_in_specs
  alter column plan_roles type jsonb using to_jsonb(plan_roles);
alter table public.product_oil_specs
  drop constraint if exists product_oil_specs_role_support_check;
alter table public.product_oil_specs
  alter column role_support type jsonb using to_jsonb(role_support);

insert into public.product_categories (
  key, display_name_de, is_catalog_supported, is_intake_supported, sort_order
)
values
  ('leave_in', 'Leave-in', true, true, 40),
  ('oil', 'Öl', true, true, 50)
on conflict (key) do nothing;

insert into public.products (
  id, name, brand, category, affiliate_link, is_active, lifecycle_status,
  category_key, origin, is_chaarlie_recommended, suitable_thicknesses,
  purchase_link_status
)
values
  ('99999999-0000-4000-8000-000000000001', 'OGX Regression Shampoo', 'OGX', 'shampoo', 'https://example.invalid/ogx-shampoo', true, 'active', 'shampoo', 'curated', true, array['normal'], 'available'),
  ('99999999-0000-4000-8000-000000000002', 'Malformed Leave-in', 'Test', 'leave_in', 'https://example.invalid/leave-in', true, 'active', 'leave_in', 'curated', true, array['normal'], 'available'),
  ('99999999-0000-4000-8000-000000000003', 'Malformed Oil', 'Test', 'oil', 'https://example.invalid/oil', true, 'active', 'oil', 'curated', true, array['normal'], 'available');

insert into public.product_shampoo_specs (
  product_id, thickness, shampoo_bucket, scalp_route, cleansing_intensity
)
values ('99999999-0000-4000-8000-000000000001', 'normal', 'normal', 'balanced', 'gentle');

insert into public.product_leave_in_specs (
  product_id, format, weight, care_direction, repair_support_level,
  plan_roles, functional_benefits
)
values (
  '99999999-0000-4000-8000-000000000002', 'spray', 'light', 'moisture', 'low',
  '"post_wash_leave_in"'::jsonb, array['detangle']
);

insert into public.product_oil_specs (product_id, weight, role_support)
values (
  '99999999-0000-4000-8000-000000000003', 'light',
  '{"role":"dry_finish"}'::jsonb
);

select lives_ok(
  $$select * from public.personal_plan_search_assessment_products_v2(
    '00000000-0000-4000-8000-000000000000', 'shampoo', 'ogx', '{}'::jsonb, 8
  )$$,
  'malformed Leave-in and Oil roles do not crash an unrelated OGX shampoo search'
);

select is(
  (select assessment_status from public.personal_plan_search_assessment_products_v2(
    '00000000-0000-4000-8000-000000000000', 'leave_in', 'malformed', '{}'::jsonb, 8
  ) where product_id = '99999999-0000-4000-8000-000000000002'),
  'pending_analysis',
  'a scalar Leave-in role is fail-closed rather than considered ready'
);

select is(
  (select assessment_status from public.personal_plan_search_assessment_products_v2(
    '00000000-0000-4000-8000-000000000000', 'oil', 'malformed', '{}'::jsonb, 8
  ) where product_id = '99999999-0000-4000-8000-000000000003'),
  'pending_analysis',
  'a non-array Oil role is fail-closed rather than considered ready'
);

select * from finish();

rollback;

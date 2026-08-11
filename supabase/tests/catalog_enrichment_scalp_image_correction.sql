begin;
select plan(25);

select has_table('public', 'catalog_enrichment_image_corrections', 'image correction has a dedicated receipt ledger');
select ok((select relrowsecurity from pg_catalog.pg_class where oid = 'public.catalog_enrichment_image_corrections'::regclass), 'image correction ledger has RLS');
select ok(not has_table_privilege('authenticated', 'public.catalog_enrichment_image_corrections', 'select, insert, update, delete'), 'authenticated cannot access image correction ledger');
select ok(not has_table_privilege('anon', 'public.catalog_enrichment_image_corrections', 'select, insert, update, delete'), 'anon cannot access image correction ledger');
select ok(not has_table_privilege('service_role', 'public.catalog_enrichment_image_corrections', 'insert, update, delete'), 'service role cannot directly mutate image correction ledger');
select ok(has_function_privilege('service_role', 'public.apply_catalog_enrichment_scalp_image_correction_v1(text,text)'::regprocedure, 'execute'), 'service role can execute image correction RPC');
select ok(not has_function_privilege('authenticated', 'public.apply_catalog_enrichment_scalp_image_correction_v1(text,text)'::regprocedure, 'execute'), 'authenticated cannot execute image correction RPC');
select ok(not has_function_privilege('anon', 'public.apply_catalog_enrichment_scalp_image_correction_v1(text,text)'::regprocedure, 'execute'), 'anon cannot execute image correction RPC');
select ok((select prosecdef from pg_catalog.pg_proc where oid = 'public.apply_catalog_enrichment_scalp_image_correction_v1(text,text)'::regprocedure), 'image correction RPC is SECURITY DEFINER');
select ok((select 'search_path=""' = any(proconfig) from pg_catalog.pg_proc where oid = 'public.apply_catalog_enrichment_scalp_image_correction_v1(text,text)'::regprocedure), 'image correction RPC has an empty search path');

insert into public.products (
  id, name, brand, category, image_url, category_key, origin, is_active,
  lifecycle_status, is_chaarlie_recommended
) values
  (
    '58aa2f19-b23a-4e09-ab0f-68c359371c9e',
    'Multi-Peptide Serum for Hair Density', 'The Ordinary', 'scalp_care',
    'https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-enrichment/personal-plan-launch-v1/scalp/the-ordinary-multi-peptide-hair-density-serum/the-ordinary-multi-peptide-hair-density-serum-6bb9be89b327.webp',
    'scalp_care', 'curated', true, 'active', true
  ),
  (
    '58aa2f19-b23a-4e09-ab0f-68c359371c9f',
    'Isolation product', 'Control', 'scalp_care', 'https://example.test/control-old.webp',
    'scalp_care', 'curated', true, 'active', true
  );

insert into public.product_image_assets (
  product_id, storage_bucket, storage_path, public_url, source_page_url,
  source_image_url, source_type, quality_confidence, processing_method,
  asset_sha256, manifest_batch_id, user_approved, notes
) values
  (
    '58aa2f19-b23a-4e09-ab0f-68c359371c9e', 'product-images',
    'catalog-enrichment/personal-plan-launch-v1/scalp/the-ordinary-multi-peptide-hair-density-serum/the-ordinary-multi-peptide-hair-density-serum-6bb9be89b327.webp',
    'https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-enrichment/personal-plan-launch-v1/scalp/the-ordinary-multi-peptide-hair-density-serum/the-ordinary-multi-peptide-hair-density-serum-6bb9be89b327.webp',
    'https://theordinary.com/de-de/multi-peptide-serum-for-hair-density-hair-scalp-treatment-100434.html',
    'https://theordinary.com/example.png', 'brand', 'high', 'local',
    '6bb9be89b327984d4fe8f95c8009896bfec386f04dbf544a208e78268079dd5c',
    'personal-plan-launch-v1', true, 'approved source metadata must survive image replacement'
  ),
  (
    '58aa2f19-b23a-4e09-ab0f-68c359371c9f', 'product-images',
    'control-old.webp', 'https://example.test/control-old.webp',
    'https://example.test/control', null, 'brand', 'high', 'local',
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'control', true, 'must remain untouched'
  );

insert into public.catalog_enrichment_applied_items (
  batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
) values (
  'personal-plan-scalp-launch-v1',
  'the-ordinary-multi-peptide-hair-density-serum',
  'e6cbbe9ce2dc3d3b29655741cfe7572dd29d8b5bb5bea1a7225fd58359328e50',
  '10fbf543434519912f702856b25742c418df5782f5de06472be27a79d51fb6e7',
  '58aa2f19-b23a-4e09-ab0f-68c359371c9e', 'nick'
);

delete from public.catalog_enrichment_applied_items
where batch_id = 'personal-plan-scalp-launch-v1'
  and product_key = 'the-ordinary-multi-peptide-hair-density-serum';
select throws_ok(
  $$select * from public.apply_catalog_enrichment_scalp_image_correction_v1('31211abbdd19464bd9d2d151c59e239279909769e2f1ea8e2737bf60d6e29828', 'nick')$$,
  null,
  'Scalp image correction prerequisite launch receipt is missing or divergent',
  'missing frozen launch receipt fails closed at the database boundary'
);
insert into public.catalog_enrichment_applied_items (
  batch_id, product_key, batch_fingerprint, content_fingerprint, product_id, reviewed_by
) values (
  'personal-plan-scalp-launch-v1',
  'the-ordinary-multi-peptide-hair-density-serum',
  'e6cbbe9ce2dc3d3b29655741cfe7572dd29d8b5bb5bea1a7225fd58359328e50',
  '10fbf543434519912f702856b25742c418df5782f5de06472be27a79d51fb6e7',
  '58aa2f19-b23a-4e09-ab0f-68c359371c9e', 'nick'
);

update public.products set brand = 'Unexpected' where id = '58aa2f19-b23a-4e09-ab0f-68c359371c9e';
select throws_ok(
  $$select * from public.apply_catalog_enrichment_scalp_image_correction_v1('31211abbdd19464bd9d2d151c59e239279909769e2f1ea8e2737bf60d6e29828', 'nick')$$,
  null,
  'Scalp image correction target product is missing or divergent',
  'divergent target identity fails closed at the database boundary'
);
update public.products set brand = 'The Ordinary' where id = '58aa2f19-b23a-4e09-ab0f-68c359371c9e';

update public.product_image_assets
set storage_path = 'unexpected.webp'
where product_id = '58aa2f19-b23a-4e09-ab0f-68c359371c9e';
select throws_ok(
  $$select * from public.apply_catalog_enrichment_scalp_image_correction_v1('31211abbdd19464bd9d2d151c59e239279909769e2f1ea8e2737bf60d6e29828', 'nick')$$,
  null,
  'Scalp image correction target state is not the approved old asset',
  'non-old fresh provenance fails closed at the database boundary'
);
update public.product_image_assets
set storage_path = 'catalog-enrichment/personal-plan-launch-v1/scalp/the-ordinary-multi-peptide-hair-density-serum/the-ordinary-multi-peptide-hair-density-serum-6bb9be89b327.webp'
where product_id = '58aa2f19-b23a-4e09-ab0f-68c359371c9e';

select throws_ok(
  $$select * from public.apply_catalog_enrichment_scalp_image_correction_v1('31211abbdd19464bd9d2d151c59e239279909769e2f1ea8e2737bf60d6e29828', 'not-nick')$$,
  null,
  'Scalp image correction reviewer must be nick',
  'an unapproved reviewer cannot apply the correction'
);
select throws_ok(
  $$select * from public.apply_catalog_enrichment_scalp_image_correction_v1('31211abbdd19464bd9d2d151c59e239279909769e2f1ea8e2737bf60d6e29828', null)$$,
  null,
  'Scalp image correction reviewer must be nick',
  'a null reviewer cannot bypass confirmation'
);
select throws_ok(
  $$select * from public.apply_catalog_enrichment_scalp_image_correction_v1(null, 'nick')$$,
  null,
  'Scalp image correction fingerprint must be lowercase sha256',
  'a null fingerprint cannot bypass confirmation'
);
select is(
  (select image_url from public.products where id = '58aa2f19-b23a-4e09-ab0f-68c359371c9e'),
  'https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-enrichment/personal-plan-launch-v1/scalp/the-ordinary-multi-peptide-hair-density-serum/the-ordinary-multi-peptide-hair-density-serum-6bb9be89b327.webp',
  'rejected preflight leaves the target product unchanged'
);
select is(
  (select apply_state from public.apply_catalog_enrichment_scalp_image_correction_v1('31211abbdd19464bd9d2d151c59e239279909769e2f1ea8e2737bf60d6e29828', 'nick')),
  'applied',
  'first exact correction applies'
);
select is(
  (select image_url from public.products where id = '58aa2f19-b23a-4e09-ab0f-68c359371c9e'),
  'https://pqdkhefxsxkyeqelqegq.supabase.co/storage/v1/object/public/product-images/catalog-enrichment/personal-plan-launch-v1/scalp/the-ordinary-multi-peptide-hair-density-serum/the-ordinary-multi-peptide-hair-density-serum-1a79af996795.webp',
  'first apply updates only the target product image URL'
);
select ok(exists(
  select 1 from public.product_image_assets
  where product_id = '58aa2f19-b23a-4e09-ab0f-68c359371c9e'
    and storage_path = 'catalog-enrichment/personal-plan-launch-v1/scalp/the-ordinary-multi-peptide-hair-density-serum/the-ordinary-multi-peptide-hair-density-serum-1a79af996795.webp'
    and asset_sha256 = '1a79af996795ea031e0a28b0220d37109950e0aed1a1175bb358e944efdbbc66'
    and source_page_url = 'https://theordinary.com/de-de/multi-peptide-serum-for-hair-density-hair-scalp-treatment-100434.html'
    and source_type = 'brand'
    and quality_confidence = 'high'
    and processing_method = 'local'
    and manifest_batch_id = 'personal-plan-scalp-the-ordinary-image-correction-v1'
    and user_approved is true
), 'first apply updates target provenance to the exact reviewed replacement');
select is((select count(*)::integer from public.catalog_enrichment_image_corrections), 1, 'first apply writes one correction receipt');
select is((select image_url from public.products where id = '58aa2f19-b23a-4e09-ab0f-68c359371c9f'), 'https://example.test/control-old.webp', 'first apply does not change an unrelated product');
select is(
  (select apply_state from public.apply_catalog_enrichment_scalp_image_correction_v1('31211abbdd19464bd9d2d151c59e239279909769e2f1ea8e2737bf60d6e29828', 'nick')),
  'already_applied',
  'exact replay is a no-op'
);
select throws_ok(
  $$select * from public.apply_catalog_enrichment_scalp_image_correction_v1('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'nick')$$,
  null,
  'Scalp image correction fingerprint is not approved',
  'unapproved fingerprint cannot target the correction RPC'
);
update public.products
set image_url = 'https://example.test/tampered.webp'
where id = '58aa2f19-b23a-4e09-ab0f-68c359371c9e';
select throws_ok(
  $$select * from public.apply_catalog_enrichment_scalp_image_correction_v1('31211abbdd19464bd9d2d151c59e239279909769e2f1ea8e2737bf60d6e29828', 'nick')$$,
  null,
  'Scalp image correction conflicting or partial replay',
  'divergent replay fails closed'
);

select * from finish();
rollback;

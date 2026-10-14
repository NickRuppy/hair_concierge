-- READ-ONLY schema capture for the Slice 1 PGlite rehearsal (prod pqdkhefxsxkyeqelqegq,
-- captured 2026-10-09T21:06Z after #654/#655 reached prod; recaptured 2026-10-11T13:52Z after #660 step 1
-- reached prod: object-by-object md5 matched except the relaxed bondbuilder_research_contract_v1). Output (~1.9 MB, every public table/function) is reduced by
-- capture/build-schema-fixture.mjs to the closure the migration touches and
-- committed as fixtures/prod-schema-2026-10-11.json.
SELECT jsonb_build_object(
 'captured_at', to_jsonb(now()),
 'server_version', current_setting('server_version'),
 'migrations', (SELECT jsonb_agg(jsonb_build_array(version, name) ORDER BY version) FROM supabase_migrations.schema_migrations),
 'product_categories', (SELECT jsonb_agg(to_jsonb(c) ORDER BY c.key) FROM public.product_categories c),
 'tables', (SELECT jsonb_agg(jsonb_build_object('name', c.relname,
   'columns', (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'notnull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'generated',a.attgenerated) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
   'constraints', (SELECT jsonb_agg(jsonb_build_object('name',conname,'type',contype,'def',pg_get_constraintdef(oid)) ORDER BY contype, conname) FROM pg_constraint WHERE conrelid=c.oid),
   'indexes', (SELECT jsonb_agg(pg_get_indexdef(indexrelid) ORDER BY indexrelid) FROM pg_index i WHERE indrelid=c.oid AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid=i.indexrelid)),
   'triggers', (SELECT jsonb_agg(pg_get_triggerdef(t.oid) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)) ORDER BY c.relname)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p')),
 'functions', (SELECT jsonb_agg(jsonb_build_object('name',p.proname,'args',pg_get_function_identity_arguments(p.oid),'def',pg_get_functiondef(p.oid)) ORDER BY p.proname, p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','private') AND p.prokind='f' AND NOT EXISTS (SELECT 1 FROM pg_depend dp WHERE dp.objid=p.oid AND dp.deptype='e'))
) AS schema;

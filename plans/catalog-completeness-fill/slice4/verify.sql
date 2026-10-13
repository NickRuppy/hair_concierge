-- Slice 4 verify (read-only). Zero rows = the generated postimage is in place.
-- Batch S4-catalog-completeness-aveda-damage-cadence, fingerprint 92dcb1acf4b736765167ad1f1bdd98cc30307d106d0c07991532f60272fda4f0.
WITH expected AS (
  SELECT 'f8d9cf57-9266-465a-8f09-d603e5065701'::uuid AS protocol_id, '04a83f16-e610-4883-b44d-038d3a343787'::uuid AS product_id,
    $json${"kind":"damage_branched","branches":[{"structural_levels":["moderate"],"copy_de":"Einmal pro Woche anwenden.","maintenance":{"kind":"times_per_week","minimum":1,"maximum":1},"source_ids":["C03-P07-1"]},{"structural_levels":["high","severe"],"copy_de":"An jedem Waschtag anwenden.","maintenance":{"kind":"every_n_washes","minimum":1,"maximum":1},"source_ids":["C03-P07-1"]}],"source_ids":["C03-P07-1"],"binding_ruling":"decisions.md B1/D-b (Nick, 2026-10-09)"}$json$::jsonb AS cadence
)
SELECT 'protocol_cadence' AS check_name FROM expected x
WHERE NOT EXISTS (SELECT 1 FROM public.product_application_protocols p
  WHERE p.id = x.protocol_id AND p.product_id = x.product_id AND p.cadence = x.cadence)
UNION ALL
SELECT 'evidence' FROM expected x
WHERE (SELECT count(*) FROM public.personal_plan_catalog_fact_evidence e
  WHERE e.product_id = x.product_id AND e.batch_id = 'S4-catalog-completeness-aveda-damage-cadence'
    AND e.fact_key = 'bondbuilder.protocol.cadence'
    AND e.content_fingerprint = '92dcb1acf4b736765167ad1f1bdd98cc30307d106d0c07991532f60272fda4f0') <> 1
UNION ALL
SELECT 'receipt' FROM expected x
WHERE (SELECT count(*) FROM public.catalog_enrichment_applied_items r
  WHERE r.batch_id = 'S4-catalog-completeness-aveda-damage-cadence' AND r.product_id = x.product_id
    AND r.content_fingerprint = '92dcb1acf4b736765167ad1f1bdd98cc30307d106d0c07991532f60272fda4f0' AND r.reviewed_by = 'nick') <> 1
UNION ALL
SELECT 'curated_facts_ready' FROM expected x
WHERE NOT public.bondbuilder_curated_facts_ready_v1(x.product_id)
UNION ALL
SELECT 'only_damage_branched_row' FROM expected x
WHERE (SELECT count(*) FROM public.product_application_protocols p
  WHERE p.cadence->>'kind' = 'damage_branched') <> 1;

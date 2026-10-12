-- Slice 4 rollback (prepared, NOT a migration). Reverses exactly the generated batch
-- S4-catalog-completeness-aveda-damage-cadence (fingerprint 92dcb1acf4b736765167ad1f1bdd98cc30307d106d0c07991532f60272fda4f0); refuses if anything else moved.
BEGIN;
-- Immediate checks: the updated_at trigger can only be suspended with no pending trigger events.
SET CONSTRAINTS ALL IMMEDIATE;
DO $slice4_rollback$
DECLARE
  v_product constant uuid := '04a83f16-e610-4883-b44d-038d3a343787';
  v_protocol constant uuid := 'f8d9cf57-9266-465a-8f09-d603e5065701';
  v_batch constant text := 'S4-catalog-completeness-aveda-damage-cadence';
  v_product_key constant text := 'P07';
  v_fingerprint constant text := '92dcb1acf4b736765167ad1f1bdd98cc30307d106d0c07991532f60272fda4f0';
  v_cadence constant jsonb := $json${"kind":"damage_branched","branches":[{"structural_levels":["moderate"],"copy_de":"Einmal pro Woche anwenden.","maintenance":{"kind":"times_per_week","minimum":1,"maximum":1},"source_ids":["C03-P07-1"]},{"structural_levels":["high","severe"],"copy_de":"An jedem Waschtag anwenden.","maintenance":{"kind":"every_n_washes","minimum":1,"maximum":1},"source_ids":["C03-P07-1"]}],"source_ids":["C03-P07-1"],"binding_ruling":"decisions.md B1/D-b (Nick, 2026-10-09)"}$json$::jsonb;
  v_fact_value constant jsonb := $json${"protocol_id":"f8d9cf57-9266-465a-8f09-d603e5065701","cadence":{"kind":"damage_branched","branches":[{"structural_levels":["moderate"],"copy_de":"Einmal pro Woche anwenden.","maintenance":{"kind":"times_per_week","minimum":1,"maximum":1},"source_ids":["C03-P07-1"]},{"structural_levels":["high","severe"],"copy_de":"An jedem Waschtag anwenden.","maintenance":{"kind":"every_n_washes","minimum":1,"maximum":1},"source_ids":["C03-P07-1"]}],"source_ids":["C03-P07-1"],"binding_ruling":"decisions.md B1/D-b (Nick, 2026-10-09)"},"binding":"data/research/bondbuilder-inci/v1.0/s4-aveda-cadence-binding/aveda-damage-binding.json","profile_sha256":"293275baa809e81344ba17652202aec67585f850561a7726b6c9bb0ceabc6ca0","ruling":"decisions.md B1/D-b (Nick, 2026-10-09)"}$json$::jsonb;
  v_rows integer;
BEGIN
  LOCK TABLE public.product_application_protocols, public.personal_plan_catalog_fact_evidence,
    public.catalog_enrichment_applied_items IN SHARE ROW EXCLUSIVE MODE;
  PERFORM 1 FROM public.product_application_protocols WHERE id = v_protocol FOR UPDATE;
  IF NOT EXISTS (
      SELECT 1 FROM public.catalog_enrichment_applied_items r
      WHERE r.batch_id = v_batch AND r.product_key = v_product_key AND r.product_id = v_product
        AND r.reviewed_by = 'nick' AND r.batch_fingerprint = v_fingerprint
        AND r.content_fingerprint = v_fingerprint)
    OR NOT EXISTS (
      SELECT 1 FROM public.personal_plan_catalog_fact_evidence e
      WHERE e.product_id = v_product AND e.fact_key = 'bondbuilder.protocol.cadence'
        AND e.source_url = 'https://www.aveda.de/product/botanical-repair-bond-building-pre-shampoo-treatment' AND e.fact_value = v_fact_value
        AND e.source_label = 'Aveda Hersteller-Produktseite (DE), Rulings B1/D-b'
        AND e.source_text = '"For mild-to-moderate damage, use weekly; for moderate-to-severe damage, use each wash day." (profile source C03-P07-1; decisions.md B1/D-b (Nick, 2026-10-09))'
        AND e.source_type = 'manufacturer'
        AND e.checked_at = DATE '2026-10-06'
        AND e.batch_id = v_batch AND e.batch_fingerprint = v_fingerprint
        AND e.content_fingerprint = v_fingerprint)
    OR (SELECT cadence FROM public.product_application_protocols WHERE id = v_protocol)
      IS DISTINCT FROM v_cadence
    -- A later revision of the row (its stamp moved past the apply) is never undone.
    OR (SELECT updated_at FROM public.product_application_protocols WHERE id = v_protocol)
      IS DISTINCT FROM (SELECT r.created_at FROM public.catalog_enrichment_applied_items r
                        WHERE r.batch_id = v_batch AND r.product_key = v_product_key) THEN
    RAISE EXCEPTION 'S4 Aveda cadence rollback: postimage not in place';
  END IF;
  -- Restore the captured stamp too: only this table's updated_at trigger is suspended, inside
  -- this transaction (Slice 1 precedent).
  ALTER TABLE public.product_application_protocols DISABLE TRIGGER set_updated_at_product_application_protocols;
  UPDATE public.product_application_protocols
     SET cadence = NULL, updated_at = '2026-10-07T09:52:51.582864+00:00'::timestamptz
   WHERE id = v_protocol AND cadence = v_cadence;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  ALTER TABLE public.product_application_protocols ENABLE TRIGGER set_updated_at_product_application_protocols;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'S4 Aveda cadence rollback write count %', v_rows; END IF;
  DELETE FROM public.personal_plan_catalog_fact_evidence WHERE product_id = v_product AND batch_id = v_batch;
  DELETE FROM public.catalog_enrichment_applied_items WHERE batch_id = v_batch;
END;
$slice4_rollback$;
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;

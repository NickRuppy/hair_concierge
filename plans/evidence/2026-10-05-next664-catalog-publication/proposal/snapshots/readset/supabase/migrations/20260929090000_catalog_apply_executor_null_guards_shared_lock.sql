-- Catalog-apply executor hardening: NULL-safe approval guards and the shared
-- product-apply advisory lock, for every installed SECURITY DEFINER apply
-- executor that predates 20260914170000 (which already has both).
--
-- 1. NULL-guard bypass. `p_reviewed_by <> 'nick'`, `p_x !~ '^[a-f0-9]…'` and
--    `computed <> expected` are NULL — not true — for NULL input, so a NULL
--    argument slipped past those guards. Each is rewritten to the form
--    20260914170000 uses: IS DISTINCT FROM, and an explicit IS NULL before a
--    regex check. A non-NULL argument is judged exactly as before and raises
--    the same message; only NULL arguments change outcome (they now raise).
--
-- 2. Cross-executor lock-order inversion. The executors lock product rows in
--    different orders (product_key in the leave-in calibration executor, UUID
--    in the pointer-delta executor, …), and every one of them at least inserts
--    ledger rows whose FK takes FOR KEY SHARE on products. Concurrent
--    multi-product runs could therefore deadlock. Every executor now takes
--    `catalog-enrichment:product-apply` FIRST — immediately before its own
--    first advisory lock, which precedes all of its row locks and writes — so
--    all apply executors are mutually exclusive.
--
-- The patches are applied to the INSTALLED definition (pg_get_functiondef →
-- exact replace → EXECUTE; the idiom of 20260814193326 and 20260902091000),
-- because several of these bodies are already the product of earlier in-place
-- patches. Every edit must match exactly once or the migration aborts, and
-- CREATE OR REPLACE keeps each function's owner and ACL as they are today
-- (some are deliberately not executable by service_role). Nothing else in any
-- body changes, so ledger replay behavior — including the already-run
-- leave-in-research-calibration-v1 batch — is preserved exactly.
--
-- Deliberately untouched: comparisons against stored ledger columns (NOT NULL
-- in the table) and per-item payload checks, which only ever see a payload the
-- caller has already fingerprint-pinned.

BEGIN;

CREATE FUNCTION pg_temp.harden_catalog_apply_executor(
  p_signature text,
  p_edits text[],
  p_first_lock_anchor text
)
RETURNS void
LANGUAGE plpgsql
AS $harden$
DECLARE
  v_shared_lock constant text := $lock$  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-enrichment:product-apply', 0)
  );
$lock$;
  v_definition text;
  v_old text;
  v_occurrences integer;
  v_index integer;
BEGIN
  v_definition := pg_catalog.pg_get_functiondef(p_signature::pg_catalog.regprocedure);
  IF pg_catalog.strpos(v_definition, 'catalog-enrichment:product-apply') <> 0 THEN
    RAISE EXCEPTION '% already takes the shared product-apply lock', p_signature;
  END IF;

  -- p_edits is a flat list of (old, new) pairs; the lock anchor is the last edit.
  p_edits := p_edits || ARRAY[p_first_lock_anchor, v_shared_lock || p_first_lock_anchor];
  FOR v_index IN 1 .. pg_catalog.array_length(p_edits, 1) BY 2 LOOP
    v_old := p_edits[v_index];
    v_occurrences := (
      pg_catalog.length(v_definition)
      - pg_catalog.length(pg_catalog.replace(v_definition, v_old, ''))
    ) / pg_catalog.length(v_old);
    IF v_occurrences <> 1 THEN
      RAISE EXCEPTION '% edit % expected exactly one match, found %: %',
        p_signature, (v_index + 1) / 2, v_occurrences, v_old;
    END IF;
    v_definition := pg_catalog.replace(v_definition, v_old, p_edits[v_index + 1]);
  END LOOP;

  EXECUTE v_definition;

  v_definition := pg_catalog.pg_get_functiondef(p_signature::pg_catalog.regprocedure);
  FOR v_index IN 1 .. pg_catalog.array_length(p_edits, 1) BY 2 LOOP
    IF pg_catalog.strpos(v_definition, p_edits[v_index + 1]) = 0 THEN
      RAISE EXCEPTION '% installed definition is missing edit %', p_signature, (v_index + 1) / 2;
    END IF;
  END LOOP;
END;
$harden$;

-- @harden apply_catalog_enrichment_leave_in_calibration_v1
SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_catalog_enrichment_leave_in_calibration_v1(text,text,text)',
  ARRAY[
    $o$IF p_reviewed_by <> 'nick' THEN$o$,
    $n$IF p_reviewed_by IS DISTINCT FROM 'nick' THEN$n$,
    $o$IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_batch_fingerprint IS NULL
     OR p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$,
    $o$IF v_batch_fingerprint <> p_expected_batch_fingerprint THEN$o$,
    $n$IF v_batch_fingerprint IS DISTINCT FROM p_expected_batch_fingerprint THEN$n$,
    $o$IF v_batch_fingerprint <> v_approved_batch_fingerprint THEN$o$,
    $n$IF v_batch_fingerprint IS DISTINCT FROM v_approved_batch_fingerprint THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-enrichment:' || v_batch_id, 0)$a$
);
-- @end

SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_catalog_enrichment_personal_plan_heat_v1(text,text,text)',
  ARRAY[
    $o$IF p_reviewed_by <> 'nick' THEN$o$,
    $n$IF p_reviewed_by IS DISTINCT FROM 'nick' THEN$n$,
    $o$IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_batch_fingerprint IS NULL OR p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$,
    $o$IF v_batch_fingerprint <> p_expected_batch_fingerprint THEN$o$,
    $n$IF v_batch_fingerprint IS DISTINCT FROM p_expected_batch_fingerprint THEN$n$,
    $o$IF v_batch_fingerprint <> v_approved_batch_fingerprint THEN$o$,
    $n$IF v_batch_fingerprint IS DISTINCT FROM v_approved_batch_fingerprint THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog-enrichment:personal-plan-heat-launch-v1', 0));$a$
);

SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_catalog_enrichment_personal_plan_scalp_v1(text,text,text)',
  ARRAY[
    $o$IF p_reviewed_by <> 'nick' THEN$o$,
    $n$IF p_reviewed_by IS DISTINCT FROM 'nick' THEN$n$,
    $o$IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_batch_fingerprint IS NULL
     OR p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$,
    $o$IF v_batch_fingerprint <> p_expected_batch_fingerprint THEN$o$,
    $n$IF v_batch_fingerprint IS DISTINCT FROM p_expected_batch_fingerprint THEN$n$,
    $o$IF v_batch_fingerprint <> v_approved_batch_fingerprint THEN$o$,
    $n$IF v_batch_fingerprint IS DISTINCT FROM v_approved_batch_fingerprint THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('catalog-enrichment:personal-plan-scalp-launch-v1', 0));$a$
);

-- Guards already NULL-safe; shared lock only.
SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_catalog_enrichment_scalp_image_correction_v1(text,text)',
  ARRAY[]::text[],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-enrichment:' || v_correction_id, 0)$a$
);

-- The regex guard alone was NULL-unsafe; the later IS DISTINCT FROM checks
-- already refused NULL, so this is consistency, not a live bypass.
SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_catalog_authority_oil_repair_v1(text,text,text)',
  ARRAY[
    $o$IF p_expected_manifest_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_manifest_fingerprint IS NULL
     OR p_expected_manifest_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('catalog-authority:oil-authority-enrichment-v1', 0)$a$
);

SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_personal_plan_exact_catalog_bundle_v1(text,text,text)',
  ARRAY[
    $o$IF p_reviewed_by <> 'nick' THEN$o$,
    $n$IF p_reviewed_by IS DISTINCT FROM 'nick' THEN$n$,
    $o$IF p_expected_bundle_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_bundle_fingerprint IS NULL OR p_expected_bundle_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$,
    $o$IF v_bundle_fingerprint <> p_expected_bundle_fingerprint THEN$o$,
    $n$IF v_bundle_fingerprint IS DISTINCT FROM p_expected_bundle_fingerprint THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('personal-plan-exact-catalog-bundle:' || (v_bundle->>'batch_id'), 0));$a$
);

SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_personal_plan_product_disposition_resolutions_v1(text,text,text)',
  ARRAY[
    $o$IF p_reviewed_by <> 'nick' THEN$o$,
    $n$IF p_reviewed_by IS DISTINCT FROM 'nick' THEN$n$,
    $o$IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_batch_fingerprint IS NULL
     OR p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$,
    $o$IF v_batch_fingerprint <> p_expected_batch_fingerprint THEN$o$,
    $n$IF v_batch_fingerprint IS DISTINCT FROM p_expected_batch_fingerprint THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-disposition-resolution:' || (v_batch->>'batch_id'), 0)$a$
);

SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_personal_plan_product_search_dispositions_v1(text,text,text)',
  ARRAY[
    $o$IF p_reviewed_by <> 'nick' THEN$o$,
    $n$IF p_reviewed_by IS DISTINCT FROM 'nick' THEN$n$,
    $o$IF p_expected_manifest_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_manifest_fingerprint IS NULL
     OR p_expected_manifest_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$,
    $o$IF v_manifest_fingerprint <> p_expected_manifest_fingerprint THEN$o$,
    $n$IF v_manifest_fingerprint IS DISTINCT FROM p_expected_manifest_fingerprint THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-product-dispositions:' || (v_manifest->>'batch_id'), 0)$a$
);

SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_personal_plan_product_search_disposition_reversal_v1(text,text,text,text,boolean)',
  ARRAY[
    $o$IF p_reviewed_by <> 'nick' THEN$o$,
    $n$IF p_reviewed_by IS DISTINCT FROM 'nick' THEN$n$,
    $o$IF p_reviewed_head !~ '^[a-f0-9]{40}$' THEN$o$,
    $n$IF p_reviewed_head IS NULL
     OR p_reviewed_head !~ '^[a-f0-9]{40}$' THEN$n$,
    $o$IF p_expected_manifest_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_manifest_fingerprint IS NULL
     OR p_expected_manifest_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$,
    $o$IF v_manifest_fingerprint <> p_expected_manifest_fingerprint THEN$o$,
    $n$IF v_manifest_fingerprint IS DISTINCT FROM p_expected_manifest_fingerprint THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-product-disposition-reversal:' || v_batch_id, 0)$a$
);

SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_personal_plan_stage5_protocol_batch_v1(text,text,text)',
  ARRAY[
    $o$IF p_reviewed_by <> 'nick' THEN$o$,
    $n$IF p_reviewed_by IS DISTINCT FROM 'nick' THEN$n$,
    $o$IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_batch_fingerprint IS NULL
     OR p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$,
    $o$IF v_computed_fingerprint <> p_expected_batch_fingerprint THEN$o$,
    $n$IF v_computed_fingerprint IS DISTINCT FROM p_expected_batch_fingerprint THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-stage5-protocol:' || (v_batch->>'batch_id'), 0)$a$
);

SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_personal_plan_stage5_v2_artifact_v1(text,text,text)',
  ARRAY[
    $o$IF p_reviewed_by <> 'nick' THEN$o$,
    $n$IF p_reviewed_by IS DISTINCT FROM 'nick' THEN$n$,
    $o$IF p_expected_artifact_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_artifact_fingerprint IS NULL
     OR p_expected_artifact_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$,
    $o$IF v_computed_fingerprint <> p_expected_artifact_fingerprint THEN$o$,
    $n$IF v_computed_fingerprint IS DISTINCT FROM p_expected_artifact_fingerprint THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('personal-plan-stage5-v2:' || v_batch_id, 0)$a$
);

-- Reviewer and fingerprint-match guards already NULL-safe.
SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_scan_expansion_batch_v1(text,text,text,text,text,boolean)',
  ARRAY[
    $o$IF p_reviewed_head !~ '^[a-f0-9]{40}$' THEN$o$,
    $n$IF p_reviewed_head IS NULL
     OR p_reviewed_head !~ '^[a-f0-9]{40}$' THEN$n$,
    $o$IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_batch_fingerprint IS NULL
     OR p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('scan-expansion:batch:' || v_batch_id, 0)$a$
);

-- Reviewer and fingerprint-match guards already NULL-safe.
SELECT pg_temp.harden_catalog_apply_executor(
  'public.apply_scanner_existing_identifier_backfill_v1(text,text,text,text,boolean)',
  ARRAY[
    $o$IF p_reviewed_head !~ '^[a-f0-9]{40}$' THEN$o$,
    $n$IF p_reviewed_head IS NULL
     OR p_reviewed_head !~ '^[a-f0-9]{40}$' THEN$n$,
    $o$IF p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$o$,
    $n$IF p_expected_batch_fingerprint IS NULL
     OR p_expected_batch_fingerprint !~ '^[a-f0-9]{64}$' THEN$n$
  ],
  $a$  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('scanner-identifier-backfill:batch:' || v_batch_id, 0)$a$
);

DROP FUNCTION pg_temp.harden_catalog_apply_executor(text, text[], text);

COMMIT;

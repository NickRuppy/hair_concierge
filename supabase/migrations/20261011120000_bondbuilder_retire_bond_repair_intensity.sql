-- Step 2 of retiring product_bondbuilder_specs.bond_repair_intensity (Nick, 2026-10-09:
-- repair intensity is no Bondbuilder signal; claim_trust_level ranks). Order:
-- 20261011115900 (relaxed CHECK) -> deploy the app that no longer reads/writes the
-- field -> this migration.
--
-- Historical receipts keep comparing equal:
-- * Admission, activation and promotion receipts store the readback image with
--   "bond_repair_intensity": null (admitted products never carried a value). The
--   readback serializer keeps emitting that retired key as a constant null.
-- * Preserved research bundles (Olaplex No.3PLUS, K18, Epres) store "intensive". The
--   protected image no longer carries the key, and both comparators ignore it on the
--   stored side only. Every other byte still has to match.
-- * Scan-expansion replays (to_jsonb(row) @> expected) are unaffected: no applied
--   scan-expansion item is a Bondbuilder (production, 2026-10-11).
-- Only the function bodies named here change; each is guarded by its reviewed digest.
BEGIN;

DO $retire_intensity$
DECLARE
  target regprocedure;
  body text;
  definition text;
  patched text;
  unexpected text;
  old_text text;
  new_text text;
  i integer;
  writer_old text[] := ARRAY[
    $$k NOT IN ('product_id','bond_repair_intensity','application_mode',$$,
    $$INSERT INTO public.product_bondbuilder_specs(product_id,bond_repair_intensity,application_mode,$$,
    $$VALUES(p_product_id,merged->>'bond_repair_intensity',merged->>'application_mode',$$,
    $$DO UPDATE SET bond_repair_intensity=EXCLUDED.bond_repair_intensity,application_mode=$$
  ];
  writer_new text[] := ARRAY[
    $$k NOT IN ('product_id','application_mode',$$,
    $$INSERT INTO public.product_bondbuilder_specs(product_id,application_mode,$$,
    $$VALUES(p_product_id,merged->>'application_mode',$$,
    $$DO UPDATE SET application_mode=$$
  ];
BEGIN
  -- Fail closed if anything beyond the two known functions names the column.
  SELECT string_agg(oid::regprocedure::text, ', ') INTO unexpected FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace AND prosrc LIKE '%bond_repair_intensity%'
    AND oid NOT IN ('public.bondbuilder_write_spec_v1(uuid,jsonb)'::regprocedure,
                    'public.bondbuilder_research_protected_v1(jsonb)'::regprocedure);
  IF unexpected IS NOT NULL THEN
    RAISE EXCEPTION 'unexpected bond_repair_intensity reader: %', unexpected;
  END IF;
  -- Step 1 must have removed the retired clause; DROP COLUMN would otherwise drop the whole CHECK.
  IF pg_get_constraintdef((SELECT oid FROM pg_constraint
       WHERE conrelid = 'public.product_bondbuilder_specs'::regclass
         AND conname = 'bondbuilder_research_contract_v1')) LIKE '%bond_repair_intensity%' THEN
    RAISE EXCEPTION 'apply 20261011115900_bondbuilder_relax_intensity_contract first';
  END IF;

  -- Spec writer: the retired field is no longer an owned field (a payload carrying it is rejected).
  target := 'public.bondbuilder_write_spec_v1(uuid,jsonb)'::regprocedure;
  SELECT prosrc, pg_get_functiondef(oid) INTO body, definition FROM pg_proc WHERE oid = target;
  IF encode(sha256(convert_to(body, 'UTF8')), 'hex') IS DISTINCT FROM '3b9186f0ec667215bf13a86e0d4cf84fb4e14903aa5ccb8e91b55171b555cd19'
     OR strpos(definition, body) = 0 THEN
    RAISE EXCEPTION 'Bondbuilder spec writer lineage changed';
  END IF;
  patched := body;
  FOR i IN 1 .. array_length(writer_old, 1) LOOP
    IF (length(patched) - length(replace(patched, writer_old[i], ''))) / length(writer_old[i]) <> 1 THEN
      RAISE EXCEPTION 'Bondbuilder spec writer intensity seam changed';
    END IF;
    patched := replace(patched, writer_old[i], writer_new[i]);
  END LOOP;
  IF strpos(patched, 'bond_repair_intensity') > 0 THEN
    RAISE EXCEPTION 'Bondbuilder spec writer still names bond_repair_intensity';
  END IF;
  EXECUTE replace(definition, body, patched);

  -- Preserved-bundle authority: compare without the retired key on the stored side.
  target := 'public.bondbuilder_curated_facts_ready_v1(uuid)'::regprocedure;
  old_text := $$public.bondbuilder_research_protected_v1(public.bondbuilder_research_preimage_v1(p_product_id))=saved$$;
  new_text := $$public.bondbuilder_research_protected_v1(public.bondbuilder_research_preimage_v1(p_product_id))=(saved #- '{specs,bond_repair_intensity}')$$;
  SELECT prosrc, pg_get_functiondef(oid) INTO body, definition FROM pg_proc WHERE oid = target;
  IF encode(sha256(convert_to(body, 'UTF8')), 'hex') IS DISTINCT FROM '16dd604125bfe70bba78cb0d6c956a140d6c14775b8c3e308132ac6e6d39ba24'
     OR (length(body) - length(replace(body, old_text, ''))) / length(old_text) <> 1
     OR strpos(definition, body) = 0 THEN
    RAISE EXCEPTION 'Bondbuilder curated facts lineage changed';
  END IF;
  EXECUTE replace(definition, body, replace(body, old_text, new_text));

  -- Research replay drift check: same rule for the stored preserved bundle.
  target := 'public.bondbuilder_research_enrich_v1(uuid,jsonb,jsonb,uuid,text)'::regprocedure;
  old_text := $$OR public.bondbuilder_research_protected_v1(current_image) IS DISTINCT FROM evidence$$;
  new_text := $$OR public.bondbuilder_research_protected_v1(current_image) IS DISTINCT FROM (evidence #- '{specs,bond_repair_intensity}')$$;
  SELECT prosrc, pg_get_functiondef(oid) INTO body, definition FROM pg_proc WHERE oid = target;
  IF encode(sha256(convert_to(body, 'UTF8')), 'hex') IS DISTINCT FROM '4602062a47a0899ae4340e19bff370914feae77fa46a652fefb86fc17c48a2db'
     OR (length(body) - length(replace(body, old_text, ''))) / length(old_text) <> 1
     OR strpos(definition, body) = 0 THEN
    RAISE EXCEPTION 'Bondbuilder research enrichment lineage changed';
  END IF;
  EXECUTE replace(definition, body, replace(body, old_text, new_text));

  -- Admission readback: keep the retired key as constant null so stored receipts stay equal.
  target := 'public.bondbuilder_internal_admission_readback_v1(uuid)'::regprocedure;
  old_text := $$'spec',(SELECT to_jsonb(s) FROM public.product_bondbuilder_specs s WHERE s.product_id=p_product_id)$$;
  new_text := $$'spec',(SELECT to_jsonb(s) || '{"bond_repair_intensity":null}'::jsonb FROM public.product_bondbuilder_specs s WHERE s.product_id=p_product_id)$$;
  SELECT prosrc, pg_get_functiondef(oid) INTO body, definition FROM pg_proc WHERE oid = target;
  IF encode(sha256(convert_to(body, 'UTF8')), 'hex') IS DISTINCT FROM 'f9c1f175dce69fca22da11c17714df7a592a084b6025bdb7707695432b81719c'
     OR (length(body) - length(replace(body, old_text, ''))) / length(old_text) <> 1
     OR strpos(definition, body) = 0 THEN
    RAISE EXCEPTION 'Bondbuilder admission readback lineage changed';
  END IF;
  EXECUTE replace(definition, body, replace(body, old_text, new_text));

  IF encode(sha256(convert_to((SELECT prosrc FROM pg_proc
       WHERE oid = 'public.bondbuilder_research_protected_v1(jsonb)'::regprocedure), 'UTF8')), 'hex')
     IS DISTINCT FROM 'e18246d0a2a5558f82902164d59e7d596305b3de4b7f8b25d7f798e874967dc6' THEN
    RAISE EXCEPTION 'Bondbuilder protected image lineage changed';
  END IF;
END $retire_intensity$;

-- The protected image no longer carries the retired key.
CREATE OR REPLACE FUNCTION public.bondbuilder_research_protected_v1(p_preimage jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT jsonb_set(p_preimage,'{specs}',jsonb_build_object('product_id',p_preimage#>>'{product,id}','application_mode',p_preimage#>'{specs,application_mode}','bond_repair_axis',p_preimage#>'{specs,bond_repair_axis}','treatment_mode',p_preimage#>'{specs,treatment_mode}','product_format',p_preimage#>'{specs,product_format}','usage_protocol',p_preimage#>'{specs,usage_protocol}'))
$$;

-- Drops the column's value CHECK and index with it; the research contract CHECK no
-- longer references it (step 1).
ALTER TABLE public.product_bondbuilder_specs DROP COLUMN bond_repair_intensity;

COMMIT;

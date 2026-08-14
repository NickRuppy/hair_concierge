-- Reconcile the exact reviewed V1 authorities that block the 2026-08-14
-- Stage-5 V2 artifact. Product pointers, product facts, and runtime flags stay
-- untouched. Every transition is pinned to the observed old and reviewed new
-- canonical source fingerprints.
BEGIN;

DO $reconcile_reviewed_v1_authority$
DECLARE
  v_candidate record;
  v_protocol public.product_application_protocols%ROWTYPE;
  v_payload jsonb;
  v_fingerprint text;
  v_updated integer := 0;
  v_row_count integer;
BEGIN
  FOR v_candidate IN
    SELECT * FROM (VALUES
      ('215522e5-95a6-469f-bc34-1fa74b311a23'::uuid, 'conditioner', 'conditioner_rinse_out', 'standard_rinse_out_conditioning', 'da49a2b7288dbe99fd48b52cd7138c9ff2629d2d2e041794059840356c6675f6', '1f0f02d729d29fd2c22aebf722962982148891eaccfcb5923b837dce2c2f8af9', 'shared_contact_time'),
      ('38dace91-0fba-49ee-a93f-ac36e488fe4b'::uuid, 'bondbuilder', 'specialized_bond_treatment', 'post_shampoo_timed_leave_in', '8e067daa1f733ca02c4a1446c00ab4976ec9f70334e28c961c082b60f0e4b01a', '2c7d902f90ef3b4012c79d080b81e1b86fb9181fff2ad25fd55b7084beb58ac6', 'k18_exact'),
      ('3dc24d67-e6c0-4239-a273-058a87d13553'::uuid, 'bondbuilder', 'specialized_bond_treatment', 'pre_shampoo_single_treatment', '812301b0d8f144e25931e54aa9cc4164be3693647cfd32ad4896239e753fd13f', 'ce483d7de547b168a1f36d80ba1387609067889720d6e8886aebe946f7856717', 'olaplex_workflow'),
      ('3f3542c0-e82b-4306-a9e0-85df313a78cf'::uuid, 'scalp_care', 'density_claim_tonic', 'leave_on_scalp_care', '1cf521ebc6f3043cfa43e13b18529602ebb4fee524b418a960d0c4bc7631791d', '73aa89cebf8b8fa705c13a589b325d95106433db076f97b7a6dcd6ad1e2765b8', 'loreal_caution'),
      ('515de93c-1c77-465d-ae0d-2a8d6ddb3d73'::uuid, 'shampoo', 'shampoo_everyday', 'targeted_treatment_shampoo', 'bc7e8dfc29a8370734003a00a69995f8ddcd87134d12ffba4ae521ac4938895b', '52fc64d76f418870ec2aab50a2df3d63f182ec818919345cc0376a955e4098e4', 'swiss_workflow'),
      ('58aa2f19-b23a-4e09-ab0f-68c359371c9e'::uuid, 'scalp_care', 'density_claim_tonic', 'leave_on_scalp_care', '0d71f05c1be3d50050022172821abb15fbf40f9b48e64db31ca2126ec376a9a4', '2948641a8978bfd0d2e37efbc99762d490ed5e6ebf3d2f311bf94cb42a8cc266', 'ordinary_cautions'),
      ('7373656d-5fd7-46e8-81a3-2ef29e3c4c18'::uuid, 'shampoo', 'shampoo_everyday', 'standard_rinse_out_cleanse', '3e430bb6b7b273144a6d6dd475c57e3d5c5f917270eb1f51d05fff137113d5d3', '9673fc144574061f3a09ca33c6d3a84fc8ffc9cac6e9547233fb12d919bbe82c', 'pantene_caution'),
      ('d0180955-c3a0-4f53-8744-fbeb2c241688'::uuid, 'conditioner', 'conditioner_rinse_out', 'standard_rinse_out_conditioning', 'ef3fc0888fa3a86e0ecb3d7ec20517c85c107d2315f0ea3bda9d4b0c2c8ded1e', '6000344aba4c2ef9cc6cf5bfdc429e67081ffd32bd2cdb7743261b2fba976556', 'shared_contact_time'),
      ('f8a63590-9d80-454a-8008-e2a56321e64c'::uuid, 'bondbuilder', 'specialized_bond_treatment', 'pre_shampoo_single_treatment', '2985c3c4c6a56933316dbd927c044c8d4434f9e54bcb54efbeddd2f547d710eb', '796694ec55f97ff236cfe4d6ebe29e4c8b353ce7bb57803255489394706a8fd8', 'epres_workflow')
    ) AS candidate(product_id, category, role, application_family, old_fingerprint, new_fingerprint, patch_kind)
  LOOP
    SELECT protocol.* INTO v_protocol
    FROM public.product_application_protocols protocol
    WHERE protocol.product_id = v_candidate.product_id
      AND protocol.category = v_candidate.category
      AND protocol.role = v_candidate.role
      AND protocol.application_family = v_candidate.application_family
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'reviewed V1 authority row is missing: %', v_candidate.product_id;
    END IF;

    v_fingerprint := pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          public.personal_plan_stage5_v2_canonical_json_v1(
            pg_catalog.jsonb_build_object('role', v_protocol.role, 'payload', v_protocol.guidance_payload)
          ),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
    IF v_fingerprint IS DISTINCT FROM v_candidate.old_fingerprint THEN
      RAISE EXCEPTION 'reviewed V1 authority precondition drifted: % (expected %, found %)',
        v_candidate.product_id, v_candidate.old_fingerprint, v_fingerprint;
    END IF;

    v_payload := CASE v_candidate.patch_kind
      WHEN 'shared_contact_time' THEN
        pg_catalog.jsonb_set(v_protocol.guidance_payload, '{protocolFacts,sharedTemplateContactTime}', '"include"'::jsonb, true)
      WHEN 'k18_exact' THEN
        pg_catalog.jsonb_set(
          pg_catalog.jsonb_set(
            pg_catalog.jsonb_set(
              v_protocol.guidance_payload,
              '{protocolFacts,amount}',
              '{"kind":"pumps","minimum":1,"maximum":3}'::jsonb,
              true
            ),
            '{protocolFacts,workflowId}',
            pg_catalog.to_jsonb('k18_leave_in_molecular_repair'::text),
            true
          ),
          '{steps,1,copyTemplateDe}',
          pg_catalog.to_jsonb('1–3 Pumpstöße für das gesamte Haar verwenden und von den Spitzen nach oben gleichmäßig einarbeiten.'::text),
          false
        )
      WHEN 'olaplex_workflow' THEN
        pg_catalog.jsonb_set(v_protocol.guidance_payload, '{protocolFacts,workflowId}', pg_catalog.to_jsonb('olaplex_no3plus_complete_repair'::text), true)
      WHEN 'loreal_caution' THEN
        pg_catalog.jsonb_set(v_protocol.guidance_payload, '{protocolFacts,cautionCodes}', '["cosmetic_claim_only"]'::jsonb, true)
      WHEN 'swiss_workflow' THEN
        pg_catalog.jsonb_set(v_protocol.guidance_payload, '{protocolFacts,workflowId}', pg_catalog.to_jsonb('swiss_o_par_tea_tree_two_pass'::text), true)
      WHEN 'ordinary_cautions' THEN
        pg_catalog.jsonb_set(v_protocol.guidance_payload, '{protocolFacts,cautionCodes}', '["cosmetic_claim_only","stop_on_irritation"]'::jsonb, true)
      WHEN 'pantene_caution' THEN
        pg_catalog.jsonb_set(v_protocol.guidance_payload, '{protocolFacts,cautionCodes}', '["cosmetic_claim_only"]'::jsonb, true)
      WHEN 'epres_workflow' THEN
        pg_catalog.jsonb_set(v_protocol.guidance_payload, '{protocolFacts,workflowId}', pg_catalog.to_jsonb('epres_bond_repair'::text), true)
      ELSE NULL
    END;
    IF v_payload IS NULL THEN
      RAISE EXCEPTION 'reviewed V1 authority patch is unknown: %', v_candidate.patch_kind;
    END IF;

    UPDATE public.product_application_protocols protocol
    SET guidance_payload = v_payload,
        updated_at = pg_catalog.clock_timestamp()
    WHERE protocol.product_id = v_candidate.product_id
      AND protocol.category = v_candidate.category
      AND protocol.role = v_candidate.role
      AND protocol.application_family = v_candidate.application_family;
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count <> 1 THEN
      RAISE EXCEPTION 'reviewed V1 authority update was not singular: %', v_candidate.product_id;
    END IF;

    v_fingerprint := pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(
          public.personal_plan_stage5_v2_canonical_json_v1(
            pg_catalog.jsonb_build_object('role', v_candidate.role, 'payload', v_payload)
          ),
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
    IF v_fingerprint IS DISTINCT FROM v_candidate.new_fingerprint THEN
      RAISE EXCEPTION 'reviewed V1 source fingerprint verification failed: % (expected %, found %)',
        v_candidate.product_id, v_candidate.new_fingerprint, v_fingerprint;
    END IF;
    v_updated := v_updated + 1;
  END LOOP;

  IF v_updated <> 9 THEN
    RAISE EXCEPTION 'expected exactly 9 divergent V1 protocol rows, found %', v_updated;
  END IF;
END;
$reconcile_reviewed_v1_authority$;

-- These two active rows predate the reviewed placeholder-aware copy. The
-- immutable-content trigger is suspended only after both exact old payloads
-- have been locked and fingerprinted, then restored before verification.
DO $reconcile_reviewed_family_authority$
DECLARE
  v_candidate record;
  v_family public.application_guidance_protocols%ROWTYPE;
  v_fingerprint text;
  v_count integer := 0;
  v_row_count integer;
BEGIN
  FOR v_candidate IN
    SELECT * FROM (VALUES
      ('leave-in.damp-refresh.v2', '58df652414df48684bd6ee1add2b6264d3adf0dfcc57c7083fea19650bc31aa3'),
      ('leave-in.dry-care.v2', '899f78a3a9627265b954ab269cfd93c79778b58277fbbf3bf119bb2b58b47d28')
    ) AS candidate(guidance_key, old_fingerprint)
  LOOP
    SELECT protocol.* INTO v_family
    FROM public.application_guidance_protocols protocol
    WHERE protocol.guidance_key = v_candidate.guidance_key
      AND protocol.id = CASE v_candidate.guidance_key
        WHEN 'leave-in.damp-refresh.v2' THEN 'c0e024fc-95be-54e1-8d24-9250b088714e'::uuid
        WHEN 'leave-in.dry-care.v2' THEN '2bc335e3-7121-5a80-832e-d9fed97073c2'::uuid
      END
      AND protocol.protocol_version = 2
      AND protocol.contract_version = 2
      AND protocol.locale = 'de'
      AND protocol.status = 'active'
      AND protocol.verified_at = pg_catalog.make_timestamptz(2026, 8, 12, 0, 0, 0, 'UTC')
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'current family template authority is missing: %', v_candidate.guidance_key;
    END IF;
    v_fingerprint := pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(public.personal_plan_stage5_v2_canonical_json_v1(v_family.payload), 'UTF8'),
        'sha256'
      ),
      'hex'
    );
    IF v_fingerprint IS DISTINCT FROM v_candidate.old_fingerprint THEN
      RAISE EXCEPTION 'current family template authority drifted: % (expected %, found %)',
        v_candidate.guidance_key, v_candidate.old_fingerprint, v_fingerprint;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'expected exactly 2 stale family template rows, found %', v_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger trigger
    WHERE trigger.tgrelid = 'public.application_guidance_protocols'::regclass
      AND trigger.tgname = 'application_guidance_protocols_active_immutable'
      AND trigger.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'application guidance immutability trigger is not enabled';
  END IF;

  EXECUTE 'ALTER TABLE public.application_guidance_protocols DISABLE TRIGGER application_guidance_protocols_active_immutable';
  FOR v_candidate IN
    SELECT * FROM (VALUES
      ('leave-in.damp-refresh.v2', 'Die betroffenen {{application_area_de}} leicht anfeuchten. Eine sehr kleine Menge in den Händen verteilen und gezielt in {{application_area_de}} einarbeiten. Ansatz und Kopfhaut aussparen. Nicht ausspülen.'),
      ('leave-in.dry-care.v2', 'Mit einer sehr kleinen Menge in trockenen {{application_area_de}} beginnen und nur bei Bedarf ergänzen.')
    ) AS candidate(guidance_key, new_copy)
  LOOP
    UPDATE public.application_guidance_protocols protocol
    SET payload = pg_catalog.jsonb_set(
          protocol.payload,
          '{steps,0,copyTemplateDe}',
          pg_catalog.to_jsonb(v_candidate.new_copy::text),
          false
        ),
        verified_at = pg_catalog.make_timestamptz(2026, 8, 14, 0, 0, 0, 'UTC'),
        updated_at = pg_catalog.clock_timestamp()
    WHERE protocol.guidance_key = v_candidate.guidance_key
      AND protocol.protocol_version = 2
      AND protocol.contract_version = 2
      AND protocol.locale = 'de'
      AND protocol.status = 'active';
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count <> 1 THEN
      RAISE EXCEPTION 'reviewed family template update was not singular: %', v_candidate.guidance_key;
    END IF;
  END LOOP;
  EXECUTE 'ALTER TABLE public.application_guidance_protocols ENABLE TRIGGER application_guidance_protocols_active_immutable';

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_trigger trigger
    WHERE trigger.tgrelid = 'public.application_guidance_protocols'::regclass
      AND trigger.tgname = 'application_guidance_protocols_active_immutable'
      AND trigger.tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'application guidance immutability trigger was not restored';
  END IF;

  FOR v_candidate IN
    SELECT * FROM (VALUES
      ('leave-in.damp-refresh.v2', '8261122b3b090a8085ec10a449e00dcbe7866060c87e72b6e33e1cdb6393d3d7'),
      ('leave-in.dry-care.v2', '977759f5828796fcdc32b66b20c6cbceaea448d22e79d26d357dc73fdde6c746')
    ) AS candidate(guidance_key, new_fingerprint)
  LOOP
    SELECT protocol.* INTO v_family
    FROM public.application_guidance_protocols protocol
    WHERE protocol.guidance_key = v_candidate.guidance_key
      AND protocol.id = CASE v_candidate.guidance_key
        WHEN 'leave-in.damp-refresh.v2' THEN 'c0e024fc-95be-54e1-8d24-9250b088714e'::uuid
        WHEN 'leave-in.dry-care.v2' THEN '2bc335e3-7121-5a80-832e-d9fed97073c2'::uuid
      END
      AND protocol.protocol_version = 2
      AND protocol.contract_version = 2
      AND protocol.locale = 'de'
      AND protocol.status = 'active'
      AND protocol.verified_at = pg_catalog.make_timestamptz(2026, 8, 14, 0, 0, 0, 'UTC');
    IF NOT FOUND THEN
      RAISE EXCEPTION 'reviewed family template verification failed: %', v_candidate.guidance_key;
    END IF;
    v_fingerprint := pg_catalog.encode(
      extensions.digest(
        pg_catalog.convert_to(public.personal_plan_stage5_v2_canonical_json_v1(v_family.payload), 'UTF8'),
        'sha256'
      ),
      'hex'
    );
    IF v_fingerprint IS DISTINCT FROM v_candidate.new_fingerprint THEN
      RAISE EXCEPTION 'reviewed family template verification failed: %', v_candidate.guidance_key;
    END IF;
  END LOOP;
END;
$reconcile_reviewed_family_authority$;

-- Preserve the reviewed executor's code and permissions. Repin only its exact
-- artifact identity, using one-occurrence guards so source drift fails closed.
DO $repin_stage5_v2_executor$
DECLARE
  v_definition text;
  v_installed text;
  v_old_batch constant text := 'personal-plan-stage5-v2-2026-08-12';
  v_new_batch constant text := 'personal-plan-stage5-v2-2026-08-14-use-case-coverage';
  v_old_source_kind constant text := 'reviewed_stage5_v1_artifacts';
  v_new_source_kind constant text := 'reviewed_stage5_v1_and_use_case_artifacts';
  v_old_snapshot constant text := '2026-08-12';
  v_new_snapshot constant text := '2026-08-14';
  v_occurrences integer;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.apply_personal_plan_stage5_v2_artifact_v1(text,text,text)'::regprocedure
  ) INTO v_definition;

  v_occurrences := (pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_old_batch, ''))) / pg_catalog.length(v_old_batch);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'expected exactly one old Stage 5 V2 batch identity, found %', v_occurrences;
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old_batch, v_new_batch);

  v_occurrences := (pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_old_source_kind, ''))) / pg_catalog.length(v_old_source_kind);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'expected exactly one old Stage 5 V2 source-kind identity, found %', v_occurrences;
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old_source_kind, v_new_source_kind);

  v_occurrences := (pg_catalog.length(v_definition) - pg_catalog.length(pg_catalog.replace(v_definition, v_old_snapshot, ''))) / pg_catalog.length(v_old_snapshot);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'expected exactly one old Stage 5 V2 snapshot identity, found %', v_occurrences;
  END IF;
  v_definition := pg_catalog.replace(v_definition, v_old_snapshot, v_new_snapshot);
  EXECUTE v_definition;

  SELECT pg_catalog.pg_get_functiondef(
    'public.apply_personal_plan_stage5_v2_artifact_v1(text,text,text)'::regprocedure
  ) INTO v_installed;
  v_occurrences := (pg_catalog.length(v_installed) - pg_catalog.length(pg_catalog.replace(v_installed, v_new_batch, ''))) / pg_catalog.length(v_new_batch);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'expected exactly one new Stage 5 V2 batch identity, found %', v_occurrences;
  END IF;
  v_occurrences := (pg_catalog.length(v_installed) - pg_catalog.length(pg_catalog.replace(v_installed, v_new_source_kind, ''))) / pg_catalog.length(v_new_source_kind);
  IF v_occurrences <> 1 THEN
    RAISE EXCEPTION 'expected exactly one new Stage 5 V2 source-kind identity, found %', v_occurrences;
  END IF;
  v_occurrences := (pg_catalog.length(v_installed) - pg_catalog.length(pg_catalog.replace(v_installed, v_new_snapshot, ''))) / pg_catalog.length(v_new_snapshot);
  IF v_occurrences <> 2 THEN
    RAISE EXCEPTION 'expected exactly two new Stage 5 V2 snapshot identities, found %', v_occurrences;
  END IF;
  IF pg_catalog.strpos(v_installed, v_old_batch) <> 0
     OR pg_catalog.strpos(v_installed, v_old_source_kind) <> 0
     OR pg_catalog.strpos(v_installed, v_old_snapshot) <> 0 THEN
    RAISE EXCEPTION 'installed Stage 5 V2 executor identity verification failed';
  END IF;
END;
$repin_stage5_v2_executor$;

COMMIT;

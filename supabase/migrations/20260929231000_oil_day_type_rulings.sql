-- OIL DAY-TYPE RULINGS O1–O5 (Nick, 2026-09-29; docs/product-application-protocol-templates.md
-- "Oil day-type rulings"). Reviewed by the hair-care expert lane before adoption.
--
-- What decides days in the live plan: the Anwendung page (compileApplicationViewV2)
-- takes day sets from the ACTIVE shared family templates in
-- application_guidance_protocols. The per-product V1 `guidance_payload.compatibleDayTypes`
-- only feeds the Stage-3 Oil heat-carrier credit (catalog-facts.ts, heat-capable Oils).
--
-- 1. V1 Oil leave-on rows (TPL-OIL-LEAVEON, O2). Production 2026-09-29: 21 rows (6
--    expansion, 15 recommended hand-curated from 2026-08-12) still allow
--    ["wash_day","intensive_care_day","styling_day"]; the ruled set is the four
--    wash-family days. None of the 21 is heat-capable, so no plan output changes.
-- 2. V1 Oil dry-finish rows are deliberately untouched: they do not drive plan days, and
--    the prepared Kevin Murphy migration (20260929120000) pins its own dry-finish row.
-- 3. Shared between-wash Oil templates (O4) — the one user-visible change. The four
--    `oil.*` between-wash families stop applying to refresh_day. Active content is
--    immutable (reject_active_application_content_mutation), so each key's active
--    version 2 is retired and version 3 is published. Loading is "all active rows"
--    (routines/personal-plan/application/repository.ts), so saved plans pick up v3 on
--    their next render; nothing pins a template version.
--
-- Every step accepts only its reviewed pre-state or its own post-state and refuses
-- anything else. A fresh replay (no rows yet) is a no-op. Template payload literals
-- are generated from src/lib/routines/personal-plan/application/shared-templates-v2.ts
-- and re-derived by tests/oil-day-type-rulings-migration-postgres.test.ts.

BEGIN;

SELECT pg_advisory_xact_lock(hashtext('oil_day_type_rulings_20260929'));

DO $oil_leave_on_day_types$
DECLARE
  c_stale constant jsonb := '["wash_day","intensive_care_day","styling_day"]'::jsonb;
  c_ruled constant jsonb :=
    '["wash_day","intensive_care_day","bond_repair_day","clarifying_wash_day"]'::jsonb;
  v_unknown integer;
BEGIN
  SELECT pg_catalog.count(*)::integer INTO v_unknown
  FROM public.product_application_protocols protocol
  WHERE protocol.category = 'oil'
    AND protocol.role = 'leave_on_fibre_conditioning'
    AND protocol.guidance_payload IS NOT NULL
    AND protocol.guidance_payload->'compatibleDayTypes' IS DISTINCT FROM c_stale
    AND protocol.guidance_payload->'compatibleDayTypes' IS DISTINCT FROM c_ruled;
  IF v_unknown > 0 THEN
    RAISE EXCEPTION 'oil leave-on protocols with an unreviewed day set: %', v_unknown;
  END IF;

  UPDATE public.product_application_protocols protocol
  SET guidance_payload = pg_catalog.jsonb_set(
        protocol.guidance_payload, '{compatibleDayTypes}', c_ruled, false
      )
  WHERE protocol.category = 'oil'
    AND protocol.role = 'leave_on_fibre_conditioning'
    AND protocol.guidance_payload->'compatibleDayTypes' = c_stale;
END;
$oil_leave_on_day_types$;

DO $oil_between_wash_templates$
DECLARE
  v_target record;
  v_active public.application_guidance_protocols%ROWTYPE;
BEGIN
  FOR v_target IN
    SELECT * FROM (VALUES
    ('oil.finish.damp-refresh.v2', 'finish', 'between_wash_damp_refresh',
     $json${"schemaVersion":2,"contractKind":"family_template","guidanceKey":"oil.finish.damp-refresh.v2","protocolVersion":2,"locale":"de","scope":{"kind":"application_family","category":"oil"},"role":"finish","applicationFamily":"between_wash_damp_refresh","compatibleDayTypes":["refresh_day","between_wash_care_day"],"sequence":{"anchor":"damp_leave_on","before":[],"after":[],"conflictsWith":[]},"steps":[{"stepKey":"oil-damp-care","action":"apply_product","copyTemplateDe":"Die betroffenen {{application_area_de}} mit feuchten Händen leicht anfeuchten. Einen Tropfen oder eine sehr kleine Menge vollständig in den Handflächen verteilen und nur in {{application_area_de}} drücken. Ansatz und Kopfhaut aussparen. Nicht ausspülen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips","sourceType":"professional_authority","checkedAt":"2026-08-12"}]}$json$::jsonb,
     $json${"schemaVersion":2,"contractKind":"family_template","guidanceKey":"oil.finish.damp-refresh.v2","protocolVersion":3,"locale":"de","scope":{"kind":"application_family","category":"oil"},"role":"finish","applicationFamily":"between_wash_damp_refresh","compatibleDayTypes":["between_wash_care_day"],"sequence":{"anchor":"damp_leave_on","before":[],"after":[],"conflictsWith":[]},"steps":[{"stepKey":"oil-damp-care","action":"apply_product","copyTemplateDe":"Die betroffenen {{application_area_de}} mit feuchten Händen leicht anfeuchten. Einen Tropfen oder eine sehr kleine Menge vollständig in den Handflächen verteilen und nur in {{application_area_de}} drücken. Ansatz und Kopfhaut aussparen. Nicht ausspülen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips","sourceType":"professional_authority","checkedAt":"2026-08-12"}]}$json$::jsonb),
    ('oil.finish.dry-care.v2', 'finish', 'between_wash_dry_care',
     $json${"schemaVersion":2,"contractKind":"family_template","guidanceKey":"oil.finish.dry-care.v2","protocolVersion":2,"locale":"de","scope":{"kind":"application_family","category":"oil"},"role":"finish","applicationFamily":"between_wash_dry_care","compatibleDayTypes":["refresh_day","between_wash_care_day"],"sequence":{"anchor":"dry_finish","before":[],"after":[],"conflictsWith":[]},"steps":[{"stepKey":"dry-care","action":"apply_product","copyTemplateDe":"Mit 1 Tropfen oder einer sehr kleinen Menge in trockenen {{application_area_de}} beginnen und nur bei Bedarf ergänzen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips","sourceType":"professional_authority","checkedAt":"2026-08-12"}]}$json$::jsonb,
     $json${"schemaVersion":2,"contractKind":"family_template","guidanceKey":"oil.finish.dry-care.v2","protocolVersion":3,"locale":"de","scope":{"kind":"application_family","category":"oil"},"role":"finish","applicationFamily":"between_wash_dry_care","compatibleDayTypes":["between_wash_care_day"],"sequence":{"anchor":"dry_finish","before":[],"after":[],"conflictsWith":[]},"steps":[{"stepKey":"dry-care","action":"apply_product","copyTemplateDe":"Mit 1 Tropfen oder einer sehr kleinen Menge in trockenen {{application_area_de}} beginnen und nur bei Bedarf ergänzen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips","sourceType":"professional_authority","checkedAt":"2026-08-12"}]}$json$::jsonb),
    ('oil.leave-in.damp-refresh.v2', 'leave_in', 'between_wash_damp_refresh',
     $json${"schemaVersion":2,"contractKind":"family_template","guidanceKey":"oil.leave-in.damp-refresh.v2","protocolVersion":2,"locale":"de","scope":{"kind":"application_family","category":"oil"},"role":"leave_in","applicationFamily":"between_wash_damp_refresh","compatibleDayTypes":["refresh_day","between_wash_care_day"],"sequence":{"anchor":"damp_leave_on","before":[],"after":[],"conflictsWith":[]},"steps":[{"stepKey":"oil-damp-care","action":"apply_product","copyTemplateDe":"Die betroffenen {{application_area_de}} mit feuchten Händen leicht anfeuchten. Einen Tropfen oder eine sehr kleine Menge vollständig in den Handflächen verteilen und nur in {{application_area_de}} drücken. Ansatz und Kopfhaut aussparen. Nicht ausspülen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips","sourceType":"professional_authority","checkedAt":"2026-08-12"}]}$json$::jsonb,
     $json${"schemaVersion":2,"contractKind":"family_template","guidanceKey":"oil.leave-in.damp-refresh.v2","protocolVersion":3,"locale":"de","scope":{"kind":"application_family","category":"oil"},"role":"leave_in","applicationFamily":"between_wash_damp_refresh","compatibleDayTypes":["between_wash_care_day"],"sequence":{"anchor":"damp_leave_on","before":[],"after":[],"conflictsWith":[]},"steps":[{"stepKey":"oil-damp-care","action":"apply_product","copyTemplateDe":"Die betroffenen {{application_area_de}} mit feuchten Händen leicht anfeuchten. Einen Tropfen oder eine sehr kleine Menge vollständig in den Handflächen verteilen und nur in {{application_area_de}} drücken. Ansatz und Kopfhaut aussparen. Nicht ausspülen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips","sourceType":"professional_authority","checkedAt":"2026-08-12"}]}$json$::jsonb),
    ('oil.leave-in.dry-care.v2', 'leave_in', 'between_wash_dry_care',
     $json${"schemaVersion":2,"contractKind":"family_template","guidanceKey":"oil.leave-in.dry-care.v2","protocolVersion":2,"locale":"de","scope":{"kind":"application_family","category":"oil"},"role":"leave_in","applicationFamily":"between_wash_dry_care","compatibleDayTypes":["refresh_day","between_wash_care_day"],"sequence":{"anchor":"dry_finish","before":[],"after":[],"conflictsWith":[]},"steps":[{"stepKey":"dry-care","action":"apply_product","copyTemplateDe":"Mit 1 Tropfen oder einer sehr kleinen Menge in trockenen {{application_area_de}} beginnen und nur bei Bedarf ergänzen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips","sourceType":"professional_authority","checkedAt":"2026-08-12"}]}$json$::jsonb,
     $json${"schemaVersion":2,"contractKind":"family_template","guidanceKey":"oil.leave-in.dry-care.v2","protocolVersion":3,"locale":"de","scope":{"kind":"application_family","category":"oil"},"role":"leave_in","applicationFamily":"between_wash_dry_care","compatibleDayTypes":["between_wash_care_day"],"sequence":{"anchor":"dry_finish","before":[],"after":[],"conflictsWith":[]},"steps":[{"stepKey":"dry-care","action":"apply_product","copyTemplateDe":"Mit 1 Tropfen oder einer sehr kleinen Menge in trockenen {{application_area_de}} beginnen und nur bei Bedarf ergänzen."}],"evidence":[{"sourceUrl":"https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips","sourceType":"professional_authority","checkedAt":"2026-08-12"}]}$json$::jsonb)
    ) AS target(guidance_key, role_key, application_family, previous_payload, next_payload)
  LOOP
    SELECT protocol.* INTO v_active
    FROM public.application_guidance_protocols protocol
    WHERE protocol.guidance_key = v_target.guidance_key
      AND protocol.locale = 'de'
      AND protocol.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
      IF EXISTS (
        SELECT 1 FROM public.application_guidance_protocols protocol
        WHERE protocol.guidance_key = v_target.guidance_key
      ) THEN
        RAISE EXCEPTION 'shared template % has no active version', v_target.guidance_key;
      END IF;
      CONTINUE;
    END IF;

    IF v_active.contract_version IS DISTINCT FROM 2
       OR v_active.scope_kind IS DISTINCT FROM 'application_family'
       OR v_active.category_key IS DISTINCT FROM 'oil'
       OR v_active.role_key IS DISTINCT FROM v_target.role_key
       OR v_active.application_family IS DISTINCT FROM v_target.application_family
       OR v_active.product_id IS NOT NULL THEN
      RAISE EXCEPTION 'shared template % has drifted indexed columns', v_target.guidance_key;
    END IF;

    IF v_active.protocol_version = 3 AND v_active.payload = v_target.next_payload THEN
      CONTINUE;
    END IF;

    IF v_active.protocol_version IS DISTINCT FROM 2
       OR v_active.payload IS DISTINCT FROM v_target.previous_payload THEN
      RAISE EXCEPTION 'shared template % does not match its reviewed version 2',
        v_target.guidance_key;
    END IF;

    UPDATE public.application_guidance_protocols protocol
    SET status = 'retired'
    WHERE protocol.id = v_active.id;

    INSERT INTO public.application_guidance_protocols (
      id, guidance_key, protocol_version, locale, scope_kind, category_key, role_key,
      product_id, application_family, payload, status, verified_at, contract_version
    ) VALUES (
      pg_catalog.gen_random_uuid(), v_target.guidance_key, 3, 'de', 'application_family', 'oil', v_target.role_key,
      NULL, v_target.application_family, v_target.next_payload, 'active',
      pg_catalog.now(), 2
    );
  END LOOP;
END;
$oil_between_wash_templates$;

COMMIT;

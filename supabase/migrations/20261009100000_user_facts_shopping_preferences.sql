-- hair_profiles.shopping_preferences: the fourth guarded user-facts domain.
--
-- Holds what the member is willing to spend per care product (V1: `budget`, written whole by
-- the editor or by consultation staff). Written ONLY through public.user_facts_save_v1, like the
-- other three domains; the facts lock (20261003120000) is extended to cover the new column so a
-- write outside the door is rejected. The domain owns no derived legacy column: a budget write
-- changes only shopping_preferences, facts_provenance, facts_revision and updated_at.
--
-- user_facts_save_v1 is the body of 20261006180000_user_facts_assumed_never_replaces_real.sql,
-- unchanged except: the allowed-domain list, the old-document CASE, a new write branch for
-- shopping_preferences, the final quiz_context branch made explicit (plus a defensive ELSE
-- RAISE), and the COMMENT. Signature, grants, return shape and facts_revision semantics are
-- unchanged. Rollback: re-apply the function bodies of 20261006180000 and 20261003120000, then
-- DROP CONSTRAINT hair_profiles_shopping_preferences_object and DROP COLUMN shopping_preferences.
--
-- Must run after 20261003120000 (the apply-time check below raises for an unclassified column).

ALTER TABLE public.hair_profiles
  ADD COLUMN shopping_preferences jsonb;

ALTER TABLE public.hair_profiles
  ADD CONSTRAINT hair_profiles_shopping_preferences_object
  CHECK (shopping_preferences IS NULL OR pg_catalog.jsonb_typeof(shopping_preferences) = 'object');

COMMENT ON COLUMN public.hair_profiles.shopping_preferences IS
  'ShoppingPreferencesV1 (src/lib/user-facts/schema.ts): what the member is willing to spend per care product (`budget`: capped at 5 or 15 EUR with allowExceptions, or uncapped). Absent = not collected, never treated as uncapped. Owns no derived legacy column. Written ONLY by public.user_facts_save_v1.';

COMMENT ON COLUMN public.hair_profiles.facts_provenance IS
  'domain (''diagnostics''|''care_habits''|''quiz_context''|''shopping_preferences'') -> DomainProvenance {source:{kind,id?}, schemaVersion, at, editedAt?, fields?, preservedCandidates?}. `fields` accumulates per-field provenance across writes; `preservedCandidates` records artifact/lead sources that a create_only account link did NOT apply. Written ONLY by public.user_facts_save_v1.';

-- The two fact-column lists of the lock, now with 27 keys (shopping_preferences added). Function
-- bodies are copied from 20261003120000; privileges are preserved by CREATE OR REPLACE and
-- restated below.
CREATE OR REPLACE FUNCTION public.hair_profiles_fact_column_defaults_v1()
RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT '{
    "diagnostics": null, "care_habits": null, "quiz_context": null, "shopping_preferences": null,
    "facts_provenance": {}, "facts_revision": 0,
    "hair_texture": null, "thickness": null, "density": null, "hair_length": null,
    "cuticle_condition": null, "protein_moisture_balance": null, "scalp_type": null,
    "scalp_condition": null, "chemical_treatment": [], "concerns": [], "goals": [],
    "desired_volume": null, "primary_concern": null,
    "drying_method": null, "heat_styling": null, "styling_tools": null,
    "uses_heat_protection": false, "towel_material": null, "towel_technique": null,
    "night_protection": null, "brush_type": null
  }'::jsonb
$$;

CREATE OR REPLACE FUNCTION public.hair_profiles_reject_fact_write_outside_door()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  -- Inline, not a call to hair_profiles_fact_column_defaults_v1(): the guard runs as the writer,
  -- and a role that may write non-fact columns must not need EXECUTE on anything to do so.
  c_facts CONSTANT jsonb := '{
    "diagnostics": null, "care_habits": null, "quiz_context": null, "shopping_preferences": null,
    "facts_provenance": {}, "facts_revision": 0,
    "hair_texture": null, "thickness": null, "density": null, "hair_length": null,
    "cuticle_condition": null, "protein_moisture_balance": null, "scalp_type": null,
    "scalp_condition": null, "chemical_treatment": [], "concerns": [], "goals": [],
    "desired_volume": null, "primary_concern": null,
    "drying_method": null, "heat_styling": null, "styling_tools": null,
    "uses_heat_protection": false, "towel_material": null, "towel_technique": null,
    "night_protection": null, "brush_type": null
  }'::jsonb;
  v_after jsonb;
  v_before jsonb;
  v_columns text[];
BEGIN
  -- The door, writing this very row.
  IF NEW.user_id::text = pg_catalog.current_setting('app.user_facts_writer', true)
     AND (TG_OP = 'INSERT' OR OLD.user_id = NEW.user_id) THEN
    RETURN NEW;
  END IF;

  v_after := pg_catalog.to_jsonb(NEW);
  v_before := CASE WHEN TG_OP = 'INSERT' THEN c_facts ELSE pg_catalog.to_jsonb(OLD) END;

  -- Compared as stored text, not by jsonb meaning (header: `1.0` vs `1`).
  SELECT pg_catalog.array_agg(changed.name ORDER BY changed.name) INTO v_columns
    FROM (
      SELECT fact.name
        FROM pg_catalog.jsonb_object_keys(c_facts) AS fact(name)
       WHERE (v_after -> fact.name)::text IS DISTINCT FROM (v_before -> fact.name)::text
      UNION ALL
      SELECT 'user_id'
       WHERE TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id
    ) AS changed;

  IF v_columns IS NOT NULL THEN
    RAISE EXCEPTION 'hair_profiles_fact_write_outside_door'
      USING ERRCODE = 'insufficient_privilege',
            DETAIL = 'columns: ' || pg_catalog.array_to_string(v_columns, ', '),
            HINT = 'Profile facts are written only by public.user_facts_save_v1.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.hair_profiles_fact_column_defaults_v1() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.hair_profiles_reject_fact_write_outside_door() FROM PUBLIC, anon, authenticated;

-- Refuse to apply over a table the extended lock does not describe (same check as 20261003120000).
DO $$
DECLARE
  c_other CONSTANT text[] := ARRAY[
    'id', 'user_id', 'created_at', 'updated_at', 'conversation_memory',
    'products_used', 'routine_preference', 'additional_notes'];
  v_facts jsonb := public.hair_profiles_fact_column_defaults_v1();
  v_column record;
  v_default jsonb;
  v_last_before text;
BEGIN
  FOR v_column IN
    SELECT a.attname::text AS name,
           pg_catalog.format_type(a.atttypid, a.atttypmod) AS type,
           pg_catalog.pg_get_expr(d.adbin, d.adrelid) AS default_expr
      FROM pg_catalog.pg_attribute AS a
      LEFT JOIN pg_catalog.pg_attrdef AS d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
     WHERE a.attrelid = 'public.hair_profiles'::pg_catalog.regclass
       AND a.attnum > 0 AND NOT a.attisdropped
  LOOP
    IF v_facts ? v_column.name THEN
      v_default := 'null'::jsonb;
      IF v_column.default_expr IS NOT NULL THEN
        EXECUTE pg_catalog.format(
          'SELECT pg_catalog.to_jsonb((%s)::%s)', v_column.default_expr, v_column.type)
          INTO v_default;
      END IF;
      IF v_default IS DISTINCT FROM v_facts -> v_column.name THEN
        RAISE EXCEPTION 'hair_profiles_fact_default_mismatch'
          USING DETAIL = pg_catalog.format('%s: table default %s, expected %s',
            v_column.name, v_default, v_facts -> v_column.name);
      END IF;
    ELSIF NOT (v_column.name = ANY (c_other)) THEN
      RAISE EXCEPTION 'hair_profiles_unclassified_column' USING DETAIL = v_column.name;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.jsonb_object_keys(v_facts) AS fact(name)
     WHERE NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_attribute AS a
        WHERE a.attrelid = 'public.hair_profiles'::pg_catalog.regclass
          AND a.attname = fact.name AND NOT a.attisdropped)
  ) THEN
    RAISE EXCEPTION 'hair_profiles_fact_column_missing';
  END IF;

  -- tgtype: bit 0 = ROW, bit 1 = BEFORE.
  SELECT t.tgname INTO v_last_before
    FROM pg_catalog.pg_trigger AS t
   WHERE t.tgrelid = 'public.hair_profiles'::pg_catalog.regclass
     AND NOT t.tgisinternal AND (t.tgtype & 3) = 3
   ORDER BY t.tgname DESC LIMIT 1;
  IF v_last_before IS DISTINCT FROM 'zz_hair_profiles_fact_write_guard' THEN
    RAISE EXCEPTION 'hair_profiles_fact_guard_not_last' USING DETAIL = v_last_before;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.user_facts_save_v1(
  p_user_id uuid,
  p_domain text,
  p_patch jsonb,
  p_provenance jsonb,
  p_expected_revision integer DEFAULT NULL,
  p_mode text DEFAULT 'upsert',
  p_source_draft_id uuid DEFAULT NULL,
  p_expected_draft_revision bigint DEFAULT NULL,
  p_expected_initial_version_id uuid DEFAULT NULL,
  p_expected_updated_at timestamptz DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_profile public.hair_profiles%ROWTYPE;
  v_draft public.personal_plan_refinement_drafts%ROWTYPE;
  v_plan_initial_version_id uuid;
  v_current_revision integer;
  v_old_domain jsonb;
  v_new_domain jsonb;
  v_cleared_keys text[];
  v_old_provenance jsonb;
  v_merged_provenance jsonb;
  v_fields jsonb;
  v_candidates jsonb;
  v_columns jsonb;
  v_changed boolean;
  v_diagnostics jsonb;
  v_inserted integer := 0;
  v_updated_at timestamptz;
  v_kept_real_keys text[];
BEGIN
  -- (1) Input validation. Nothing is read or written before this passes.
  IF p_domain IS NULL OR p_domain NOT IN ('diagnostics', 'care_habits', 'quiz_context', 'shopping_preferences') THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_input', 'reason', 'unknown_domain');
  END IF;
  IF pg_catalog.jsonb_typeof(p_patch) IS DISTINCT FROM 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_input', 'reason', 'patch_not_object');
  END IF;
  IF pg_catalog.jsonb_typeof(p_provenance) IS DISTINCT FROM 'object' THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_input', 'reason', 'provenance_not_object');
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('upsert', 'create_only') THEN
    RETURN pg_catalog.jsonb_build_object('status', 'invalid_input', 'reason', 'unknown_mode');
  END IF;

  -- (2) Draft binding (F22), validated INSIDE this transaction and before the
  -- profile row is touched, so a rejected binding leaves no trace at all — not
  -- even an empty hair_profiles row. Draft lock first, profile lock second.
  IF p_source_draft_id IS NOT NULL THEN
    SELECT * INTO v_draft
      FROM public.personal_plan_refinement_drafts
     WHERE id = p_source_draft_id AND user_id = p_user_id
       FOR UPDATE;
    IF v_draft.id IS NULL THEN
      RETURN pg_catalog.jsonb_build_object('status', 'draft_conflict', 'reason', 'not_found');
    END IF;
    IF v_draft.status <> 'in_progress' THEN
      RETURN pg_catalog.jsonb_build_object('status', 'draft_conflict', 'reason', 'not_in_progress');
    END IF;
    IF v_draft.revision IS DISTINCT FROM p_expected_draft_revision THEN
      RETURN pg_catalog.jsonb_build_object('status', 'draft_conflict', 'reason', 'revision_mismatch');
    END IF;
    SELECT current_initial_need_version_id INTO v_plan_initial_version_id
      FROM public.personal_plans WHERE id = v_draft.personal_plan_id;
    -- Both ends must agree with the caller: the draft still descends from the
    -- version it was opened on, AND the plan still points at that version.
    IF v_draft.base_initial_need_version_id IS DISTINCT FROM p_expected_initial_version_id
       OR v_plan_initial_version_id IS DISTINCT FROM p_expected_initial_version_id THEN
      RETURN pg_catalog.jsonb_build_object('status', 'draft_conflict', 'reason', 'stale_source');
    END IF;
  END IF;

  -- (3) Lock the profile row, creating it when it is missing. A missing row
  -- counts as revision 0, and the CAS is checked against that BEFORE the insert
  -- so a stale caller never leaves an empty row behind.
  SELECT * INTO v_profile FROM public.hair_profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    IF p_expected_revision IS NOT NULL AND p_expected_revision <> 0 THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'revision_conflict', 'revision', 0, 'reason', 'revision_mismatch');
    END IF;
    -- The caller loaded a row that is gone now: never recreate it from that stale read.
    IF p_expected_updated_at IS NOT NULL THEN
      RETURN pg_catalog.jsonb_build_object(
        'status', 'revision_conflict', 'revision', 0, 'reason', 'updated_at_mismatch');
    END IF;
    -- ON CONFLICT + re-select: a concurrent account link may have created the
    -- row between the select above and this insert. Whoever lost simply
    -- continues against the winner's row, re-checking the CAS below.
    PERFORM pg_catalog.set_config('app.user_facts_writer', p_user_id::text, true);
    INSERT INTO public.hair_profiles (user_id) VALUES (p_user_id)
      ON CONFLICT (user_id) DO NOTHING;
    -- Whether THIS call created the row (reported as `created`): a caller that saw no row
    -- (mobile_registration_publish) must not treat a row some other writer created in between
    -- as its own — that writer's row can carry facts_revision 0, so the CAS alone cannot tell.
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    PERFORM pg_catalog.set_config('app.user_facts_writer', '', true);
    SELECT * INTO v_profile FROM public.hair_profiles WHERE user_id = p_user_id FOR UPDATE;
    -- Unreachable in practice (the insert either wrote the row or lost to a
    -- concurrent writer whose row is now visible and locked). Raising beats
    -- continuing: every UPDATE below is keyed on user_id, so a vanished row
    -- would silently update ZERO rows and still return {"status":"ok"}.
    IF NOT FOUND THEN
      RAISE EXCEPTION 'user_facts_save_v1: hair_profiles row vanished for user %', p_user_id
        USING ERRCODE = 'internal_error';
    END IF;
  END IF;

  v_current_revision := v_profile.facts_revision;
  IF p_expected_revision IS NOT NULL AND p_expected_revision <> v_current_revision THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'revision_conflict', 'revision', v_current_revision,
      'reason', 'revision_mismatch');
  END IF;
  -- Fix round 6 (I1): the row-content guard. Compared at the stored microsecond precision;
  -- see the header for why it is conservative.
  IF p_expected_updated_at IS NOT NULL
     AND v_profile.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RETURN pg_catalog.jsonb_build_object(
      'status', 'revision_conflict', 'revision', v_current_revision,
      'reason', 'updated_at_mismatch');
  END IF;

  v_old_domain := CASE p_domain
    WHEN 'diagnostics' THEN v_profile.diagnostics
    WHEN 'care_habits' THEN v_profile.care_habits
    WHEN 'shopping_preferences' THEN v_profile.shopping_preferences
    ELSE v_profile.quiz_context
  END;
  v_old_provenance := COALESCE(v_profile.facts_provenance -> p_domain, '{}'::jsonb);

  -- (4) create_only (F14/F28): never overwrite a domain the user already has —
  -- a PURE preserve of any non-null domain that records the incoming candidate.
  -- TypeScript decides winners and losers (decision wave 1 + wave-1 fix F3,
  -- Nick 2026-09-30): a winning quiz writes with upsert, a losing one with
  -- create_only. There is deliberately no source-kind exception here: a
  -- `legacy_columns` document with a newer hand edit must survive, and only
  -- TypeScript can see the quiz time that decides that.
  IF p_mode = 'create_only' AND v_old_domain IS NOT NULL THEN
    v_candidates := public.user_facts_union_preserved_candidates_v1(
      v_old_provenance -> 'preservedCandidates', p_provenance -> 'preservedCandidates');
    IF v_candidates IS NOT NULL THEN
      PERFORM pg_catalog.set_config('app.user_facts_writer', p_user_id::text, true);
      UPDATE public.hair_profiles
         SET facts_provenance = facts_provenance || pg_catalog.jsonb_build_object(
               p_domain,
               v_old_provenance || pg_catalog.jsonb_build_object('preservedCandidates', v_candidates))
       WHERE user_id = p_user_id;
      PERFORM pg_catalog.set_config('app.user_facts_writer', '', true);
    END IF;
    SELECT updated_at INTO v_updated_at FROM public.hair_profiles WHERE user_id = p_user_id;
    RETURN pg_catalog.jsonb_build_object(
      'status', 'preserved',
      'revision', v_current_revision,
      'changed', false,
      'diagnosticsHash', public.user_facts_diagnostics_hash_v1(v_profile.diagnostics),
      'updatedAt', v_updated_at);
  END IF;

  -- (Decision wave 1, Nick 2026-09-30: the former Task 5a C1 goals anti-clobber
  -- step that dropped `goals` from a create_only patch over a `legacy_columns`
  -- document is gone. "Latest own quiz wins" — the TS account-link writer
  -- decides whether a quiz may write, and a quiz that writes replaces goals
  -- like every other field.)

  -- (4b) care_habits precedence (20261006180000): an `assumed` field only fills a gap. A
  -- patch key the caller marks `assumed` — a value or a JSON-null clear — is dropped (value and
  -- provenance) when the stored domain already holds that key with any other provenance
  -- (`user`, `unknown_historical`, or no entry, which counts as real like `toFieldProvenance`'s
  -- default). Direct acceptance, the facts rebase and Feinschliff completion all publish assumed
  -- defaults through here; without this a legacy member's real towel/drying/heat/night answers
  -- were replaced by them. Every non-assumed key is untouched, so only a real answer can
  -- replace or clear a real answer. Diagnostics keep latest-write-wins (the account-link
  -- "latest own quiz wins" ruling, decision wave 1, Nick 2026-09-30).
  IF p_domain = 'care_habits' AND v_old_domain IS NOT NULL THEN
    SELECT COALESCE(pg_catalog.array_agg(entry.key), ARRAY[]::text[]) INTO v_kept_real_keys
      FROM pg_catalog.jsonb_each(p_patch) AS entry(key, value)
     WHERE (p_provenance -> 'fields' ->> entry.key) = 'assumed'
       AND v_old_domain ? entry.key
       AND COALESCE(v_old_provenance -> 'fields' ->> entry.key, '') <> 'assumed';
    IF pg_catalog.cardinality(v_kept_real_keys) > 0 THEN
      p_patch := p_patch - v_kept_real_keys;
      p_provenance := pg_catalog.jsonb_set(
        p_provenance, '{fields}', (p_provenance -> 'fields') - v_kept_real_keys);
    END IF;
  END IF;

  -- (5) Field-level merge (F13). A key whose patch value is JSON null is
  -- CLEARED; every other key is replaced wholesale; keys the patch does not
  -- name survive untouched.
  --
  -- Deliberately NOT `jsonb_strip_nulls`: that recurses, and
  -- `diagnostics.source.raw` is the verbatim quiz envelope (task 1) which may
  -- legitimately contain nulls. Only TOP-LEVEL nulls are clear instructions.
  SELECT COALESCE(pg_catalog.array_agg(entry.key), ARRAY[]::text[]) INTO v_cleared_keys
    FROM pg_catalog.jsonb_each(p_patch) AS entry(key, value)
   WHERE pg_catalog.jsonb_typeof(entry.value) = 'null';

  v_new_domain := (COALESCE(v_old_domain, '{}'::jsonb) || p_patch) - v_cleared_keys;
  v_changed := v_new_domain IS DISTINCT FROM v_old_domain;

  -- (6) Provenance: this write's envelope plus the accumulated per-field map
  -- (cleared fields drop out with the data they described).
  v_fields := (
    COALESCE(v_old_provenance -> 'fields', '{}'::jsonb)
    || COALESCE(p_provenance -> 'fields', '{}'::jsonb)
  ) - v_cleared_keys;
  v_merged_provenance := p_provenance - 'fields' - 'preservedCandidates';
  IF v_fields <> '{}'::jsonb THEN
    v_merged_provenance := v_merged_provenance || pg_catalog.jsonb_build_object('fields', v_fields);
  END IF;

  -- `preservedCandidates` is evidence of a source that was NOT applied, so only
  -- the preserve path above may add to it (controller ruling 2026-09-15). This
  -- write applied its source, so any incoming array is ignored — the account-link
  -- caller passes one unconditionally — while an array recorded by an EARLIER
  -- preserve survives untouched.
  v_candidates := CASE
    WHEN pg_catalog.jsonb_typeof(v_old_provenance -> 'preservedCandidates') = 'array'
      THEN v_old_provenance -> 'preservedCandidates'
    ELSE NULL
  END;
  IF v_candidates IS NOT NULL THEN
    v_merged_provenance :=
      v_merged_provenance || pg_catalog.jsonb_build_object('preservedCandidates', v_candidates);
  END IF;

  -- (7) Store the domain and recompute ONLY the columns it owns, in the same
  -- statement, from the document just merged. The revision counts WRITES, not
  -- diffs (F04), so it is bumped even when `changed` is false.
  PERFORM pg_catalog.set_config('app.user_facts_writer', p_user_id::text, true);
  IF p_domain = 'diagnostics' THEN
    v_columns := public.user_facts_derive_diagnostics_columns_v1(v_new_domain);
    UPDATE public.hair_profiles
       SET diagnostics = v_new_domain,
           facts_provenance =
             facts_provenance || pg_catalog.jsonb_build_object(p_domain, v_merged_provenance),
           facts_revision = v_current_revision + 1,
           hair_texture = v_columns ->> 'hair_texture',
           thickness = v_columns ->> 'thickness',
           density = v_columns ->> 'density',
           hair_length = v_columns ->> 'hair_length',
           cuticle_condition = v_columns ->> 'cuticle_condition',
           protein_moisture_balance = v_columns ->> 'protein_moisture_balance',
           scalp_type = v_columns ->> 'scalp_type',
           scalp_condition = v_columns ->> 'scalp_condition',
           chemical_treatment =
             public.user_facts_jsonb_text_array_v1(v_columns -> 'chemical_treatment'),
           concerns = public.user_facts_jsonb_text_array_v1(v_columns -> 'concerns'),
           goals = public.user_facts_jsonb_text_array_v1(v_columns -> 'goals'),
           desired_volume = v_columns ->> 'desired_volume',
           -- main #611 (20260925100000_hair_profiles_primary_concern.sql): its BEFORE
           -- trigger still drops a value `concerns` does not contain.
           primary_concern = v_columns ->> 'primary_concern',
           updated_at = pg_catalog.now()
     WHERE user_id = p_user_id;
  ELSIF p_domain = 'care_habits' THEN
    v_columns := public.user_facts_derive_care_habits_columns_v1(v_new_domain);
    UPDATE public.hair_profiles
       SET care_habits = v_new_domain,
           facts_provenance =
             facts_provenance || pg_catalog.jsonb_build_object(p_domain, v_merged_provenance),
           facts_revision = v_current_revision + 1,
           drying_method = v_columns ->> 'drying_method',
           heat_styling = v_columns ->> 'heat_styling',
           styling_tools = public.user_facts_jsonb_text_array_v1(v_columns -> 'styling_tools'),
           uses_heat_protection = (v_columns ->> 'uses_heat_protection')::boolean,
           towel_material = v_columns ->> 'towel_material',
           towel_technique = v_columns ->> 'towel_technique',
           night_protection = public.user_facts_jsonb_text_array_v1(v_columns -> 'night_protection'),
           brush_type = public.user_facts_jsonb_text_array_v1(v_columns -> 'brush_type'),
           updated_at = pg_catalog.now()
     WHERE user_id = p_user_id;
  ELSIF p_domain = 'shopping_preferences' THEN
    -- shopping_preferences owns no projection (20261009100000).
    UPDATE public.hair_profiles
       SET shopping_preferences = v_new_domain,
           facts_provenance =
             facts_provenance || pg_catalog.jsonb_build_object(p_domain, v_merged_provenance),
           facts_revision = v_current_revision + 1,
           updated_at = pg_catalog.now()
     WHERE user_id = p_user_id;
  ELSIF p_domain = 'quiz_context' THEN
    -- quiz_context owns no projection.
    UPDATE public.hair_profiles
       SET quiz_context = v_new_domain,
           facts_provenance =
             facts_provenance || pg_catalog.jsonb_build_object(p_domain, v_merged_provenance),
           facts_revision = v_current_revision + 1,
           updated_at = pg_catalog.now()
     WHERE user_id = p_user_id;
  ELSE
    -- Unreachable: the domain list is validated in step (1).
    RAISE EXCEPTION 'user_facts_save_v1: unknown domain %', p_domain;
  END IF;
  PERFORM pg_catalog.set_config('app.user_facts_writer', '', true);

  SELECT diagnostics, updated_at INTO v_diagnostics, v_updated_at
    FROM public.hair_profiles WHERE user_id = p_user_id;

  RETURN pg_catalog.jsonb_build_object(
    'status', 'ok',
    'revision', v_current_revision + 1,
    'changed', v_changed,
    'diagnosticsHash', public.user_facts_diagnostics_hash_v1(v_diagnostics),
    'created', v_inserted = 1,
    'updatedAt', v_updated_at);
END;
$$;

COMMENT ON FUNCTION public.user_facts_save_v1(
  uuid, text, jsonb, jsonb, integer, text, uuid, bigint, uuid, timestamptz) IS
  'The only supported writer of hair_profiles.diagnostics/care_habits/quiz_context/shopping_preferences and of the 21 legacy columns derived from diagnostics and care_habits. Merges p_patch field-by-field (a top-level JSON null clears that field), merges provenance (care_habits: a field marked assumed never replaces a stored non-assumed one — 20261006180000), bumps facts_revision on every non-preserved write (CAS via p_expected_revision), and recomputes the derived columns owned by p_domain in the same statement. create_only is a pure preserve of any existing domain (it only records the incoming candidate); callers decide winners and write them with upsert. Optional p_expected_updated_at: the row''s updated_at as the caller loaded it; any other value (a legacy column write, or any other row write — set_updated_at_hair_profiles bumps it on every UPDATE) is a revision_conflict with reason updated_at_mismatch. Returns {status, revision, changed, diagnosticsHash, created, updatedAt} (created: this call inserted the row; updatedAt: the row''s updated_at after the call, the next p_expected_updated_at) or a typed conflict (revision_conflict carries reason revision_mismatch | updated_at_mismatch).';

REVOKE ALL ON FUNCTION public.user_facts_save_v1(
  uuid, text, jsonb, jsonb, integer, text, uuid, bigint, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_facts_save_v1(
  uuid, text, jsonb, jsonb, integer, text, uuid, bigint, uuid, timestamptz) TO service_role;

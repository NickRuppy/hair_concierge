-- Central user profile, clean switch task 9 (plans/2026-09-30-central-user-profile-clean-switch.md
-- §1, §8 task 9, §11 step 3): lock the door. After this migration the database rejects every
-- write of a profile fact on `public.hair_profiles` that `public.user_facts_save_v1` did not
-- make. A permanent guard, not a sync bridge.
--
-- APPLY LAST (rollout step 3): after the additive migrations + backfill (step 1) and the code
-- deploy (step 2). Applied earlier, every still-deployed legacy writer (old onboarding browser
-- upsert, old /api/profile/answers column write, old mobile publishers' column patch) fails with
-- `hair_profiles_fact_write_outside_door` / `permission denied`. Code rolled back after this
-- step needs the lock removed first (ROLLBACK below).
--
-- ---------------------------------------------------------------------------------------------
-- Column classification — every column of hair_profiles (00001 … 20260929231100). The block at
-- the end REFUSES TO APPLY if the live table has a column not listed here, a fact column whose
-- default differs from `hair_profiles_fact_column_defaults_v1()`, a missing fact column, or a
-- before-row trigger that sorts after the guard. The guard holds the same list as an inline
-- constant (it runs as the writer, whatever role that is; tests pin the two literals equal).
--
--   FACT (26) — written only by the door; guarded:
--     documents   diagnostics, care_habits, quiz_context, facts_provenance, facts_revision
--     diagnostics hair_texture, thickness, density, hair_length, cuticle_condition,
--     (13)        protein_moisture_balance, scalp_type, scalp_condition, chemical_treatment,
--                 concerns, goals, desired_volume, primary_concern
--     care_habits drying_method, heat_styling, styling_tools, uses_heat_protection,
--     (8)         towel_material, towel_technique, night_protection, brush_type
--   NOT A FACT (8) — no domain derives them; stay writable by their existing writers:
--     id, created_at        identity / insert time
--     user_id               identity; free on INSERT, but CHANGING it moves a person's facts to
--                           someone else, so the guard treats a change as a fact write
--     updated_at            touched by set_updated_at_hair_profiles and by the door
--     conversation_memory   chat memory cache (src/lib/chat-runtime/user-memory.ts, service role)
--     products_used, routine_preference, additional_notes
--                           legacy free fields; read by chat context, no writer left in src/
--
-- ---------------------------------------------------------------------------------------------
-- Mechanism. The door sets the transaction-local setting `app.user_facts_writer` to the user id
-- it is writing immediately before each of its INSERT/UPDATE statements and resets it to ''
-- immediately after (20260929231300, edited in place — unapplied). The guard below allows a
-- fact change only when that setting equals the row's user_id. Not role-based (the iOS
-- publishers run as the same owner as the door) and not pg_trigger_depth()-based.
--   * No leak: normal exits reset explicitly; on an error between set and reset, the setting is
--     rolled back with the (sub)transaction — a caller's SAVEPOINT / plpgsql EXCEPTION block
--     reverts it, an uncaught error aborts the transaction. Tested both ways.
--   * anon / authenticated: INSERT and UPDATE on hair_profiles are revoked below (no browser
--     code writes the table any more), so a forged setting gets them nothing. TRUNCATE, TRIGGER
--     and REFERENCES are revoked from them too (no application use).
--   * RESIDUAL HOLE, accepted: whoever can run arbitrary SQL with UPDATE on the table can call
--     set_config itself and write. PostgREST clients cannot — set_config is not an exposed RPC
--     and each request is its own transaction — and service_role cannot log in directly. The
--     realistic forgers are `postgres` / `supabase_admin` connections (dashboard SQL editor,
--     migrations, ad-hoc scripts over the database URL) and future SECURITY DEFINER code that
--     sets the flag or writes the table itself. Such sessions can equally DISABLE TRIGGER; this
--     guard protects against application code, not against database administrators.
--   * The no-op test compares the stored TEXT of each fact (`::text`), not jsonb equality: `1.0`
--     equals `1` as jsonb but is a different stored document (and `user_facts_diagnostics_hash_v1`
--     hashes `diagnostics::text`). SQL NULL and JSON `null` on the three documents and
--     facts_provenance look the same to it (`to_jsonb(row)` renders both as `null`); that gap is
--     closed only by the `hair_profiles_*_object` CHECK constraints from 20260929231100.
--
-- Firing order relied on: Postgres fires same-kind row triggers in name order. The guard is
-- named `zz_…` so it runs AFTER `hair_profiles_primary_concern_contained` (which may rewrite
-- `primary_concern`, a fact) and `set_updated_at_hair_profiles`: it judges the row as it will be
-- stored, so the containment trigger can neither be rejected inside the door nor act as a
-- bypass outside it. `scanner_context_source_changed` is an AFTER trigger and unaffected.
-- Pinned by tests/user-facts-lock-postgres.test.ts and checked when this migration applies.
--
-- Error: SQLSTATE 42501, message `hair_profiles_fact_write_outside_door`, DETAIL
-- `columns: <sorted offending columns>`. Setting a fact column to the value it already has is
-- not a change and is allowed. DELETE is not guarded (account deletion, partner fresh start).
--
-- ROLLBACK (removes the lock; the door keeps working without it):
--   DROP TRIGGER zz_hair_profiles_fact_write_guard ON public.hair_profiles;
--   DROP FUNCTION public.hair_profiles_reject_fact_write_outside_door();
--   DROP FUNCTION public.hair_profiles_fact_column_defaults_v1();
--   GRANT INSERT, UPDATE, TRUNCATE, TRIGGER, REFERENCES ON public.hair_profiles TO anon, authenticated;

-- The fact columns and the value each has in a row nobody wrote facts into (its column default).
-- An INSERT outside the door must carry exactly these; the door's own `INSERT (user_id)` is
-- flagged and never depends on them.
CREATE FUNCTION public.hair_profiles_fact_column_defaults_v1()
RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$
  SELECT '{
    "diagnostics": null, "care_habits": null, "quiz_context": null,
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

CREATE FUNCTION public.hair_profiles_reject_fact_write_outside_door()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
DECLARE
  -- Inline, not a call to hair_profiles_fact_column_defaults_v1(): the guard runs as the writer,
  -- and a role that may write non-fact columns must not need EXECUTE on anything to do so.
  c_facts CONSTANT jsonb := '{
    "diagnostics": null, "care_habits": null, "quiz_context": null,
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

CREATE TRIGGER zz_hair_profiles_fact_write_guard
  BEFORE INSERT OR UPDATE ON public.hair_profiles
  FOR EACH ROW EXECUTE FUNCTION public.hair_profiles_reject_fact_write_outside_door();

COMMENT ON TRIGGER zz_hair_profiles_fact_write_guard ON public.hair_profiles IS
  'Rejects any change of a profile fact column not made by public.user_facts_save_v1 (flag app.user_facts_writer = this row''s user_id). Named zz_ to fire after every other BEFORE row trigger. See 20260930120000_user_facts_lock.sql.';

-- The column list is read only by the apply-time check below (as the migration owner); the guard
-- carries its own inline copy.
REVOKE ALL ON FUNCTION public.hair_profiles_fact_column_defaults_v1() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.hair_profiles_reject_fact_write_outside_door() FROM PUBLIC, anon, authenticated;

-- No browser code writes hair_profiles (reads only); every server writer uses service_role.
-- Revoking the table-level privileges also revokes any column-level ones. SELECT, DELETE and the
-- RLS policies are unchanged; the insert_own/update_own policies become inert. TRUNCATE, TRIGGER
-- and REFERENCES have no application use (production grants recorded 2026-09-30: anon,
-- authenticated, postgres and service_role each held all seven table privileges).
REVOKE INSERT, UPDATE, TRUNCATE, TRIGGER, REFERENCES ON public.hair_profiles FROM anon, authenticated;

-- Refuse to apply over a table this file does not describe.
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

-- DRAFT ONLY — NOT APPLIED. Requires 20261012190000_widen_engine_concern_goal_vocabulary.sql.
-- One-off repair for affected existing profiles; no source/facts changes.
-- Run as migration owner only after a reviewed candidate count and separate authorization.
-- Default is a rollback rehearsal. Change ROLLBACK to COMMIT only for an authorized run.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
DECLARE
  v_row record;
  v_columns jsonb;
  v_result jsonb;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT hp.*
    FROM public.hair_profiles hp
    WHERE hp.diagnostics IS NOT NULL
      AND (
        hp.diagnostics -> 'currentConcerns' ?| ARRAY['low_shine', 'lost_shape', 'low_volume_or_weighed_down']
        OR hp.diagnostics -> 'goals' ? 'volume_balance'
      )
    ORDER BY hp.user_id
    FOR UPDATE
  LOOP
    v_columns := public.user_facts_derive_diagnostics_columns_v1(v_row.diagnostics);
    IF ROW(v_row.concerns, v_row.primary_concern, v_row.goals, v_row.desired_volume)
      IS NOT DISTINCT FROM ROW(
        public.user_facts_jsonb_text_array_v1(v_columns -> 'concerns'),
        v_columns ->> 'primary_concern',
        public.user_facts_jsonb_text_array_v1(v_columns -> 'goals'),
        v_columns ->> 'desired_volume'
      ) THEN
      CONTINUE;
    END IF;
    -- Refuse to overwrite unrelated legacy drift as part of this narrow repair.
    IF EXISTS (
      SELECT 1 FROM pg_catalog.jsonb_each(
        v_columns - ARRAY['concerns','primary_concern','goals','desired_volume']
      ) AS derived(key, value)
      WHERE pg_catalog.to_jsonb(v_row) -> derived.key IS DISTINCT FROM derived.value
    ) THEN
      RAISE EXCEPTION 'unrelated diagnostics-column drift for %', v_row.user_id;
    END IF;
    IF v_row.facts_provenance -> 'diagnostics' IS NULL THEN
      RAISE EXCEPTION 'missing diagnostics provenance for %', v_row.user_id;
    END IF;
    -- Empty upsert re-derives columns, preserves the document/provenance, bumps the revision,
    -- and uses both revision and updated_at guards. No trigger bypass.
    v_result := public.user_facts_save_v1(
      p_user_id => v_row.user_id, p_domain => 'diagnostics', p_patch => '{}'::jsonb,
      p_provenance => v_row.facts_provenance -> 'diagnostics',
      p_expected_revision => v_row.facts_revision, p_mode => 'upsert',
      p_expected_updated_at => v_row.updated_at
    );
    IF v_result ->> 'status' IS DISTINCT FROM 'ok' THEN
      RAISE EXCEPTION 'facts save failed for %: %', v_row.user_id, v_result;
    END IF;
    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE 'NR2/NR3 profiles re-derived: % (audit previously identified 17; verify current count)', v_count;
END;
$$;

ROLLBACK;

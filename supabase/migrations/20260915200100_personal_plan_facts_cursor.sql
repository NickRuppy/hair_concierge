-- Central user profile, PR1 task 3 (2/3): the plan-side facts cursor and the
-- refinement-draft origin marker.
--
-- Once `hair_profiles` owns the facts (migration 20260915200000), a plan can be
-- BEHIND those facts: the user edited diagnostics in the Profil while their
-- Personal Plan still descends from the previous state. The three columns below
-- are that cursor, recorded on `personal_plans`:
--
--   pending_facts_revision  the hair_profiles.facts_revision the plan still has
--                           to catch up with (NULL = nothing pending)
--   pending_facts_draft_id  the refinement draft opened to rebase onto it
--   applied_facts_revision  the facts revision the plan's current Need version
--                           already descends from
--
-- All three are nullable with NO default: NULL means "never rebased" and is
-- read as 0 by consumers, which keeps the backfill free (no table rewrite, no
-- lying default on historical rows).
--
-- `pending_facts_draft_id` deliberately carries NO foreign key to
-- `personal_plan_refinement_drafts`: drafts are deleted/superseded by the
-- Stage-2 lifecycle independently of the plan row, and a RESTRICT/CASCADE edge
-- here would either block that cleanup or silently erase the cursor. The column
-- is a hint used to reopen the rebase draft; consumers must tolerate a dangling
-- id (draft gone -> open a fresh one).
--
-- Additive only, and independent of the function migration.

ALTER TABLE public.personal_plans
  ADD COLUMN IF NOT EXISTS pending_facts_revision integer,
  ADD COLUMN IF NOT EXISTS pending_facts_draft_id uuid,
  ADD COLUMN IF NOT EXISTS applied_facts_revision integer;

COMMENT ON COLUMN public.personal_plans.pending_facts_revision IS
  'hair_profiles.facts_revision this plan still needs to be rebased onto. NULL = nothing pending (never rebased rows read as 0).';

COMMENT ON COLUMN public.personal_plans.pending_facts_draft_id IS
  'personal_plan_refinement_drafts.id opened to rebase this plan onto pending_facts_revision. Intentionally NOT a foreign key: the Stage-2 draft lifecycle deletes/stales drafts independently of the plan row, so consumers must tolerate a dangling id and open a fresh draft.';

COMMENT ON COLUMN public.personal_plans.applied_facts_revision IS
  'hair_profiles.facts_revision the plan''s current Need version already descends from. NULL = never rebased (read as 0).';

ALTER TABLE public.personal_plan_refinement_drafts
  ADD COLUMN IF NOT EXISTS origin text DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
     WHERE conrelid = 'public.personal_plan_refinement_drafts'::pg_catalog.regclass
       AND conname = 'personal_plan_refinement_drafts_origin_check'
  ) THEN
    ALTER TABLE public.personal_plan_refinement_drafts
      ADD CONSTRAINT personal_plan_refinement_drafts_origin_check
      CHECK (origin IS NULL OR origin IN ('user', 'facts_rebase'));
  END IF;
END $$;

COMMENT ON COLUMN public.personal_plan_refinement_drafts.origin IS
  'Who opened this draft: ''user'' (the normal Feinschliff entry, also the column default — existing rows were backfilled with it by ADD COLUMN ... DEFAULT) or ''facts_rebase'' (opened automatically to rebase the plan onto a newer hair_profiles.facts_revision). Left nullable on purpose so a writer may store an explicit NULL for "unknown"; consumers read NULL as ''user''.';

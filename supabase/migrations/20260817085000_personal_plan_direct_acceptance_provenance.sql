-- Direct acceptance of a Stage-1 Idealplan runs the real Stage-2 → Stage-4
-- chain with a synthetic default answer set. The resulting Routine is
-- indistinguishable from an interactively refined one, so the provenance has to
-- be recorded separately for the "unverfeinert" state and its refinement nudge.
--
-- unrefined_direct_accept: true while the active Routine came from a direct
--   accept and the user has not accepted a real Stage-2 refinement proposal.
-- nudge_dismissed_until: the user snoozed the refinement nudge until this
--   instant; NULL means the nudge is not snoozed.
ALTER TABLE public.personal_plans
  ADD COLUMN IF NOT EXISTS unrefined_direct_accept boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nudge_dismissed_until timestamptz;

COMMENT ON COLUMN public.personal_plans.unrefined_direct_accept IS
  'The active Routine was accepted directly from the Stage-1 Idealplan with default Stage-2 answers.';
COMMENT ON COLUMN public.personal_plans.nudge_dismissed_until IS
  'The refinement nudge for a directly accepted Routine stays hidden until this instant.';

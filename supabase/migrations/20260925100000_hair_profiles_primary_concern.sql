-- Her stated main problem (discovery batch 7, PR 7a — F1; plan
-- plans/discovery-refinement-b7/plan.md Rev. 3 §1.1).
--
-- Both quizzes now ask „Wenn du dich auf eins konzentrieren müsstest – was stört
-- dich am meisten?" when two or more concerns are selected; with exactly one, that
-- one is the main problem. The quiz link (src/lib/quiz/link-to-profile.ts) writes it
-- here in the same legacy vocabulary as `concerns` (dry_lengths → dryness,
-- frizz_flyaways → frizz, hair_loss_or_thinning → hair_loss); a pick without a
-- legacy equivalent (low_shine, lost_shape, low_volume_or_weighed_down) and „no
-- statement" are both NULL. The inferred ranking this replaces never reached the
-- database.
--
--   * CHECK: NULL or one of the profile concern codes (PROFILE_CONCERNS in
--     src/lib/vocabulary/concerns-goals.ts — the vocabulary of `concerns`).
--   * Invariant „always one of concerns", enforced by dropping, never by rejecting:
--     other writers (profile edit, mobile registration/edit RPCs with their fixed
--     column lists) change `concerns` without knowing this column, so a BEFORE
--     trigger nulls a pick the row's `concerns` no longer contains instead of a
--     CHECK that would fail their writes.
--
-- Backward compatible with the deployed app: it never writes the column, and the
-- trigger only ever touches a non-NULL value. Apply BEFORE the deploy that writes it
-- (the quiz link would otherwise fail on the unknown column).
--
-- Reverse: DROP TRIGGER hair_profiles_primary_concern_contained ON public.hair_profiles;
-- DROP FUNCTION public.hair_profiles_drop_stale_primary_concern();
-- ALTER TABLE public.hair_profiles DROP COLUMN primary_concern;

ALTER TABLE public.hair_profiles
  ADD COLUMN primary_concern text;

ALTER TABLE public.hair_profiles
  ADD CONSTRAINT hair_profiles_primary_concern_check CHECK (
    primary_concern IS NULL OR primary_concern IN (
      'hair_loss',
      'dandruff',
      'dryness',
      'oily_scalp',
      'hair_damage',
      'split_ends',
      'breakage',
      'frizz',
      'tangling',
      'thinning'
    )
  );

COMMENT ON COLUMN public.hair_profiles.primary_concern IS
  'Her stated main problem from the quiz (legacy concern vocabulary). NULL = none stated or no legacy equivalent. Always one of concerns; a stale value is dropped by trigger.';

CREATE FUNCTION public.hair_profiles_drop_stale_primary_concern()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.primary_concern IS NOT NULL
    AND NOT (NEW.primary_concern = ANY (COALESCE(NEW.concerns, ARRAY[]::text[]))) THEN
    NEW.primary_concern := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER hair_profiles_primary_concern_contained
  BEFORE INSERT OR UPDATE OF primary_concern, concerns ON public.hair_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.hair_profiles_drop_stale_primary_concern();

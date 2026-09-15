-- Central user profile, PR1 task 3 (1/3): the mutable fact domains on
-- `hair_profiles`.
--
-- `hair_profiles` becomes the single source of truth for what we know about a
-- user: three jsonb domain documents (`diagnostics`, `care_habits`,
-- `quiz_context`), one provenance map, and one revision counter used as the
-- optimistic-concurrency token. The ~20 narrow legacy columns that exist today
-- stay, but stop being independently writable: from the follow-up writers
-- (task 5) onward they are DERIVED PROJECTIONS maintained by exactly one
-- function, `public.user_facts_save_v1` (migration
-- 20260915200200_user_facts_save_v1.sql). The `COMMENT ON COLUMN` statements
-- below are that contract, in the database, next to the column.
--
-- Additive only. DEPLOY ORDER: apply this migration FIRST, then the function
-- migration, then the code. Old code ignores the new columns (safe).

ALTER TABLE public.hair_profiles
  ADD COLUMN IF NOT EXISTS diagnostics jsonb,
  ADD COLUMN IF NOT EXISTS care_habits jsonb,
  ADD COLUMN IF NOT EXISTS quiz_context jsonb,
  ADD COLUMN IF NOT EXISTS facts_provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS facts_revision integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
     WHERE conrelid = 'public.hair_profiles'::pg_catalog.regclass
       AND conname = 'hair_profiles_diagnostics_object'
  ) THEN
    ALTER TABLE public.hair_profiles
      ADD CONSTRAINT hair_profiles_diagnostics_object
      CHECK (diagnostics IS NULL OR pg_catalog.jsonb_typeof(diagnostics) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
     WHERE conrelid = 'public.hair_profiles'::pg_catalog.regclass
       AND conname = 'hair_profiles_care_habits_object'
  ) THEN
    ALTER TABLE public.hair_profiles
      ADD CONSTRAINT hair_profiles_care_habits_object
      CHECK (care_habits IS NULL OR pg_catalog.jsonb_typeof(care_habits) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
     WHERE conrelid = 'public.hair_profiles'::pg_catalog.regclass
       AND conname = 'hair_profiles_quiz_context_object'
  ) THEN
    ALTER TABLE public.hair_profiles
      ADD CONSTRAINT hair_profiles_quiz_context_object
      CHECK (quiz_context IS NULL OR pg_catalog.jsonb_typeof(quiz_context) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
     WHERE conrelid = 'public.hair_profiles'::pg_catalog.regclass
       AND conname = 'hair_profiles_facts_provenance_object'
  ) THEN
    ALTER TABLE public.hair_profiles
      ADD CONSTRAINT hair_profiles_facts_provenance_object
      CHECK (pg_catalog.jsonb_typeof(facts_provenance) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
     WHERE conrelid = 'public.hair_profiles'::pg_catalog.regclass
       AND conname = 'hair_profiles_facts_revision_non_negative'
  ) THEN
    ALTER TABLE public.hair_profiles
      ADD CONSTRAINT hair_profiles_facts_revision_non_negative
      CHECK (facts_revision >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.hair_profiles.diagnostics IS
  'DiagnosticsV1 (src/lib/user-facts/schema.ts): the mutable source of truth for what the hair itself is like (texture, thickness, density, hair length, surface, elastic response, scalp, chemical treatments, concerns, goals) plus the verbatim `source` envelope it was projected from. Written ONLY by public.user_facts_save_v1.';

COMMENT ON COLUMN public.hair_profiles.care_habits IS
  'CareHabitsV1 (src/lib/user-facts/schema.ts): the mutable source of truth for what the user DOES — wash/product habits, towel, drying routes, heat events, night protection, brushes. Written ONLY by public.user_facts_save_v1.';

COMMENT ON COLUMN public.hair_profiles.quiz_context IS
  'QuizContextV1 (src/lib/user-facts/schema.ts): motivational/context answers (routine clarity, previous attempts, blockers, routine style, meaningful moment). Owns no derived legacy column. Written ONLY by public.user_facts_save_v1.';

COMMENT ON COLUMN public.hair_profiles.facts_provenance IS
  'domain (''diagnostics''|''care_habits''|''quiz_context'') -> DomainProvenance {source:{kind,id?}, schemaVersion, at, editedAt?, fields?, preservedCandidates?}. `fields` accumulates per-field provenance across writes; `preservedCandidates` records artifact/lead sources that a create_only account link did NOT apply. Written ONLY by public.user_facts_save_v1.';

COMMENT ON COLUMN public.hair_profiles.facts_revision IS
  'Optimistic-concurrency token over the three fact domains. Bumped on EVERY non-preserved write (it counts writes, not diffs) and used as the CAS value by public.user_facts_save_v1 (p_expected_revision). A missing hair_profiles row counts as revision 0.';

-- The 20 derived projections. One sentence, identical shape for each: who owns
-- the write, which domain it is derived from, and when it may be dropped.
COMMENT ON COLUMN public.hair_profiles.hair_texture IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.thickness IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.density IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.hair_length IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.cuticle_condition IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.protein_moisture_balance IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.scalp_type IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.scalp_condition IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.chemical_treatment IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1). Absent fact projects as ''{}'' for legacy readers; the facts domain keeps the distinction.';
COMMENT ON COLUMN public.hair_profiles.concerns IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1). Absent fact projects as ''{}'' for legacy readers; the facts domain keeps the distinction.';
COMMENT ON COLUMN public.hair_profiles.goals IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1). Absent fact projects as ''{}'' for legacy readers; the facts domain keeps the distinction.';
COMMENT ON COLUMN public.hair_profiles.desired_volume IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.diagnostics; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.drying_method IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.care_habits; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.heat_styling IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.care_habits; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.styling_tools IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.care_habits; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.uses_heat_protection IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.care_habits; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.towel_material IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.care_habits; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.towel_technique IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.care_habits; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.night_protection IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.care_habits; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';
COMMENT ON COLUMN public.hair_profiles.brush_type IS
  'Derived projection owned by public.user_facts_save_v1 from hair_profiles.care_habits; retire when the legacy recommendation engine and chat context read the facts domains directly (follow-up program F1)';

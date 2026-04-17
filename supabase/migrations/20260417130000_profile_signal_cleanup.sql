-- Clean up deprecated profile mirrors and switch optional arrays to native null semantics.

DROP INDEX IF EXISTS idx_hair_profiles_post_wash_actions;

ALTER TABLE hair_profiles
  DROP CONSTRAINT IF EXISTS hair_profiles_post_wash_actions_valid,
  DROP CONSTRAINT IF EXISTS hair_profiles_mechanical_stress_factors_valid;

ALTER TABLE hair_profiles
  ALTER COLUMN drying_method DROP NOT NULL,
  ALTER COLUMN drying_method DROP DEFAULT,
  ALTER COLUMN styling_tools DROP DEFAULT,
  ALTER COLUMN night_protection DROP NOT NULL,
  ALTER COLUMN night_protection DROP DEFAULT;

ALTER TABLE hair_profiles
  ALTER COLUMN drying_method TYPE text
  USING CASE
    WHEN drying_method IS NULL OR array_length(drying_method, 1) IS NULL THEN NULL
    ELSE drying_method[1]
  END;

ALTER TABLE hair_profiles
  ADD CONSTRAINT hair_profiles_drying_method_valid
  CHECK (
    drying_method IS NULL
    OR drying_method IN ('air_dry', 'blow_dry', 'blow_dry_diffuser')
  );

ALTER TABLE hair_profiles
  DROP COLUMN IF EXISTS post_wash_actions,
  DROP COLUMN IF EXISTS mechanical_stress_factors,
  DROP COLUMN IF EXISTS answered_fields,
  DROP COLUMN IF EXISTS current_routine_products;

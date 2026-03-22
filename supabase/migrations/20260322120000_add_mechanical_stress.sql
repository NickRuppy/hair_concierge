-- Add mechanical stress factors to hair profiles
-- Stores user-selected mechanical stressors as a text array
-- (matches the chemical_treatment / post_wash_actions pattern)

ALTER TABLE hair_profiles
  ADD COLUMN IF NOT EXISTS mechanical_stress_factors text[] NOT NULL DEFAULT '{}';

ALTER TABLE hair_profiles
  ADD CONSTRAINT hair_profiles_mechanical_stress_factors_valid
  CHECK (
    mechanical_stress_factors <@ ARRAY[
      'tight_hairstyles',
      'rough_brushing',
      'towel_rubbing'
    ]::text[]
  );

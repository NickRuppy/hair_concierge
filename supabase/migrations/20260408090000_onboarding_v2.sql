-- Migration: onboarding_v2
-- Changes:
--   1. Change onboarding_step from integer to text on profiles
--   2. Add has_seen_completion_popup boolean to profiles
--   3. Add care-habit columns to hair_profiles
--   4. Create user_product_usage table with RLS

-- 1. Ensure onboarding_step is text type with 'welcome' default.
--    Legacy onboarding used a 4-step integer wizard:
--      1 = hair profile intro
--      2 = concerns
--      3 = routine
--      4 = goals / completion
--    Map those coarse progress markers into the current string-based flow.
DO $$
DECLARE
  onboarding_step_type text;
BEGIN
  SELECT data_type
  INTO onboarding_step_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'onboarding_step';

  IF onboarding_step_type IS NULL THEN
    ALTER TABLE profiles ADD COLUMN onboarding_step text DEFAULT 'welcome';
  ELSIF onboarding_step_type IN ('smallint', 'integer', 'bigint') THEN
    ALTER TABLE profiles
      ALTER COLUMN onboarding_step TYPE text USING COALESCE(
        'welcome',
        'welcome'
      ),
      ALTER COLUMN onboarding_step SET DEFAULT 'welcome';
  ELSE
    UPDATE profiles
      SET onboarding_step = COALESCE(
        CASE onboarding_step
          WHEN '1' THEN 'welcome'
          WHEN '2' THEN 'welcome'
          WHEN '3' THEN 'welcome'
          WHEN '4' THEN 'welcome'
          WHEN 'complete' THEN 'welcome'
          ELSE onboarding_step
        END,
        'welcome'
      )
    WHERE onboarding_step IS NULL OR onboarding_step IN ('1', '2', '3', '4', 'complete');

    ALTER TABLE profiles ALTER COLUMN onboarding_step SET DEFAULT 'welcome';
  END IF;
END $$;

-- 2. Add has_seen_completion_popup to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_seen_completion_popup boolean NOT NULL DEFAULT false;

-- 3. Ensure answered_fields exists (may be missing if prior migration wasn't applied)
ALTER TABLE hair_profiles ADD COLUMN IF NOT EXISTS answered_fields text[] NOT NULL DEFAULT '{}';

-- 4. Add care-habit columns to hair_profiles
ALTER TABLE hair_profiles
  ADD COLUMN IF NOT EXISTS towel_material text CHECK (towel_material IN ('frottee','mikrofaser','tshirt','turban_mikrofaser')),
  ADD COLUMN IF NOT EXISTS towel_technique text CHECK (towel_technique IN ('rubbeln','tupfen')),
  ADD COLUMN IF NOT EXISTS drying_method text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS brush_type text CHECK (brush_type IN ('wide_tooth_comb','detangling','paddle','round','boar_bristle','fingers','none_regular')),
  ADD COLUMN IF NOT EXISTS night_protection text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS uses_heat_protection boolean NOT NULL DEFAULT false;

-- 4. Create user_product_usage table
CREATE TABLE IF NOT EXISTS user_product_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN (
    'shampoo','conditioner','leave_in','oil','mask',
    'heat_protectant','serum','scrub','peeling','dry_shampoo',
    'styling_gel','styling_mousse','styling_cream','hairspray'
  )),
  product_name text,
  frequency_range text CHECK (frequency_range IN ('rarely','1_2x','3_4x','5_6x','daily')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

-- 5. RLS for user_product_usage
ALTER TABLE user_product_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own product usage"
  ON user_product_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own product usage"
  ON user_product_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own product usage"
  ON user_product_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own product usage"
  ON user_product_usage FOR DELETE
  USING (auth.uid() = user_id);

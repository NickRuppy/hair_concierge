-- Normalize legacy onboarding_step remnants after restoring the historical onboarding_v2 migration.
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
    ALTER TABLE public.profiles
      ADD COLUMN onboarding_step text DEFAULT 'welcome';
  ELSIF onboarding_step_type IN ('smallint', 'integer', 'bigint') THEN
    ALTER TABLE public.profiles
      ALTER COLUMN onboarding_step TYPE text USING 'welcome';
  END IF;

  UPDATE public.profiles
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

  ALTER TABLE public.profiles
    ALTER COLUMN onboarding_step SET DEFAULT 'welcome';
END $$;

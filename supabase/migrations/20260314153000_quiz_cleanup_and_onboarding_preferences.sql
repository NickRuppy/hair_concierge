DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hair_profiles'
      AND column_name = 'desired_volume'
  ) THEN
    ALTER TABLE public.hair_profiles
      ADD COLUMN desired_volume text;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.hair_profiles
    DROP CONSTRAINT IF EXISTS hair_profiles_desired_volume_check;

  ALTER TABLE public.hair_profiles
    ADD CONSTRAINT hair_profiles_desired_volume_check
    CHECK (
      desired_volume IS NULL
      OR desired_volume IN ('less', 'balanced', 'more')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN status text NOT NULL DEFAULT 'captured';
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.leads
    ALTER COLUMN status SET DEFAULT 'captured';

  ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS leads_status_check;

  ALTER TABLE public.leads
    ADD CONSTRAINT leads_status_check
    CHECK (status IN ('captured', 'analyzed', 'linked'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

UPDATE public.leads
SET status = CASE
  WHEN user_id IS NOT NULL THEN 'linked'
  WHEN ai_insight IS NOT NULL OR share_quote IS NOT NULL THEN 'analyzed'
  ELSE 'captured'
END;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  constraint_record record;
BEGIN
  FOR constraint_record IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.hair_profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%brush_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.hair_profiles DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
  END LOOP;
END $$;

ALTER TABLE public.hair_profiles
  ALTER COLUMN brush_type DROP DEFAULT,
  ALTER COLUMN brush_type TYPE text[]
  USING CASE
    WHEN brush_type IS NULL THEN NULL
    WHEN brush_type = 'none_regular' THEN ARRAY[]::text[]
    ELSE ARRAY[brush_type]::text[]
  END;

ALTER TABLE public.hair_profiles
  ADD CONSTRAINT hair_profiles_brush_type_check
  CHECK (
    brush_type IS NULL
    OR brush_type <@ ARRAY[
      'wide_tooth_comb',
      'detangling',
      'paddle',
      'round',
      'boar_bristle',
      'fingers'
    ]::text[]
  );

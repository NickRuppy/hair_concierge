DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'hair_profiles'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) LIKE '%towel_technique%'
  LOOP
    EXECUTE format('ALTER TABLE public.hair_profiles DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

UPDATE hair_profiles
SET towel_technique = CASE towel_technique
  WHEN 'rubbeln' THEN 'rough_rubbing'
  WHEN 'tupfen' THEN 'gentle_press'
  ELSE towel_technique
END
WHERE towel_technique IN ('rubbeln', 'tupfen');

ALTER TABLE hair_profiles
  ADD CONSTRAINT hair_profiles_towel_technique_check
  CHECK (towel_technique IN ('rough_rubbing', 'gentle_press'));

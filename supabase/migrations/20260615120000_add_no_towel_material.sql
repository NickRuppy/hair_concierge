DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  JOIN pg_attribute attr ON attr.attrelid = rel.oid
    AND attr.attname = 'towel_material'
    AND attr.attnum = ANY (con.conkey)
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'hair_profiles'
    AND con.contype = 'c'
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.hair_profiles DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.hair_profiles
  ADD CONSTRAINT hair_profiles_towel_material_check
  CHECK (
    towel_material IS NULL
    OR towel_material IN ('frottee','mikrofaser','tshirt','turban_mikrofaser','no_towel')
  );

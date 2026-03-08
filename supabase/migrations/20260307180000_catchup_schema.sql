-- Catchup migration: sync local migration files with production schema.
-- All changes here already exist in prod; this is idempotent.

-- Drop legacy hair_type column (replaced by hair_texture in prod)
ALTER TABLE hair_profiles DROP COLUMN IF EXISTS hair_type;

-- Ensure hair_texture CHECK constraint matches prod
DO $$
BEGIN
  ALTER TABLE hair_profiles DROP CONSTRAINT IF EXISTS hair_profiles_hair_texture_check;
  ALTER TABLE hair_profiles ADD CONSTRAINT hair_profiles_hair_texture_check
    CHECK (hair_texture IS NULL OR hair_texture IN ('straight', 'wavy', 'curly', 'coily'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- Ensure thickness column exists with CHECK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hair_profiles' AND column_name = 'thickness'
  ) THEN
    ALTER TABLE hair_profiles ADD COLUMN thickness text
      CHECK (thickness IS NULL OR thickness IN ('fine', 'normal', 'coarse'));
  END IF;
END $$;

-- Ensure 6 diagnostic columns exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hair_profiles' AND column_name = 'cuticle_condition'
  ) THEN
    ALTER TABLE hair_profiles ADD COLUMN cuticle_condition text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hair_profiles' AND column_name = 'protein_moisture_balance'
  ) THEN
    ALTER TABLE hair_profiles ADD COLUMN protein_moisture_balance text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hair_profiles' AND column_name = 'scalp_type'
  ) THEN
    ALTER TABLE hair_profiles ADD COLUMN scalp_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hair_profiles' AND column_name = 'scalp_condition'
  ) THEN
    ALTER TABLE hair_profiles ADD COLUMN scalp_condition text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hair_profiles' AND column_name = 'chemical_treatment'
  ) THEN
    ALTER TABLE hair_profiles ADD COLUMN chemical_treatment text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hair_profiles' AND column_name = 'styling_tools'
  ) THEN
    ALTER TABLE hair_profiles ADD COLUMN styling_tools text[] DEFAULT '{}';
  END IF;
END $$;

-- Rename products.suitable_hair_types → suitable_hair_textures if old name exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'suitable_hair_types'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'suitable_hair_textures'
  ) THEN
    ALTER TABLE products RENAME COLUMN suitable_hair_types TO suitable_hair_textures;
  END IF;
END $$;

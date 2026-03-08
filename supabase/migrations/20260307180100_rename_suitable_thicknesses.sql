-- Rename products.suitable_hair_textures → suitable_thicknesses
-- (The column actually stores thickness values: fine/normal/coarse)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'suitable_hair_textures'
  ) THEN
    ALTER TABLE products RENAME COLUMN suitable_hair_textures TO suitable_thicknesses;
  END IF;
END $$;

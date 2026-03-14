-- Mask recommendation phase 1 schema:
-- Add typed mask specs table for deterministic reranking

CREATE TABLE IF NOT EXISTS product_mask_specs (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  format text NOT NULL
    CHECK (format IN ('gel', 'lotion', 'cream', 'butter')),
  weight text NOT NULL
    CHECK (weight IN ('light', 'medium', 'rich')),
  concentration text NOT NULL
    CHECK (concentration IN ('low', 'medium', 'high')),
  benefits text[] NOT NULL DEFAULT '{}'
    CHECK (
      benefits <@ ARRAY[
        'moisture',
        'protein',
        'repair',
        'anti_frizz',
        'shine',
        'detangling',
        'elasticity',
        'color_protect'
      ]::text[]
    ),
  ingredient_flags text[] NOT NULL DEFAULT '{}'
    CHECK (
      ingredient_flags <@ ARRAY[
        'oils',
        'butters',
        'proteins',
        'humectants',
        'silicones',
        'acids'
      ]::text[]
    ),
  apply_on_scalp_allowed boolean NOT NULL DEFAULT false,
  leave_on_minutes integer NOT NULL DEFAULT 10
    CHECK (leave_on_minutes >= 1 AND leave_on_minutes <= 60),
  max_uses_per_week integer NOT NULL DEFAULT 1
    CHECK (max_uses_per_week >= 1 AND max_uses_per_week <= 3),
  dose_fine_ml integer
    CHECK (dose_fine_ml IS NULL OR dose_fine_ml > 0),
  dose_normal_ml integer
    CHECK (dose_normal_ml IS NULL OR dose_normal_ml > 0),
  dose_coarse_ml integer
    CHECK (dose_coarse_ml IS NULL OR dose_coarse_ml > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_mask_specs_benefits
  ON product_mask_specs USING gin (benefits);

CREATE INDEX IF NOT EXISTS idx_product_mask_specs_ingredient_flags
  ON product_mask_specs USING gin (ingredient_flags);

CREATE INDEX IF NOT EXISTS idx_product_mask_specs_weight
  ON product_mask_specs (weight);

CREATE INDEX IF NOT EXISTS idx_product_mask_specs_concentration
  ON product_mask_specs (concentration);

CREATE INDEX IF NOT EXISTS idx_product_mask_specs_scalp_allowed
  ON product_mask_specs (product_id)
  WHERE apply_on_scalp_allowed = true;

DROP TRIGGER IF EXISTS set_updated_at_product_mask_specs ON product_mask_specs;
CREATE TRIGGER set_updated_at_product_mask_specs
  BEFORE UPDATE ON product_mask_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE product_mask_specs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_mask_specs'
      AND policyname = 'product_mask_specs_admin_select'
  ) THEN
    CREATE POLICY product_mask_specs_admin_select
      ON product_mask_specs FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_mask_specs'
      AND policyname = 'product_mask_specs_admin_insert'
  ) THEN
    CREATE POLICY product_mask_specs_admin_insert
      ON product_mask_specs FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_mask_specs'
      AND policyname = 'product_mask_specs_admin_update'
  ) THEN
    CREATE POLICY product_mask_specs_admin_update
      ON product_mask_specs FOR UPDATE
      USING (
        EXISTS (
          SELECT 1
          FROM profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_mask_specs'
      AND policyname = 'product_mask_specs_admin_delete'
  ) THEN
    CREATE POLICY product_mask_specs_admin_delete
      ON product_mask_specs FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;
END $$;

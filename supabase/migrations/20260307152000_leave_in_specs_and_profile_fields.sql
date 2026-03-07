-- Leave-in recommendation phase 1 schema:
-- 1) Extend hair_profiles with routine/styling context
-- 2) Add typed leave-in spec table for deterministic reranking

-- ── 1) hair_profiles extensions ──────────────────────────────────────────────

ALTER TABLE hair_profiles
  ADD COLUMN IF NOT EXISTS post_wash_actions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS routine_preference text,
  ADD COLUMN IF NOT EXISTS current_routine_products text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hair_profiles_post_wash_actions_valid'
  ) THEN
    ALTER TABLE hair_profiles
      ADD CONSTRAINT hair_profiles_post_wash_actions_valid
      CHECK (
        post_wash_actions <@ ARRAY[
          'air_dry',
          'blow_dry_only',
          'heat_tool_styling',
          'non_heat_styling'
        ]::text[]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hair_profiles_routine_preference_valid'
  ) THEN
    ALTER TABLE hair_profiles
      ADD CONSTRAINT hair_profiles_routine_preference_valid
      CHECK (
        routine_preference IS NULL
        OR routine_preference IN ('minimal', 'balanced', 'advanced')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'hair_profiles_current_routine_products_valid'
  ) THEN
    ALTER TABLE hair_profiles
      ADD CONSTRAINT hair_profiles_current_routine_products_valid
      CHECK (
        current_routine_products <@ ARRAY[
          'shampoo',
          'conditioner',
          'leave_in',
          'oil',
          'mask',
          'heat_protectant',
          'serum',
          'scrub'
        ]::text[]
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_hair_profiles_post_wash_actions
  ON hair_profiles USING gin (post_wash_actions);

CREATE INDEX IF NOT EXISTS idx_hair_profiles_current_routine_products
  ON hair_profiles USING gin (current_routine_products);

-- ── 2) leave-in specs table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_leave_in_specs (
  product_id uuid PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  format text NOT NULL
    CHECK (format IN ('spray', 'milk', 'lotion', 'cream', 'serum')),
  weight text NOT NULL
    CHECK (weight IN ('light', 'medium', 'rich')),
  roles text[] NOT NULL DEFAULT '{}'
    CHECK (
      roles <@ ARRAY[
        'replacement_conditioner',
        'extension_conditioner',
        'styling_prep',
        'oil_replacement'
      ]::text[]
    ),
  provides_heat_protection boolean NOT NULL DEFAULT false,
  heat_protection_max_c integer,
  heat_activation_required boolean NOT NULL DEFAULT false,
  care_benefits text[] NOT NULL DEFAULT '{}'
    CHECK (
      care_benefits <@ ARRAY[
        'moisture',
        'protein',
        'repair',
        'detangling',
        'anti_frizz',
        'shine',
        'curl_definition',
        'volume'
      ]::text[]
    ),
  ingredient_flags text[] NOT NULL DEFAULT '{}'
    CHECK (
      ingredient_flags <@ ARRAY[
        'silicones',
        'polymers',
        'oils',
        'proteins',
        'humectants'
      ]::text[]
    ),
  application_stage text[] NOT NULL DEFAULT '{towel_dry}'
    CHECK (
      application_stage <@ ARRAY[
        'towel_dry',
        'dry_hair',
        'pre_heat',
        'post_style'
      ]::text[]
    ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_leave_in_specs_heat_protection_temp_requires_flag
    CHECK (
      heat_protection_max_c IS NULL
      OR provides_heat_protection = true
    ),
  CONSTRAINT product_leave_in_specs_heat_activation_requires_styling_role
    CHECK (
      heat_activation_required = false
      OR roles @> ARRAY['styling_prep']::text[]
    )
);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_specs_roles
  ON product_leave_in_specs USING gin (roles);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_specs_care_benefits
  ON product_leave_in_specs USING gin (care_benefits);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_specs_application_stage
  ON product_leave_in_specs USING gin (application_stage);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_specs_weight
  ON product_leave_in_specs (weight);

CREATE INDEX IF NOT EXISTS idx_product_leave_in_specs_heat_activation_required
  ON product_leave_in_specs (product_id)
  WHERE heat_activation_required = true;

DROP TRIGGER IF EXISTS set_updated_at_product_leave_in_specs ON product_leave_in_specs;
CREATE TRIGGER set_updated_at_product_leave_in_specs
  BEFORE UPDATE ON product_leave_in_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE product_leave_in_specs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_leave_in_specs'
      AND policyname = 'product_leave_in_specs_admin_select'
  ) THEN
    CREATE POLICY product_leave_in_specs_admin_select
      ON product_leave_in_specs FOR SELECT
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
      AND tablename = 'product_leave_in_specs'
      AND policyname = 'product_leave_in_specs_admin_insert'
  ) THEN
    CREATE POLICY product_leave_in_specs_admin_insert
      ON product_leave_in_specs FOR INSERT
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
      AND tablename = 'product_leave_in_specs'
      AND policyname = 'product_leave_in_specs_admin_update'
  ) THEN
    CREATE POLICY product_leave_in_specs_admin_update
      ON product_leave_in_specs FOR UPDATE
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
      AND tablename = 'product_leave_in_specs'
      AND policyname = 'product_leave_in_specs_admin_delete'
  ) THEN
    CREATE POLICY product_leave_in_specs_admin_delete
      ON product_leave_in_specs FOR DELETE
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

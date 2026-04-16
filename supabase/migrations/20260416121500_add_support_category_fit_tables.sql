CREATE TABLE IF NOT EXISTS public.product_bondbuilder_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  bond_repair_intensity text NOT NULL CHECK (
    bond_repair_intensity IN ('maintenance', 'intensive')
  ),
  application_mode text NOT NULL CHECK (
    application_mode IN ('pre_shampoo', 'post_wash_leave_in')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_bondbuilder_specs_intensity
  ON public.product_bondbuilder_specs (bond_repair_intensity);

CREATE INDEX IF NOT EXISTS idx_product_bondbuilder_specs_application_mode
  ON public.product_bondbuilder_specs (application_mode);

DROP TRIGGER IF EXISTS set_updated_at_product_bondbuilder_specs ON public.product_bondbuilder_specs;
CREATE TRIGGER set_updated_at_product_bondbuilder_specs
  BEFORE UPDATE ON public.product_bondbuilder_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_bondbuilder_specs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_deep_cleansing_shampoo_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  scalp_type_focus text NOT NULL CHECK (
    scalp_type_focus IN ('oily', 'balanced', 'dry')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_deep_cleansing_shampoo_specs_scalp_type_focus
  ON public.product_deep_cleansing_shampoo_specs (scalp_type_focus);

DROP TRIGGER IF EXISTS set_updated_at_product_deep_cleansing_shampoo_specs ON public.product_deep_cleansing_shampoo_specs;
CREATE TRIGGER set_updated_at_product_deep_cleansing_shampoo_specs
  BEFORE UPDATE ON public.product_deep_cleansing_shampoo_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_deep_cleansing_shampoo_specs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_dry_shampoo_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  scalp_type_focus text NOT NULL CHECK (
    scalp_type_focus IN ('oily', 'balanced')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_dry_shampoo_specs_scalp_type_focus
  ON public.product_dry_shampoo_specs (scalp_type_focus);

DROP TRIGGER IF EXISTS set_updated_at_product_dry_shampoo_specs ON public.product_dry_shampoo_specs;
CREATE TRIGGER set_updated_at_product_dry_shampoo_specs
  BEFORE UPDATE ON public.product_dry_shampoo_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_dry_shampoo_specs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.product_peeling_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  scalp_type_focus text NOT NULL CHECK (
    scalp_type_focus IN ('oily', 'balanced', 'dry')
  ),
  peeling_type text NOT NULL CHECK (
    peeling_type IN ('acid_serum', 'physical_scrub')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_peeling_specs_scalp_type_focus
  ON public.product_peeling_specs (scalp_type_focus);

CREATE INDEX IF NOT EXISTS idx_product_peeling_specs_peeling_type
  ON public.product_peeling_specs (peeling_type);

DROP TRIGGER IF EXISTS set_updated_at_product_peeling_specs ON public.product_peeling_specs;
CREATE TRIGGER set_updated_at_product_peeling_specs
  BEFORE UPDATE ON public.product_peeling_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_peeling_specs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  table_name text;
  policy_prefix text;
BEGIN
  FOR table_name, policy_prefix IN
    SELECT * FROM (
      VALUES
        ('product_bondbuilder_specs', 'product_bondbuilder_specs'),
        ('product_deep_cleansing_shampoo_specs', 'product_deep_cleansing_shampoo_specs'),
        ('product_dry_shampoo_specs', 'product_dry_shampoo_specs'),
        ('product_peeling_specs', 'product_peeling_specs')
    ) AS t(table_name, policy_prefix)
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = policy_prefix || '_admin_select'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT USING (
          EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
              AND is_admin = true
          )
        )',
        policy_prefix || '_admin_select',
        table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = policy_prefix || '_admin_insert'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
              AND is_admin = true
          )
        )',
        policy_prefix || '_admin_insert',
        table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = policy_prefix || '_admin_update'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE
          USING (
            EXISTS (
              SELECT 1
              FROM public.profiles
              WHERE id = auth.uid()
                AND is_admin = true
            )
          )
          WITH CHECK (
            EXISTS (
              SELECT 1
              FROM public.profiles
              WHERE id = auth.uid()
                AND is_admin = true
            )
          )',
        policy_prefix || '_admin_update',
        table_name
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = policy_prefix || '_admin_delete'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE USING (
          EXISTS (
            SELECT 1
            FROM public.profiles
            WHERE id = auth.uid()
              AND is_admin = true
          )
        )',
        policy_prefix || '_admin_delete',
        table_name
      );
    END IF;
  END LOOP;
END $$;

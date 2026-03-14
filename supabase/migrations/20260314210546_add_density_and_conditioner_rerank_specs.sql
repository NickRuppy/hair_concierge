DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'hair_profiles'
      AND column_name = 'density'
  ) THEN
    ALTER TABLE public.hair_profiles
      ADD COLUMN density text;
  END IF;
END $$;

DO $$
BEGIN
  ALTER TABLE public.hair_profiles
    DROP CONSTRAINT IF EXISTS hair_profiles_density_check;

  ALTER TABLE public.hair_profiles
    ADD CONSTRAINT hair_profiles_density_check
    CHECK (
      density IS NULL
      OR density IN ('low', 'medium', 'high')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.product_conditioner_rerank_specs (
  product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  weight text NOT NULL
    CHECK (weight IN ('light', 'medium', 'rich')),
  repair_level text NOT NULL
    CHECK (repair_level IN ('low', 'medium', 'high')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_conditioner_rerank_specs_weight
  ON public.product_conditioner_rerank_specs (weight);

CREATE INDEX IF NOT EXISTS idx_product_conditioner_rerank_specs_repair_level
  ON public.product_conditioner_rerank_specs (repair_level);

DROP TRIGGER IF EXISTS set_updated_at_product_conditioner_rerank_specs ON public.product_conditioner_rerank_specs;
CREATE TRIGGER set_updated_at_product_conditioner_rerank_specs
  BEFORE UPDATE ON public.product_conditioner_rerank_specs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.product_conditioner_rerank_specs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_conditioner_rerank_specs'
      AND policyname = 'product_conditioner_rerank_specs_admin_select'
  ) THEN
    CREATE POLICY product_conditioner_rerank_specs_admin_select
      ON public.product_conditioner_rerank_specs FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_conditioner_rerank_specs'
      AND policyname = 'product_conditioner_rerank_specs_admin_insert'
  ) THEN
    CREATE POLICY product_conditioner_rerank_specs_admin_insert
      ON public.product_conditioner_rerank_specs FOR INSERT
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_conditioner_rerank_specs'
      AND policyname = 'product_conditioner_rerank_specs_admin_update'
  ) THEN
    CREATE POLICY product_conditioner_rerank_specs_admin_update
      ON public.product_conditioner_rerank_specs FOR UPDATE
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
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_conditioner_rerank_specs'
      AND policyname = 'product_conditioner_rerank_specs_admin_delete'
  ) THEN
    CREATE POLICY product_conditioner_rerank_specs_admin_delete
      ON public.product_conditioner_rerank_specs FOR DELETE
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;
END $$;

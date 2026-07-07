ALTER TABLE public.product_conditioner_specs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_conditioner_specs'
      AND policyname = 'product_conditioner_specs_admin_select'
  ) THEN
    CREATE POLICY product_conditioner_specs_admin_select
      ON public.product_conditioner_specs FOR SELECT
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
      AND tablename = 'product_conditioner_specs'
      AND policyname = 'product_conditioner_specs_admin_insert'
  ) THEN
    CREATE POLICY product_conditioner_specs_admin_insert
      ON public.product_conditioner_specs FOR INSERT
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
      AND tablename = 'product_conditioner_specs'
      AND policyname = 'product_conditioner_specs_admin_update'
  ) THEN
    CREATE POLICY product_conditioner_specs_admin_update
      ON public.product_conditioner_specs FOR UPDATE
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
      AND tablename = 'product_conditioner_specs'
      AND policyname = 'product_conditioner_specs_admin_delete'
  ) THEN
    CREATE POLICY product_conditioner_specs_admin_delete
      ON public.product_conditioner_specs FOR DELETE
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

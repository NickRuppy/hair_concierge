DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_leave_in_fit_specs'
      AND policyname = 'product_leave_in_fit_specs_admin_select'
  ) THEN
    CREATE POLICY product_leave_in_fit_specs_admin_select
      ON public.product_leave_in_fit_specs FOR SELECT
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
      AND tablename = 'product_leave_in_fit_specs'
      AND policyname = 'product_leave_in_fit_specs_admin_insert'
  ) THEN
    CREATE POLICY product_leave_in_fit_specs_admin_insert
      ON public.product_leave_in_fit_specs FOR INSERT
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
      AND tablename = 'product_leave_in_fit_specs'
      AND policyname = 'product_leave_in_fit_specs_admin_update'
  ) THEN
    CREATE POLICY product_leave_in_fit_specs_admin_update
      ON public.product_leave_in_fit_specs FOR UPDATE
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
      AND tablename = 'product_leave_in_fit_specs'
      AND policyname = 'product_leave_in_fit_specs_admin_delete'
  ) THEN
    CREATE POLICY product_leave_in_fit_specs_admin_delete
      ON public.product_leave_in_fit_specs FOR DELETE
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

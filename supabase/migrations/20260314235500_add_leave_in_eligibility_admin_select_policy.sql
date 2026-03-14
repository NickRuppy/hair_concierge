-- Allow admins to inspect the derived leave-in eligibility table while
-- keeping all writes trigger-managed.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_leave_in_eligibility'
      AND policyname = 'product_leave_in_eligibility_admin_select'
  ) THEN
    CREATE POLICY product_leave_in_eligibility_admin_select
      ON public.product_leave_in_eligibility
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles
          WHERE id = auth.uid()
            AND is_admin = true
        )
      );
  END IF;
END;
$$;

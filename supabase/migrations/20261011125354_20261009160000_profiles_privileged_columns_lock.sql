-- Lock the privileged columns of public.profiles against browser roles.
-- Applied to production 2026-10-11 via Supabase MCP; recorded there as version 20261011125354
-- (name 20261009160000_profiles_privileged_columns_lock), hence the double-prefixed file name.
--
-- WHY. The only UPDATE policy on public.profiles, `profiles_update_own`
-- (USING / WITH CHECK auth.uid() = id), restricts rows, not columns, and `anon` / `authenticated`
-- hold table-level UPDATE (Supabase default grants). So any signed-in user could, with one
-- PostgREST request on their own row, set `is_admin = true` (admin escalation),
-- `subscription_status = 'active'` / `current_period_end = null` (paywall bypass: the paywall
-- falls back to these columns, src/lib/billing/subscriptions.ts), or change `email`.
--
-- LIVE STATE this migration was written against (read-only query, 2026-10-09):
--   * RLS enabled. Policies: `profiles_select` (SELECT, auth.uid() = id OR is_admin()) and
--     `profiles_update_own` (UPDATE, all columns). No INSERT / DELETE policies. The policy names
--     differ from 00001_initial_schema.sql (see scripts/mobile/legacy-local-rls.sql), so this
--     migration touches NO policy and depends on no policy name.
--   * anon and authenticated hold SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES.
--   * One trigger: set_updated_at_profiles (BEFORE UPDATE; trigger-assigned columns are not
--     subject to column privileges, so it keeps working for column-limited updates).
--
-- WHAT. Grants only — no policies, no triggers, no data:
--   * anon, authenticated lose INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES on the table
--     (revoking table-level UPDATE also drops any column-level UPDATE grants).
--     INSERT / DELETE had no policy, so losing them changes nothing observable; no client code
--     inserts or deletes profiles (new rows come from the SECURITY DEFINER handle_new_user
--     trigger; deletion cascades from auth.users).
--   * authenticated regains UPDATE on exactly the columns the browser writes
--     (src/components/onboarding/onboarding-flow.tsx: onboarding_step, onboarding_completed,
--     has_seen_completion_popup). Row scoping stays with `profiles_update_own`.
--   * SELECT is unchanged; `profiles_select` keeps scoping it.
--   * service_role is unaffected (it keeps its own grants and bypasses RLS): every server-side
--     writer of a locked column (billing mirrors, Stripe/PayPal activation and webhooks, chat
--     message counter, local dev login) uses the service-role client.
--
-- COLUMN CLASSIFICATION — every column of profiles. The DO block below REFUSES TO APPLY (before
-- any grant changes) if the table has a column listed in neither group, or lacks a listed one, so a
-- future column has to be classified here deliberately.
--   client_writable (3): onboarding_step, onboarding_completed, has_seen_completion_popup
--   locked (16):         id, email, full_name, avatar_url, locale, is_admin,
--                        message_count_this_month, message_count_reset_at,
--                        stripe_customer_id, stripe_subscription_id, subscription_status,
--                        subscription_interval, subscription_tier_id, current_period_end,
--                        created_at, updated_at
--   full_name, avatar_url and locale have no browser writer today; they are locked and can be
--   widened deliberately (GRANT UPDATE (<column>) ON public.profiles TO authenticated) if a
--   self-service profile editor ever needs them.
--
-- Pinned by tests/profiles-privileged-columns-postgres.test.ts.
--
-- ROLLBACK (restores the prior, vulnerable state):
--   GRANT INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.profiles TO anon, authenticated;
--   (`GRANT UPDATE ON public.profiles TO anon, authenticated;` alone restores the update path.)

DO $$
DECLARE
  c_client_writable CONSTANT text[] := ARRAY[
    'onboarding_step', 'onboarding_completed', 'has_seen_completion_popup'];
  c_locked CONSTANT text[] := ARRAY[
    'id', 'email', 'full_name', 'avatar_url', 'locale', 'is_admin',
    'message_count_this_month', 'message_count_reset_at',
    'stripe_customer_id', 'stripe_subscription_id', 'subscription_status',
    'subscription_interval', 'subscription_tier_id', 'current_period_end',
    'created_at', 'updated_at'];
  v_columns text[];
  v_missing text[];
BEGIN
  SELECT pg_catalog.array_agg(a.attname::text ORDER BY a.attname) INTO v_columns
    FROM pg_catalog.pg_attribute AS a
   WHERE a.attrelid = 'public.profiles'::pg_catalog.regclass
     AND a.attnum > 0 AND NOT a.attisdropped;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.unnest(v_columns) AS c(name)
     WHERE NOT (c.name = ANY (c_client_writable) OR c.name = ANY (c_locked))
  ) THEN
    RAISE EXCEPTION 'profiles_unclassified_column'
      USING DETAIL = (
        SELECT pg_catalog.array_to_string(pg_catalog.array_agg(c.name ORDER BY c.name), ', ')
          FROM pg_catalog.unnest(v_columns) AS c(name)
         WHERE NOT (c.name = ANY (c_client_writable) OR c.name = ANY (c_locked)));
  END IF;

  SELECT pg_catalog.array_agg(c.name ORDER BY c.name) INTO v_missing
    FROM pg_catalog.unnest(c_client_writable || c_locked) AS c(name)
   WHERE NOT (c.name = ANY (v_columns));
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'profiles_classified_column_missing'
      USING DETAIL = pg_catalog.array_to_string(v_missing, ', ');
  END IF;
END $$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.profiles FROM anon, authenticated;

GRANT UPDATE (onboarding_step, onboarding_completed, has_seen_completion_popup)
  ON public.profiles TO authenticated;

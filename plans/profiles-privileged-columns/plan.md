# profiles privileged-columns lock

Status: prepared, NOT applied. Uncommitted on `codex/profiles-privileged-columns` (base main 320940f4).

## Problem

`public.profiles` has one UPDATE policy, `profiles_update_own` (`USING / WITH CHECK auth.uid() = id`).
It scopes rows but not columns, and `anon` / `authenticated` hold table-level UPDATE (Supabase
defaults). So any signed-in user can, with one PostgREST request on their own row, set
`is_admin = true`, `subscription_status = 'active'`, `current_period_end = null` (the paywall falls
back to these, `src/lib/billing/subscriptions.ts:275-287, 452-466`), or change `email`.

## The fix

`supabase/migrations/20261011125354_20261009160000_profiles_privileged_columns_lock.sql`. Grants only: it touches
no policy, no trigger and no data.

1. An apply-time `DO` block runs first. It refuses to apply (`profiles_unclassified_column`, or
   `profiles_classified_column_missing`) unless the live columns are exactly the classified set.
   It runs before any grant changes, so a refused apply changes nothing.
2. `REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.profiles FROM anon, authenticated;`
3. `GRANT UPDATE (onboarding_step, onboarding_completed, has_seen_completion_popup) ON public.profiles TO authenticated;`

| Class               | Columns                                                                                                                                                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| client_writable (3) | onboarding_step, onboarding_completed, has_seen_completion_popup                                                                                                                                                                                               |
| locked (16)         | id, email, full_name, avatar_url, locale, is_admin, message_count_this_month, message_count_reset_at, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_interval, subscription_tier_id, current_period_end, created_at, updated_at |

What changes and what stays the same:

- `authenticated` can UPDATE only the 3 columns above. `profiles_update_own` still limits that to
  the user's own row.
- `anon` can no longer write to the table at all.
- SELECT does not change for either role. `profiles_select` still decides which rows they see.
- Losing INSERT and DELETE changes nothing anyone can see today: production has no INSERT or
  DELETE policy, and no client code inserts or deletes profiles.
- `service_role` is unaffected. It keeps its grants and bypasses RLS.
- Sign-up still works. The profile row comes from `handle_new_user`, which is SECURITY DEFINER.
- The `set_updated_at_profiles` trigger still sets `updated_at`. Column privileges do not apply
  to values a trigger assigns.

## Writer verification

Browser (session client, bound by RLS). These are the only session-client writes in `src/`, and
`ios/`, `apps/`, `packages/` and `supabase/functions` contain none:

| Writer                                              | Columns                                                             | Result  |
| --------------------------------------------------- | ------------------------------------------------------------------- | ------- |
| `src/components/onboarding/onboarding-flow.tsx:268` | onboarding_step                                                     | allowed |
| `src/components/onboarding/onboarding-flow.tsx:496` | onboarding_completed, onboarding_step                               | allowed |
| `src/components/onboarding/onboarding-flow.tsx:515` | has_seen_completion_popup (+ onboarding_completed, onboarding_step) | allowed |

Nothing in `src/` writes `full_name`, `avatar_url` or `locale` with a session client.

Server writers of locked columns. Each one is traced back to where its client is created:

| Writer                                                                      | Client comes from                                                                                                                                                                                                                                                                                                                                                                       | Service role? |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| `src/lib/billing/entitlements.ts:124` `mirrorBillingSubscriptionToProfile`  | `api/paypal/cancel-subscription/route.ts:49` `createAdminClient()`; `api/billing/trial-paid-recovery/route.ts:45,191,203` and `api/billing/trial-management/route.ts:71,234,245,265` `deps.admin = createAdminClient()`; `api/paypal/approve-subscription/route.ts:86`; `api/paypal/webhook/route.ts:44` (`SUPABASE_SERVICE_ROLE_KEY`); `scripts/billing/trial-history-backfill.ts:267` | yes           |
| `src/lib/billing/entitlements.ts:164` `reconcileExpiredBillingEntitlements` | `api/billing/reconcile/route.ts:115-117` (`SUPABASE_SERVICE_ROLE_KEY`)                                                                                                                                                                                                                                                                                                                  | yes           |
| `src/lib/paypal/checkout-activation.ts:523` `upsertSubscriptionProfile`     | `deps.supabase`: `welcome/page.tsx:441` (admin), `api/freemium/purchase/complete/route.ts:495,509` (admin), `api/paypal/capture-order/route.ts:18`, `api/paypal/activation-status/route.ts:47`, `api/auth/set-checkout-password/route.ts:261`, `api/auth/send-magic-link/route.ts:260` (all `createAdminClient()`)                                                                      | yes           |
| `src/lib/stripe/checkout-activation.ts:1241,1358,1380`                      | `deps.supabase`: `welcome/page.tsx:145,188,265,328` (`supabase: admin`), `api/billing/one-time-activation-status/route.ts:59`, `scripts/billing/one-time-recover.ts:451,532` (admin), `api/stripe/webhook/route.ts:1048-1050` (`SUPABASE_SERVICE_ROLE_KEY`)                                                                                                                             | yes           |
| `src/lib/stripe/webhook-handlers.ts:71,1156`                                | `api/stripe/webhook/route.ts:1048-1050` (`SUPABASE_SERVICE_ROLE_KEY`); `lib/paypal/freemium-webhook-provisioning.ts:241` (`createAdminClient()`)                                                                                                                                                                                                                                        | yes           |
| `src/lib/dev/local-login.ts:133`                                            | `api/dev/login/route.ts:35` (`SUPABASE_SERVICE_ROLE_KEY`)                                                                                                                                                                                                                                                                                                                               | yes           |
| `src/app/api/chat/route.ts:559`                                             | `admin = createAdminClient()` (`route.ts:205`)                                                                                                                                                                                                                                                                                                                                          | yes           |
| `scripts/eval-chat/client.ts:136,191`                                       | admin                                                                                                                                                                                                                                                                                                                                                                                   | yes           |

`createAdminClient()` (`src/lib/supabase/admin.ts`) uses `SUPABASE_SERVICE_ROLE_KEY`. Two other
files reference `profiles` but only read it:

- `src/app/welcome/page.tsx:543` reads `onboarding_completed` with the session client. SELECT
  stays, so this keeps working.
- `src/app/onboarding/page.tsx:171` reads with the admin client.

Every SQL function that writes `profiles` is SECURITY DEFINER and is executable only by
service_role, or is the auth trigger:

- `handle_new_user`
- `prepare_personal_plan_test_owner`
- `mobile_registration_publish`
- `private.partner_access_fresh_start`

**Result: no blocker.** No writer of a locked column can run with a session client.

## Test evidence

`tests/profiles-privileged-columns-postgres.test.ts` (PGlite). How it is built:

- `profiles` is copied column by column from its owning migrations, with each migration cited.
- The policies are 00001's verbatim, plus `scripts/mobile/legacy-local-rls.sql` applied from the
  file (production's `profiles_select` + `is_admin()`).
- It starts from Supabase's default grants.
- Each request runs the way PostgREST runs it: `SET LOCAL ROLE` plus `request.jwt.claims`.

No existing fixture was edited. The test imports only `id()` from
`tests/personal-plan-pglite-migration.fixtures.ts`. That fixture's `profiles` stub has only `id`,
so it could not be reused.

The 12 tests check:

1. Red reproduction: before the lock, `authenticated` can set is_admin, subscription_status,
   current_period_end and email on its own row.
2. Classification: client_writable plus locked equals the table. `has_column_privilege`:
   `authenticated` has UPDATE on exactly the 3 columns. `is_admin` returns false and
   `onboarding_step` returns true. `anon` has none, service_role has all, SELECT is kept.
   Table-level INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER and REFERENCES are false for both roles.
3. Policies and triggers are identical before and after the migration.
4. Refuses to apply over an unclassified column (and grants stay unchanged) or a missing one.
5. As `authenticated`: every locked column (is_admin, subscription_status, current_period_end,
   email, stripe_customer_id, message_count_this_month, then the other 10) is rejected with
   42501, and the row is unchanged.
6. An allowed update that also sets a locked column fails as a whole.
7. INSERT, an upsert, DELETE as `authenticated`, and UPDATE as `anon` are all rejected with 42501.
8. The three onboarding-flow writes succeed on the user's own row, and `updated_at` is bumped.
9. The same update on another user's row changes 0 rows (RLS).
10. A signed-in user reads only their own row.
11. service_role writes every privileged column, and the local-login-style upsert works.
12. Sign-up via `handle_new_user` as a non-owner auth role still creates the profile.

Mutation checks (temporary edit, then restored byte-identical):

- Adding `is_admin` to the GRANT fails tests 2, 5 and 6.
- Dropping the REVOKE fails tests 2, 5, 6 and 7.

Runs on 2026-10-10:

- `node --import ./tests/server-only-register.cjs --import tsx --test` on the new test,
  `user-facts-lock-postgres`, `billing-subscriptions-access-grace` and every `tests/*onboarding*.test.ts`:
  **149 tests, 149 pass, 0 fail.**
- `onboarding-completion-ui.test.tsx` and `onboarding-product-drilldown-ui.test.tsx`: 2/2 pass.
- `npm run typecheck`: clean. `npm run lint`: 0 errors (5 pre-existing warnings in untouched files). `node scripts/mobile/check-migrations.mjs`: PASS.

## Production apply recipe (Nick)

1. Apply the file's content unchanged, via Supabase MCP `apply_migration` (name
   `profiles_privileged_columns_lock`) or the SQL editor. If it raises
   `profiles_unclassified_column` or `profiles_classified_column_missing`, stop: production drifted
   from the 2026-10-09 column list. Classify the column in the migration first.
2. Read-only confirmations:
   - `select has_column_privilege('authenticated','public.profiles','is_admin','UPDATE');` must be `false`.
   - `select has_column_privilege('authenticated','public.profiles','onboarding_step','UPDATE');` must be `true`.
3. Walk the web onboarding flow far enough to save one step (step → celebration) and confirm it
   saves. Then check Sentry for `permission denied for table profiles`.

Deploy order: there is no code change, so it does not matter.

## Rollback

`GRANT UPDATE ON public.profiles TO anon, authenticated;` restores the update path, which is the
prior vulnerable state. To restore the full prior grant set:
`GRANT INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.profiles TO anon, authenticated;`

## Not done (follow-ups)

- **Paywall fallback.** It still reads `profiles.subscription_status` / `current_period_end`
  (`src/lib/billing/subscriptions.ts`). With this lock, only service_role can write those columns.
  Whether the fallback itself should go is a separate decision.
- **`profiles.email` in PayPal identity binding.** `profiles.email` is used for PayPal and
  checkout identity binding (for example the `.eq("email", profile.email!)` guard at
  `src/lib/stripe/checkout-activation.ts:1241`). It is now locked against users. Existing rows a
  user may already have edited before the lock are not audited.
- **Audit for past exploitation.** Not done here. A read-only check of production for
  `is_admin = true` rows, or active `subscription_status` without a matching
  `billing_subscriptions` row, would show whether the hole was used.
- **Lockable columns, widen if Nick wants.** `full_name`, `avatar_url` and `locale` have no browser
  writer today, so they are locked. Widen with `GRANT UPDATE (<col>) ON public.profiles TO authenticated;`
  if a self-service editor needs them.

## Past-exploitation check (read-only, run against production before or after apply; not yet run on 2026-10-10 because the Supabase MCP hook was unreachable)

```sql
select 'admins' as check_name, count(*)::text as n,
       string_agg(left(email,3) || '***@' || split_part(email,'@',2) || ' (updated ' || to_char(updated_at,'YYYY-MM-DD') || ')', '; ') as detail
from public.profiles where is_admin = true
union all
select 'profile_active_no_billing_row', count(*)::text,
       string_agg(left(p.id::text,8) || ' ' || coalesce(p.subscription_status,'') || ' pe=' || coalesce(to_char(p.current_period_end,'YYYY-MM-DD'),'null') || ' upd=' || to_char(p.updated_at,'YYYY-MM-DD'), '; ')
from public.profiles p
where p.subscription_status in ('active','past_due')
  and not exists (select 1 from public.billing_subscriptions b where b.user_id = p.id)
  and p.email not like '%@hairconscierge.test' and p.email not like '%ci_seed%'
union all
select 'profile_active_null_period_end', count(*)::text,
       string_agg(left(p.id::text,8) || ' upd=' || to_char(p.updated_at,'YYYY-MM-DD'), '; ')
from public.profiles p
where p.subscription_status in ('active','past_due') and p.current_period_end is null
  and p.email not like '%@hairconscierge.test' and p.email not like '%ci_seed%';
```

Expected: `admins` lists only Nick's accounts; the other two rows are 0 or explainable by legacy (pre-billing-table) members. Anything else is a candidate exploitation and needs the row history checked.

**Result (run read-only 2026-10-10 by the orchestrating session):** `admins` = 1 (Nick's Gmail account, updated 2026-08-22). `profile_active_no_billing_row` = 3 and `profile_active_null_period_end` = the same 3 rows (ids f99c2794…, f456f2c1…, 429133e9…), all last updated 2026-04-28 to 2026-05-26, i.e. before the billing table existed; consistent with legacy members, not with a recent self-grant. No evidence of exploitation.

# supabase/pending

Parked migrations. Nothing here is applied by the migration tooling (`supabase db push`, the
local replay, the version-uniqueness and chain checks all read `supabase/migrations/` only).

## `20260930120000_user_facts_lock.sql`

The lock on `public.hair_profiles`: a guard trigger that rejects every write of a profile fact not
made by `public.user_facts_save_v1`, plus the browser INSERT/UPDATE/TRUNCATE/TRIGGER/REFERENCES
revokes. It ships as its own follow-up PR. That PR moves the file into `supabase/migrations/` with a
fresh timestamp AFTER the code deploy and the backfill (rollout step 4 in
`plans/2026-09-30-central-user-profile-clean-switch.md`). Applied earlier, every still-deployed
legacy writer would fail.

The lock tests (`tests/user-facts-lock-postgres.test.ts` and every harness that calls
`applyUserFactsLock` / `applyProofLock`) load the file from here via `USER_FACTS_LOCK_MIGRATION` in
`tests/personal-plan-pglite-migration.fixtures.ts`; update that constant when the file moves.

Rollback (removes the lock; the door keeps working without it):

```sql
DROP TRIGGER zz_hair_profiles_fact_write_guard ON public.hair_profiles;
DROP FUNCTION public.hair_profiles_reject_fact_write_outside_door();
DROP FUNCTION public.hair_profiles_fact_column_defaults_v1();
GRANT INSERT, UPDATE, TRUNCATE, TRIGGER, REFERENCES ON public.hair_profiles TO anon, authenticated;
```

import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

import { id } from "./personal-plan-pglite-migration.fixtures"

/**
 * The column lock on `public.profiles` (migration 20261011125354_20261009160000_profiles_privileged_columns_lock.sql)
 * on PGlite. Before it, `profiles_update_own` scoped rows but not columns and the browser roles
 * held table-level UPDATE, so a signed-in user could set `is_admin`, `subscription_status`,
 * `current_period_end` or `email` on their own row with one PostgREST request.
 *
 * `public.profiles` is transcribed column-for-column from its owning migrations (cited inline),
 * like the `hair_profiles` stub in personal-plan-pglite-migration.fixtures.ts, because
 * 00001_initial_schema.sql also builds vector tables, products, conversations and the rest. The
 * RLS policies are the REAL ones: 00001's three profiles policies verbatim, then
 * scripts/mobile/legacy-local-rls.sql (the production reconstruction: `profiles_select` +
 * `is_admin()`), applied from the file. Grants start as Supabase's defaults (production
 * 2026-10-09: anon/authenticated held all seven table privileges). Requests run the way PostgREST
 * runs them: a transaction, `SET LOCAL ROLE`, `request.jwt.claims` set locally.
 */

const ROOT = new URL("../", import.meta.url)
const LOCK_MIGRATION =
  "supabase/migrations/20261011125354_20261009160000_profiles_privileged_columns_lock.sql"
const LEGACY_RLS = "scripts/mobile/legacy-local-rls.sql"

const OWNER = id(1, 1)
const OTHER = id(2, 2)

/** The browser's writes (src/components/onboarding/onboarding-flow.tsx:268,496,515). */
const CLIENT_WRITABLE = ["has_seen_completion_popup", "onboarding_completed", "onboarding_step"]

const PREREQUISITES = `
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role BYPASSRLS;
CREATE ROLE supabase_auth_admin;

-- Supabase's auth.uid(): the JWT subject PostgREST puts into the request settings.
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb);

-- public.profiles as production has it (columns verified live 2026-10-09):
--   00001_initial_schema.sql:34-48   id, email, full_name, avatar_url, is_admin,
--                                    onboarding_completed, onboarding_step, locale,
--                                    subscription_tier_id (FK to subscription_tiers omitted:
--                                    no row content matters here), message_count_this_month,
--                                    message_count_reset_at, created_at, updated_at
--   20260408090000 / 20260416170000  onboarding_step -> text DEFAULT 'welcome'
--   20260408090000:24                has_seen_completion_popup
--   20260314153000:64-65             onboarding_completed NOT NULL
--   20260419_add_stripe_subscription_fields.sql  stripe_customer_id, stripe_subscription_id,
--                                    subscription_status, subscription_interval, current_period_end
CREATE TABLE public.profiles (
  id                       uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email                    text,
  full_name                text,
  avatar_url               text,
  is_admin                 boolean DEFAULT false,
  onboarding_completed     boolean NOT NULL DEFAULT false,
  onboarding_step          text DEFAULT 'welcome',
  locale                   text DEFAULT 'de',
  subscription_tier_id     uuid,
  message_count_this_month integer DEFAULT 0,
  message_count_reset_at   timestamptz,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now(),
  has_seen_completion_popup boolean NOT NULL DEFAULT false,
  stripe_customer_id       text UNIQUE,
  stripe_subscription_id   text UNIQUE,
  subscription_status      text,
  subscription_interval    text,
  current_period_end       timestamptz
);

-- 00001_initial_schema.sql:183, 195-206 (verbatim; legacy-local-rls.sql then replaces the two
-- SELECT policies with production's).
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own"
    ON profiles FOR SELECT
    USING (auth.uid() = id);
CREATE POLICY "profiles_select_admin"
    ON profiles FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 00001_initial_schema.sql:383-404, 410-423 (verbatim).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'avatar_url'
    );
    RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;
CREATE TRIGGER set_updated_at_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Supabase's default grants (production held exactly these on profiles before the lock).
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT ALL ON public.profiles TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth TO supabase_auth_admin;
GRANT INSERT ON auth.users TO supabase_auth_admin;
`

type PgError = { message: string; code?: string }

async function database(t: { after: (fn: () => Promise<void>) => void }, options = { lock: true }) {
  const pg = new PGlite()
  t.after(() => pg.close())
  await pg.exec(PREREQUISITES)
  await pg.exec(await readFile(new URL(LEGACY_RLS, ROOT), "utf8"))
  for (const userId of [OWNER, OTHER]) {
    await pg.query("INSERT INTO auth.users (id, email) VALUES ($1, $2)", [userId, `${userId}@t.de`])
  }
  if (options.lock) await applyLock(pg)
  return pg
}

async function applyLock(pg: PGlite) {
  await pg.exec(await readFile(new URL(LOCK_MIGRATION, ROOT), "utf8"))
}

/** One PostgREST request: its own transaction, the role, the JWT claims; returns affected rows. */
async function asRole(
  pg: PGlite,
  role: "anon" | "authenticated" | "service_role",
  sql: string,
  params: unknown[] = [],
  sub: string | null = OWNER,
): Promise<number> {
  await pg.exec("BEGIN")
  try {
    await pg.exec(`SET LOCAL ROLE ${role}`)
    if (sub) {
      await pg.query("SELECT set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub, role }),
      ])
    }
    const result = await pg.query(sql, params)
    await pg.exec("COMMIT")
    return result.affectedRows ?? 0
  } catch (error) {
    await pg.exec("ROLLBACK")
    throw error
  }
}

async function readProfile(pg: PGlite, userId: string) {
  const { rows } = await pg.query<Record<string, unknown>>(
    "SELECT * FROM public.profiles WHERE id = $1",
    [userId],
  )
  return rows[0] ?? null
}

function permissionDenied(error: PgError) {
  assert.equal(error.code, "42501")
  assert.match(error.message, /permission denied for table profiles/)
  return true
}

/** A value of the column's type that differs from what the seeded row holds. */
function changedValue(column: string, type: string): string {
  if (column === "id") return `'${id(9, 9)}'::uuid`
  const byType: Record<string, string> = {
    text: "'escalated'",
    boolean: `NOT coalesce(${column}, false)`,
    integer: "999999",
    uuid: `'${id(8, 8)}'::uuid`,
    "timestamp with time zone": "NULL",
  }
  return byType[type]!
}

async function migrationLists() {
  const sql = await readFile(new URL(LOCK_MIGRATION, ROOT), "utf8")
  const list = (name: string) =>
    [
      ...sql
        .match(new RegExp(`${name} CONSTANT text\\[\\] := ARRAY\\[([^\\]]*)\\]`))![1]!
        .matchAll(/'([a-z_]+)'/g),
    ]
      .map((match) => match[1]!)
      .sort()
  return { clientWritable: list("c_client_writable"), locked: list("c_locked") }
}

// ---------------------------------------------------------------------------
// Red: the harness reproduces the production hole before the lock
// ---------------------------------------------------------------------------

test("before the lock: a signed-in user can make themselves admin and paid with one request", async (t) => {
  const pg = await database(t, { lock: false })
  const changed = await asRole(
    pg,
    "authenticated",
    `UPDATE public.profiles
        SET is_admin = true, subscription_status = 'active', current_period_end = NULL,
            email = 'attacker@example.com'
      WHERE id = $1`,
    [OWNER],
  )
  assert.equal(changed, 1)
  const row = (await readProfile(pg, OWNER))!
  assert.equal(row.is_admin, true)
  assert.equal(row.subscription_status, "active")
})

// ---------------------------------------------------------------------------
// Structure: classification and privileges
// ---------------------------------------------------------------------------

test("every profiles column is classified; authenticated may UPDATE exactly the client-writable ones", async (t) => {
  const pg = await database(t)
  const { clientWritable, locked } = await migrationLists()
  assert.deepEqual(clientWritable, CLIENT_WRITABLE)
  const { rows: columns } = await pg.query<{ name: string }>(
    `SELECT attname AS name FROM pg_catalog.pg_attribute
      WHERE attrelid = 'public.profiles'::pg_catalog.regclass AND attnum > 0 AND NOT attisdropped
      ORDER BY attname`,
  )
  assert.deepEqual(
    [...clientWritable, ...locked].sort(),
    columns.map((column) => column.name),
    "client_writable + locked = the table, no overlap, nothing unclassified",
  )

  const columnPrivilege = async (role: string, column: string, kind: string) =>
    (
      await pg.query<{ ok: boolean }>(
        "SELECT has_column_privilege($1, 'public.profiles', $2, $3) AS ok",
        [role, column, kind],
      )
    ).rows[0]!.ok
  assert.equal(await columnPrivilege("authenticated", "is_admin", "UPDATE"), false)
  assert.equal(await columnPrivilege("authenticated", "onboarding_step", "UPDATE"), true)
  for (const column of columns.map((c) => c.name)) {
    const writable = clientWritable.includes(column)
    assert.equal(await columnPrivilege("authenticated", column, "UPDATE"), writable, column)
    assert.equal(await columnPrivilege("anon", column, "UPDATE"), false, `anon ${column}`)
    assert.equal(await columnPrivilege("service_role", column, "UPDATE"), true, `service ${column}`)
    for (const role of ["anon", "authenticated"]) {
      assert.equal(await columnPrivilege(role, column, "SELECT"), true, `${role} SELECT ${column}`)
    }
  }

  const tablePrivilege = async (role: string, kind: string) =>
    (
      await pg.query<{ ok: boolean }>(
        "SELECT has_table_privilege($1, 'public.profiles', $2) AS ok",
        [role, kind],
      )
    ).rows[0]!.ok
  for (const role of ["anon", "authenticated"]) {
    for (const kind of ["INSERT", "UPDATE", "DELETE", "TRUNCATE", "TRIGGER", "REFERENCES"]) {
      assert.equal(await tablePrivilege(role, kind), false, `${role} ${kind}`)
    }
    assert.equal(await tablePrivilege(role, "SELECT"), true, `${role} SELECT stays (RLS decides)`)
  }
  for (const kind of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
    assert.equal(await tablePrivilege("service_role", kind), true, `service_role ${kind}`)
  }
})

test("the migration touches no policy and no trigger", async (t) => {
  const pg = await database(t, { lock: false })
  const snapshot = async () =>
    (
      await pg.query(
        `SELECT 'policy' AS kind, policyname || ':' || cmd || ':' || coalesce(qual, '') || ':' || coalesce(with_check, '') AS item
           FROM pg_catalog.pg_policies WHERE schemaname = 'public' AND tablename = 'profiles'
         UNION ALL
         SELECT 'trigger', tgname FROM pg_catalog.pg_trigger
          WHERE tgrelid = 'public.profiles'::pg_catalog.regclass AND NOT tgisinternal
         ORDER BY 1, 2`,
      )
    ).rows
  const before = await snapshot()
  assert.deepEqual(
    before.map((row) => (row as { item: string }).item.split(":")[0]),
    ["profiles_select", "profiles_update_own", "set_updated_at_profiles"],
    "harness carries production's policies and trigger",
  )
  await applyLock(pg)
  assert.deepEqual(await snapshot(), before)
})

test("the migration refuses to apply over a column it does not classify, or a missing one, and changes nothing", async (t) => {
  const unclassified = await database(t, { lock: false })
  await unclassified.exec("ALTER TABLE public.profiles ADD COLUMN referral_code text")
  await assert.rejects(applyLock(unclassified), (error: PgError & { detail?: string }) => {
    assert.equal(error.message, "profiles_unclassified_column")
    assert.equal(error.detail, "referral_code")
    return true
  })
  const { rows } = await unclassified.query<{ ok: boolean }>(
    "SELECT has_table_privilege('authenticated', 'public.profiles', 'UPDATE') AS ok",
  )
  assert.equal(rows[0]!.ok, true, "a refused apply leaves the grants as they were")

  const missing = await database(t, { lock: false })
  await missing.exec("ALTER TABLE public.profiles DROP COLUMN locale")
  await assert.rejects(applyLock(missing), (error: PgError & { detail?: string }) => {
    assert.equal(error.message, "profiles_classified_column_missing")
    assert.equal(error.detail, "locale")
    return true
  })
})

// ---------------------------------------------------------------------------
// Rejections
// ---------------------------------------------------------------------------

test("rejected: a signed-in user updating any locked column on their own row (42501), row unchanged", async (t) => {
  const pg = await database(t)
  const before = await readProfile(pg, OWNER)
  const { locked } = await migrationLists()
  // The escalations named in the finding first, then every other locked column.
  const named = [
    "is_admin",
    "subscription_status",
    "current_period_end",
    "email",
    "stripe_customer_id",
    "message_count_this_month",
  ]
  for (const column of named) assert.ok(locked.includes(column), column)
  const { rows: types } = await pg.query<{ name: string; type: string }>(
    `SELECT attname AS name, pg_catalog.format_type(atttypid, atttypmod) AS type
       FROM pg_catalog.pg_attribute
      WHERE attrelid = 'public.profiles'::pg_catalog.regclass AND attnum > 0 AND NOT attisdropped`,
  )
  const typeOf = new Map(types.map((row) => [row.name, row.type]))
  for (const column of [...named, ...locked.filter((name) => !named.includes(name))]) {
    await assert.rejects(
      asRole(
        pg,
        "authenticated",
        `UPDATE public.profiles SET ${column} = ${changedValue(column, typeOf.get(column)!)} WHERE id = $1`,
        [OWNER],
      ),
      permissionDenied,
      column,
    )
  }
  assert.deepEqual(await readProfile(pg, OWNER), before)
})

test("rejected: a locked column smuggled into an allowed update fails the whole statement", async (t) => {
  const pg = await database(t)
  await assert.rejects(
    asRole(
      pg,
      "authenticated",
      "UPDATE public.profiles SET onboarding_step = 'celebration', is_admin = true WHERE id = $1",
      [OWNER],
    ),
    permissionDenied,
  )
  const row = (await readProfile(pg, OWNER))!
  assert.equal(row.onboarding_step, "welcome")
  assert.equal(row.is_admin, false)
})

test("rejected: INSERT, upsert and DELETE as authenticated; any write as anon", async (t) => {
  const pg = await database(t)
  await pg.query("DELETE FROM public.profiles WHERE id = $1", [OTHER])
  await assert.rejects(
    asRole(pg, "authenticated", "INSERT INTO public.profiles (id) VALUES ($1)", [OTHER], OTHER),
    permissionDenied,
  )
  await assert.rejects(
    asRole(
      pg,
      "authenticated",
      `INSERT INTO public.profiles (id, is_admin) VALUES ($1, true)
       ON CONFLICT (id) DO UPDATE SET is_admin = excluded.is_admin`,
      [OWNER],
    ),
    permissionDenied,
  )
  await assert.rejects(
    asRole(pg, "authenticated", "DELETE FROM public.profiles WHERE id = $1", [OWNER]),
    permissionDenied,
  )
  await assert.rejects(
    asRole(
      pg,
      "anon",
      "UPDATE public.profiles SET onboarding_step = 'x' WHERE id = $1",
      [OWNER],
      null,
    ),
    permissionDenied,
  )
  assert.ok(await readProfile(pg, OWNER))
  assert.equal(await readProfile(pg, OTHER), null)
})

// ---------------------------------------------------------------------------
// Allowed
// ---------------------------------------------------------------------------

test("allowed: the onboarding flow's three writes on the own row; the updated_at trigger still fires", async (t) => {
  const pg = await database(t)
  const before = (await readProfile(pg, OWNER))!
  await pg.exec(
    `UPDATE public.profiles SET updated_at = now() - interval '1 day' WHERE id = '${OWNER}'`,
  )

  // onboarding-flow.tsx:268 saveOnboardingStep
  assert.equal(
    await asRole(
      pg,
      "authenticated",
      "UPDATE public.profiles SET onboarding_step = $2 WHERE id = $1",
      [OWNER, "x"],
    ),
    1,
  )
  let row = (await readProfile(pg, OWNER))!
  assert.equal(row.onboarding_step, "x")
  assert.ok((row.updated_at as Date) > (before.updated_at as Date), "set_updated_at_profiles ran")

  // onboarding-flow.tsx:496 completion
  assert.equal(
    await asRole(
      pg,
      "authenticated",
      "UPDATE public.profiles SET onboarding_completed = true, onboarding_step = 'celebration' WHERE id = $1",
      [OWNER],
    ),
    1,
  )
  // onboarding-flow.tsx:515 celebration popup (with the completion fallback)
  assert.equal(
    await asRole(
      pg,
      "authenticated",
      `UPDATE public.profiles
          SET has_seen_completion_popup = true, onboarding_completed = true,
              onboarding_step = 'celebration'
        WHERE id = $1`,
      [OWNER],
    ),
    1,
  )
  row = (await readProfile(pg, OWNER))!
  assert.equal(row.onboarding_completed, true)
  assert.equal(row.has_seen_completion_popup, true)
  assert.equal(row.onboarding_step, "celebration")
})

test("RLS still scopes the allowed columns: the same update on another user's row changes 0 rows", async (t) => {
  const pg = await database(t)
  assert.equal(
    await asRole(
      pg,
      "authenticated",
      "UPDATE public.profiles SET onboarding_step = 'x' WHERE id = $1",
      [OTHER],
    ),
    0,
  )
  assert.equal((await readProfile(pg, OTHER))!.onboarding_step, "welcome")
})

test("allowed: a signed-in user still reads their own row and only their own row", async (t) => {
  const pg = await database(t)
  await pg.exec("BEGIN")
  await pg.exec("SET LOCAL ROLE authenticated")
  await pg.query("SELECT set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: OWNER, role: "authenticated" }),
  ])
  const { rows } = await pg.query<{ id: string; onboarding_completed: boolean }>(
    "SELECT id, onboarding_completed FROM public.profiles ORDER BY id",
  )
  await pg.exec("COMMIT")
  assert.deepEqual(
    rows.map((row) => row.id),
    [OWNER],
  )
})

test("allowed: service_role writes every privileged column (billing mirrors, webhooks, chat counter)", async (t) => {
  const pg = await database(t)
  assert.equal(
    await asRole(
      pg,
      "service_role",
      `UPDATE public.profiles
          SET subscription_status = 'active', current_period_end = now() + interval '30 days',
              stripe_customer_id = 'cus_1', stripe_subscription_id = 'sub_1',
              subscription_interval = 'month', message_count_this_month = 3,
              email = 'new@t.de', is_admin = false
        WHERE id = $1`,
      [OWNER],
      null,
    ),
    1,
  )
  assert.equal((await readProfile(pg, OWNER))!.subscription_status, "active")
  // src/lib/dev/local-login.ts-style upsert.
  await asRole(
    pg,
    "service_role",
    `INSERT INTO public.profiles (id, email, full_name, onboarding_completed)
     VALUES ($1, 'dev@t.de', 'Local Dev User', true)
     ON CONFLICT (id) DO UPDATE SET email = excluded.email, full_name = excluded.full_name`,
    [OWNER],
    null,
  )
  assert.equal((await readProfile(pg, OWNER))!.full_name, "Local Dev User")
})

test("allowed: sign-up still creates the profile (SECURITY DEFINER handle_new_user, auth admin role)", async (t) => {
  const pg = await database(t)
  const newUser = id(3, 3)
  await pg.exec("BEGIN")
  await pg.exec("SET LOCAL ROLE supabase_auth_admin")
  await pg.query("INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)", [
    newUser,
    "neu@t.de",
    JSON.stringify({ full_name: "Neu" }),
  ])
  await pg.exec("COMMIT")
  const row = (await readProfile(pg, newUser))!
  assert.equal(row.email, "neu@t.de")
  assert.equal(row.full_name, "Neu")
  assert.equal(row.is_admin, false)
})

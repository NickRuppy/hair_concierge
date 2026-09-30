import { readFile } from "node:fs/promises"

import {
  applyUserFactsLock,
  migratedPersonalPlanDatabase,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * PGlite harness for the two iOS publishers on the REAL schema (clean-switch tasks 3 + 4).
 *
 * Built on `migratedPersonalPlanDatabase`: the real personal-plan migrations, the real
 * `hair_profiles` shape (every column transcribed from its owning migration) with its real
 * triggers — `set_updated_at_hair_profiles`, the main #611 `primary_concern` trigger — and the
 * three real user-facts migrations incl. `user_facts_save_v1`. On top of that the real mobile
 * migrations, in deploy order, which add the third hair_profiles trigger
 * (`scanner_context_source_changed`, the scanner clock), the scanner tables and both publishers,
 * then the two clean-switch migrations under test.
 *
 * Stubbed (FK targets / columns only these functions touch): `profiles.full_name` and
 * `public.leads` (id, name, email, marketing_consent, quiz_answers, quiz_kind, status, user_id,
 * created_at — the columns `mobile_registration_publish` inserts and the scanner read selects).
 * The scanner trigger is installed on the stub `leads` by the real migration, so lead inserts
 * move the clock exactly as in production.
 *
 * NOT covered (single-connection engine): two-session races. See the task report.
 */

const ROOT = new URL("../", import.meta.url)

export const MOBILE_MIGRATIONS = [
  "supabase/migrations/20260916175235_hosted_mobile_scanner_context.sql",
  "supabase/migrations/20260916175239_hosted_mobile_profile_edit.sql",
  "supabase/migrations/20260917063601_mobile_registration_intents.sql",
  "supabase/migrations/20260917063827_mobile_registration_publication.sql",
  "supabase/migrations/20260917065627_mobile_registration_completion_admission.sql",
] as const

export const CLEAN_SWITCH_MIGRATIONS = [
  "supabase/migrations/20260930090000_scanner_profile_edit_through_user_facts.sql",
  "supabase/migrations/20260930090100_mobile_registration_through_user_facts.sql",
] as const

const MOBILE_STUBS = `
ALTER TABLE public.profiles ADD COLUMN full_name text;
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  email text,
  marketing_consent boolean,
  quiz_answers jsonb,
  quiz_kind text,
  status text,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
`

/**
 * `cleanSwitch: false` runs the PRE-switch publishers (they write fact columns directly), which
 * the lock rejects by design — so the lock is applied only on the clean-switch chain, and last.
 * `lock: false` leaves it off for a test that seeds a legacy row first and then calls
 * `applyUserFactsLock` itself (see personal-plan-pglite-migration.fixtures.ts).
 */
export async function mobileFactsDatabase(
  t: { after: (fn: () => Promise<void>) => void },
  options: { cleanSwitch?: boolean; lock?: boolean } = {},
): Promise<PersonalPlanTestDb> {
  const pg = await migratedPersonalPlanDatabase(t, { lock: false })
  await pg.exec(MOBILE_STUBS)
  const files = [
    ...MOBILE_MIGRATIONS,
    ...(options.cleanSwitch === false ? [] : CLEAN_SWITCH_MIGRATIONS),
  ]
  for (const file of files) await pg.exec(await readFile(new URL(file, ROOT), "utf8"))
  if (options.cleanSwitch !== false && options.lock !== false) await applyUserFactsLock(pg)
  return pg
}

/** A supabase-js-shaped `rpc` over PGlite, using named-argument notation so no signature list
 * has to be kept in sync with the migrations. */
export function pgliteRpcClient(pg: PersonalPlanTestDb) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  return {
    calls,
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args })
      const entries = Object.entries(args).filter(([, value]) => value !== undefined)
      const sql = `select public.${name}(${entries
        .map(([key], index) => `${key} => $${index + 1}`)
        .join(",")}) as result`
      try {
        const { rows } = await pg.query<{ result: unknown }>(
          sql,
          entries.map(([, value]) =>
            value !== null && typeof value === "object" ? JSON.stringify(value) : value,
          ),
        )
        return { data: rows[0]!.result, error: null }
      } catch (error) {
        return { data: null, error }
      }
    },
  }
}

/** `pgliteRpcClient` plus the one table read `loadUserFacts` makes
 * (`from(t).select(cols).eq(col, v).maybeSingle()`), so the web account link
 * (`writeAccountLinkFacts`) runs against the same real schema. */
export function pgliteAdminClient(pg: PersonalPlanTestDb) {
  const rpc = pgliteRpcClient(pg)
  return {
    ...rpc,
    from(table: string) {
      let columns = "*"
      let filter: [string, unknown] | null = null
      const query = {
        select(selected: string) {
          columns = selected
          return query
        },
        eq(column: string, value: unknown) {
          filter = [column, value]
          return query
        },
        async maybeSingle() {
          const safe = (name: string) => {
            if (!/^[a-z_]+$/.test(name)) throw new Error(`unsupported identifier ${name}`)
            return name
          }
          const list =
            columns === "*"
              ? "*"
              : columns
                  .split(",")
                  .map((c) => safe(c.trim()))
                  .join(",")
          const { rows } = await pg.query<Record<string, unknown>>(
            `select ${list} from public.${safe(table)} where ${safe(filter![0])} = $1`,
            [filter![1]],
          )
          return { data: rows[0] ?? null, error: null }
        },
      }
      return query
    },
  }
}

/** A lead's `created_at` as PostgREST serialises it (ISO, microseconds kept). */
export async function leadCreatedAt(pg: PersonalPlanTestDb, leadId: string): Promise<string> {
  const { rows } = await pg.query<{ created_at: string }>(
    "select to_json(created_at) #>> '{}' as created_at from public.leads where id = $1",
    [leadId],
  )
  return rows[0]!.created_at
}

export async function readClock(pg: PersonalPlanTestDb, userId: string) {
  const { rows } = await pg.query<{ revision: string; profile_revision: string }>(
    "select revision::text, profile_revision::text from public.scanner_context_sources where user_id = $1",
    [userId],
  )
  const row = rows[0]
  return row
    ? { revision: BigInt(row.revision), profile: BigInt(row.profile_revision) }
    : { revision: BigInt(0), profile: BigInt(0) }
}

export async function readRow(pg: PersonalPlanTestDb, userId: string) {
  const { rows } = await pg.query<Record<string, unknown>>(
    "select * from public.hair_profiles where user_id = $1",
    [userId],
  )
  return rows[0] ?? null
}

/** The 13 columns `user_facts_save_v1` derives from `diagnostics`. */
export const DIAGNOSTICS_COLUMNS = [
  "hair_texture",
  "thickness",
  "density",
  "hair_length",
  "cuticle_condition",
  "protein_moisture_balance",
  "scalp_type",
  "scalp_condition",
  "chemical_treatment",
  "concerns",
  "goals",
  "desired_volume",
  "primary_concern",
] as const

/** A verified registration intent for `userId` plus the completion input the route would pass. */
export async function registrationIntent(
  pg: PersonalPlanTestDb,
  client: ReturnType<typeof pgliteRpcClient>,
  userId: string,
  choice: "create" | "replace" | "keep",
  answers: Record<string, unknown>,
) {
  const { registrationSubmissionHash } = await import("../src/lib/mobile/registration-contract")
  const submission = {
    requestId: crypto.randomUUID(),
    email: "registration@example.test",
    firstName: "New Name",
    marketingOptIn: true,
    answers,
  }
  const attemptId = crypto.randomUUID(),
    sendGeneration = crypto.randomUUID()
  await pg.query(
    `insert into mobile_registration_intents(id,request_id,request_hash,email,send_generation,provider_user_id,verified_user_id,verified_at)values($1,$2,$3,$4,$5,$6,$6,now())`,
    [
      attemptId,
      submission.requestId,
      registrationSubmissionHash(submission as never),
      submission.email,
      sendGeneration,
      userId,
    ],
  )
  const source = (await client.rpc("scanner_context_read_source", { p_user_id: userId })).data as {
    profileRevision: string
  }
  return {
    attemptId,
    sendGeneration,
    submission,
    choice,
    expectedProfileRevision: source.profileRevision,
  }
}

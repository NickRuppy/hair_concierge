/**
 * An in-memory stand-in for `public.user_facts_save_v1`
 * (`supabase/migrations/20260929231300_user_facts_save_v1.sql`) for unit tests that drive the
 * account-link writers through a fake Supabase client. It mirrors the SQL steps those writers
 * depend on — the revision CAS, `create_only` preserve (a pure preserve of ANY existing
 * domain, F3) and its `preservedCandidates` union, the top-level field-level merge where a JSON null
 * clears a key, the `fields` provenance merge (cleared keys drop out) and the revision bump.
 * It never derives legacy columns (that has its own parity test against the real SQL).
 */

import { deriveLegacyColumns } from "../src/lib/user-facts/derive-legacy-columns"
import type { CareHabitsV1, DiagnosticsV1 } from "../src/lib/user-facts/schema"

type Row = Record<string, unknown>

function isRecord(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function simulateUserFactsSave(rows: Row[], args: Row): Row {
  let profile = rows.find((row) => row.user_id === args.p_user_id)
  const expected = args.p_expected_revision as number | null | undefined

  if (!profile) {
    if (expected != null && expected !== 0) return { status: "revision_conflict", revision: 0 }
    profile = { user_id: args.p_user_id, facts_revision: 0, facts_provenance: {} }
    rows.push(profile)
  }

  const revision = (profile.facts_revision as number | undefined) ?? 0
  if (expected != null && expected !== revision) {
    return { status: "revision_conflict", revision }
  }

  const domain = args.p_domain as string
  const oldDomain = isRecord(profile[domain]) ? (profile[domain] as Row) : null
  const allProvenance = isRecord(profile.facts_provenance) ? (profile.facts_provenance as Row) : {}
  const oldProvenance = isRecord(allProvenance[domain]) ? (allProvenance[domain] as Row) : {}
  let provenance = args.p_provenance as Row
  let patch = args.p_patch as Row

  if (args.p_mode === "create_only" && oldDomain !== null) {
    const incoming = Array.isArray(provenance.preservedCandidates)
      ? (provenance.preservedCandidates as Row[])
      : []
    const existing = Array.isArray(oldProvenance.preservedCandidates)
      ? (oldProvenance.preservedCandidates as Row[])
      : []
    if (incoming.length > 0 || existing.length > 0) {
      const union = [...existing]
      for (const entry of incoming) {
        if (!union.some((kept) => kept.kind === entry.kind && kept.id === entry.id)) {
          union.push(entry)
        }
      }
      profile.facts_provenance = {
        ...allProvenance,
        [domain]: { ...oldProvenance, preservedCandidates: union },
      }
    }
    return { status: "preserved", revision, changed: false, diagnosticsHash: null }
  }

  // Step (4b), migration 20261006180000: in care_habits an `assumed` key (value or clear) never
  // replaces a stored key whose provenance is anything but `assumed` (a missing entry is real).
  if (domain === "care_habits" && oldDomain !== null) {
    const incomingFields = isRecord(provenance.fields) ? provenance.fields : {}
    const storedFields = isRecord(oldProvenance.fields) ? oldProvenance.fields : {}
    const keptReal = Object.keys(patch).filter(
      (key) =>
        incomingFields[key] === "assumed" && key in oldDomain && storedFields[key] !== "assumed",
    )
    if (keptReal.length > 0) {
      patch = Object.fromEntries(Object.entries(patch).filter(([key]) => !keptReal.includes(key)))
      provenance = {
        ...provenance,
        fields: Object.fromEntries(
          Object.entries(incomingFields).filter(([key]) => !keptReal.includes(key)),
        ),
      }
    }
  }

  const cleared = Object.entries(patch)
    .filter(([, value]) => value === null)
    .map(([key]) => key)
  const nextDomain: Row = { ...(oldDomain ?? {}), ...patch }
  for (const key of cleared) delete nextDomain[key]

  const fields: Row = {
    ...(isRecord(oldProvenance.fields) ? oldProvenance.fields : {}),
    ...(isRecord(provenance.fields) ? provenance.fields : {}),
  }
  for (const key of cleared) delete fields[key]

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripped, re-added below
  const { fields: _fields, preservedCandidates: _candidates, ...envelope } = provenance
  const merged: Row = { ...envelope }
  if (Object.keys(fields).length > 0) merged.fields = fields
  if (Array.isArray(oldProvenance.preservedCandidates)) {
    merged.preservedCandidates = oldProvenance.preservedCandidates
  }

  profile[domain] = nextDomain
  profile.facts_provenance = { ...allProvenance, [domain]: merged }
  profile.facts_revision = revision + 1
  return {
    status: "ok",
    revision: revision + 1,
    changed: JSON.stringify(nextDomain) !== JSON.stringify(oldDomain),
    diagnosticsHash: null,
  }
}

/**
 * Clean-switch task 7B: an in-memory client whose `hair_profiles` writes go through the door, for
 * unit tests of seeders that now save profiles via `saveUserFacts` / `writeAccountLinkFacts`
 * (e.g. `scripts/mobile/profile-fixture.ts`). Wraps a table-collecting fake: adds the one
 * guarded read (`from(t).select(cols).eq(col, v).maybeSingle()`) and `rpc("user_facts_save_v1")`
 * via `simulateUserFactsSave`, then derives the legacy columns with the parity-tested TS oracle,
 * as the SQL door does. Rows land in `rows.hair_profiles` in write order.
 */
export function withSimulatedDoor<
  Client extends { from: (table: string) => Record<string, unknown> },
>(rows: Record<string, Row[]>, client: Client) {
  return {
    ...client,
    from(table: string) {
      return {
        ...client.from(table),
        select(columns: string) {
          return {
            eq(column: string, value: unknown) {
              return {
                async maybeSingle() {
                  const row = (rows[table] ?? []).find((entry) => entry[column] === value)
                  if (!row) return { data: null, error: null }
                  const picked = Object.fromEntries(
                    columns.split(",").map((name) => [name.trim(), row[name.trim()] ?? null]),
                  )
                  return { data: picked, error: null }
                },
              }
            },
          }
        },
      }
    },
    async rpc(name: string, args: Row) {
      if (name !== "user_facts_save_v1")
        throw new Error(`withSimulatedDoor: unexpected rpc ${name}`)
      const table = (rows.hair_profiles ??= [])
      const result = simulateUserFactsSave(table, args)
      if (result.status === "ok") {
        const row = table.find((entry) => entry.user_id === args.p_user_id)!
        row.facts_provenance ??= {}
        Object.assign(
          row,
          deriveLegacyColumns({
            diagnostics: (row.diagnostics ?? null) as DiagnosticsV1 | null,
            careHabits: (row.care_habits ?? null) as CareHabitsV1 | null,
          }),
        )
      }
      return { data: result, error: null }
    },
  }
}

import assert from "node:assert/strict"
import test from "node:test"

import { deriveLegacyColumns } from "../src/lib/user-facts/derive-legacy-columns"
import {
  CARE_HABITS_DERIVATION_ROWS,
  DIAGNOSTICS_DERIVATION_ROWS,
  type DerivationRow,
} from "./fixtures/user-facts-derivation-rows"
import {
  insertProfile,
  migratedPersonalPlanDatabase,
  readHairProfile,
  saveUserFacts,
  type HairProfileRow,
  type PersonalPlanTestDb,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Drift guard between the two implementations of one specification: the
 * TypeScript oracle `src/lib/user-facts/derive-legacy-columns.ts` (task 2) and
 * the SQL inside `public.user_facts_save_v1` (task 3). Every row from the shared
 * source in `fixtures/user-facts-derivation-rows.ts` is written through the RPC
 * on a real Postgres and the resulting `hair_profiles` columns must equal what
 * the oracle computes for the same document — every vocabulary table, every
 * priority order, and every absent-vs-empty distinction included.
 *
 * Differential on purpose: the expected values come from the oracle, not from
 * literals in this file, so neither side can quietly be "fixed" to agree with a
 * wrong expectation. The literal expectations live in
 * `user-facts-derive-legacy-columns.test.ts` and
 * `user-facts-save-v1-migration.test.ts`.
 */

const PROVENANCE = {
  source: { kind: "personal_plan_artifact", id: "artifact-parity" },
  schemaVersion: 1,
  at: "2026-09-15T10:00:00.000Z",
}

/** Distinct, deterministic uuids: one user per row, one shared database. */
function userIdForRow(index: number): string {
  return `${String(index).padStart(8, "0")}-0000-4000-8000-000000000000`
}

async function writeRow(
  pg: PersonalPlanTestDb,
  row: DerivationRow,
  index: number,
): Promise<HairProfileRow> {
  const userId = userIdForRow(index)
  await insertProfile(pg, userId)
  const domain = row.diagnostics ? "diagnostics" : "care_habits"
  const result = await saveUserFacts(pg, {
    userId,
    domain,
    patch: row.diagnostics ?? row.careHabits,
    provenance: PROVENANCE,
  })
  assert.equal(result.status, "ok", `${row.name}: expected the write to be accepted`)
  const stored = await readHairProfile(pg, userId)
  assert.ok(stored, `${row.name}: expected a hair_profiles row`)
  return stored
}

test("every derivation row projects identically in SQL and in the TypeScript oracle", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t)
  const rows = [...DIAGNOSTICS_DERIVATION_ROWS, ...CARE_HABITS_DERIVATION_ROWS]
  // The two lists together must exercise the whole rule set; a shrinking source
  // would otherwise silently weaken this guard.
  assert.ok(rows.length >= 45, `expected a broad row source, got ${rows.length}`)

  for (const [index, row] of rows.entries()) {
    const stored = await writeRow(pg, row, index)
    const expected = deriveLegacyColumns({
      diagnostics: row.diagnostics ?? null,
      careHabits: row.careHabits ?? null,
    })

    for (const [column, value] of Object.entries(expected)) {
      assert.deepEqual(
        stored[column as keyof HairProfileRow],
        value,
        `${row.name}: ${column} diverges between SQL and TypeScript`,
      )
    }
  }
})

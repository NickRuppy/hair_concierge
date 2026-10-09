import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import {
  migratedPersonalPlanDatabase,
  personalPlanMigrationChain,
} from "./personal-plan-pglite-migration.fixtures"

/**
 * Every static `.from("<table>").select("<columns>")` in `src/` names columns that exist.
 *
 * PostgREST rejects the WHOLE query when one selected column is missing, and unit tests with fake
 * clients never notice. 2026-10-05: `hair_profiles.shampoo_frequency` (a TypeScript-only derived
 * field, never a column) made the Feinschliff unopenable for every legacy member.
 *
 * The schema is the one the REAL migration chain builds on PGlite (`migratedPersonalPlanDatabase`
 * — the personal-plan and user-facts tables, `hair_profiles` transcribed column-for-column).
 * Only tables a replayed migration CREATEs (plus the transcribed `hair_profiles`) are checked;
 * the harness's foreign-key stubs (`profiles`, `products`, `leads`, …) carry only the columns
 * the DDL needs and are skipped, not guessed. Only literal column lists are
 * checked: a string or `${}`-free template literal passed inline or through a same-file
 * `const`. Embedded resources (`rel(...)`), aliases (`alias:column`), casts and JSON paths are
 * reduced to their base column; `*` is skipped.
 */

// npm test scripts run from the repository root.
const ROOT = process.cwd()
const SRC = path.join(ROOT, "src")

type SelectSite = { file: string; line: number; table: string; columns: string }

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return sourceFiles(full)
      return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
    }),
  )
  return files.flat()
}

const SELECT_SITE =
  /\.from\(\s*["'`]([a-z_][a-z0-9_]*)["'`]\s*\)\s*\.select\(\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`|([A-Za-z_$][\w$]*)\s*[,)])/g

function constantLiteral(source: string, name: string): string | null {
  const match = new RegExp(
    `const\\s+${name}\\s*(?::\\s*string\\s*)?=\\s*(?:"([^"]*)"|'([^']*)'|\`([^\`$]*)\`)`,
  ).exec(source)
  return match ? (match[1] ?? match[2] ?? match[3] ?? null) : null
}

function selectSites(file: string, source: string): SelectSite[] {
  const sites: SelectSite[] = []
  for (const match of source.matchAll(SELECT_SITE)) {
    const literal = match[2] ?? match[3] ?? match[4]
    const columns = literal ?? (match[5] ? constantLiteral(source, match[5]) : null)
    if (columns === null || columns === undefined) continue
    const line = source.slice(0, match.index).split("\n").length
    sites.push({ file, line, table: match[1], columns })
  }
  return sites
}

/** Top-level column names of a PostgREST select list. */
function topLevelColumns(columns: string): string[] {
  const tokens: string[] = []
  let depth = 0
  let current = ""
  for (const char of columns) {
    if (char === "(") depth += 1
    if (char === ")") depth -= 1
    if (char === "," && depth === 0) {
      tokens.push(current)
      current = ""
      continue
    }
    current += char
  }
  tokens.push(current)
  return tokens.flatMap((raw) => {
    const token = raw.trim()
    if (!token || token === "*" || token.includes("(")) return []
    const withoutCast = token.split("::")[0]
    const withoutAlias = withoutCast.includes(":") ? withoutCast.split(":")[1] : withoutCast
    const base = withoutAlias.split("->")[0].trim()
    return /^[a-z_][a-z0-9_]*$/.test(base) ? [base] : []
  })
}

test("the parser reduces aliases, casts, JSON paths and embedded resources to base columns", () => {
  assert.deepEqual(
    topLevelColumns(
      "id, total:amount::text, payload->>kind, profiles(hair_profiles(*)), *, owner:user_id",
    ),
    ["id", "amount", "payload", "user_id"],
  )
})

test("every static select names columns the migrated schema has", async (t) => {
  const pg = await migratedPersonalPlanDatabase(t, { stage1Sources: true })
  const { rows } = await pg.query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`,
  )
  const schema = new Map<string, Set<string>>()
  for (const row of rows) {
    if (!schema.has(row.table_name)) schema.set(row.table_name, new Set())
    schema.get(row.table_name)!.add(row.column_name)
  }

  const chain = personalPlanMigrationChain({ stage1Sources: true })
  const authoritative = new Set<string>(["hair_profiles"])
  for (const migration of chain) {
    const sql = await readFile(path.join(ROOT, migration), "utf8")
    for (const match of sql.matchAll(
      /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?([a-z_][a-z0-9_]*)/gi,
    )) {
      authoritative.add(match[1].toLowerCase())
    }
  }
  // Migrations outside the harness chain may still ALTER an authoritative table (e.g. the
  // optional-prefill migration adds `personal_plans.legacy_prefill_v1`): replay their column
  // ADDs and DROPs in deploy (filename) order on top of the PGlite schema.
  const migrationsDir = path.join(ROOT, "supabase/migrations")
  const inChain = new Set(chain.map((migration) => path.basename(migration)))
  for (const name of (await readdir(migrationsDir)).filter((n) => n.endsWith(".sql")).sort()) {
    if (inChain.has(name)) continue
    const sql = await readFile(path.join(migrationsDir, name), "utf8")
    for (const statement of sql.matchAll(
      /ALTER TABLE (?:IF EXISTS )?(?:ONLY )?(?:public\.)?([a-z_][a-z0-9_]*)([^;]*);/gi,
    )) {
      const table = statement[1].toLowerCase()
      if (!authoritative.has(table) || !schema.has(table)) continue
      for (const added of statement[2].matchAll(
        /ADD COLUMN (?:IF NOT EXISTS )?([a-z_][a-z0-9_]*)/gi,
      )) {
        schema.get(table)!.add(added[1].toLowerCase())
      }
      for (const dropped of statement[2].matchAll(
        /DROP COLUMN (?:IF EXISTS )?([a-z_][a-z0-9_]*)/gi,
      )) {
        schema.get(table)!.delete(dropped[1].toLowerCase())
      }
    }
  }

  const sites = (
    await Promise.all(
      (await sourceFiles(SRC)).map(async (file) =>
        selectSites(path.relative(ROOT, file), await readFile(file, "utf8")),
      ),
    )
  ).flat()

  const checked = sites.filter((site) => authoritative.has(site.table) && schema.has(site.table))
  assert.ok(checked.length > 20, `only ${checked.length} select sites matched the harness schema`)
  assert.ok(
    checked.some((site) => site.table === "hair_profiles"),
    "no hair_profiles select was checked",
  )

  const missing = checked.flatMap((site) =>
    topLevelColumns(site.columns)
      .filter((column) => !schema.get(site.table)!.has(column))
      .map((column) => `${site.file}:${site.line} ${site.table}.${column}`),
  )
  assert.deepEqual(
    missing,
    [],
    `selects name columns the schema does not have:\n${missing.join("\n")}`,
  )
})

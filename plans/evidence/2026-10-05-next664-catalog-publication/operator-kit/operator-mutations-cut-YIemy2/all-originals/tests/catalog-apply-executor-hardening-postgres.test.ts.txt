import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"

import { PGlite } from "@electric-sql/pglite"

/**
 * Executes the WHOLE catalog-apply hardening migration against every executor
 * it patches. tests/leave-in-calibration-executor-postgres.test.ts proves the
 * calibration executor's behavior end to end; this file proves the other
 * twelve patches apply, and that each one changes nothing but its listed edits.
 *
 * The installed definitions are rebuilt from the repository in migration
 * order: each executor's CREATE statements plus every later in-place patch
 * block (pg_get_functiondef → replace → EXECUTE) that targets it. Bodies are
 * created with check_function_bodies off, so no tables are needed — only the
 * source text is under test. The rebuilt bodies are then pinned to the md5 of
 * the production `prosrc` (read-only, 2026-09-29), so the patches are proven
 * against the definitions production actually has.
 */

const ROOT = new URL("../", import.meta.url)
const MIGRATIONS_DIR = new URL("supabase/migrations/", ROOT)
const HARDENING_FILE = "20260929090000_catalog_apply_executor_null_guards_shared_lock.sql"
const SHARED_LOCK = "pg_catalog.hashtextextended('catalog-enrichment:product-apply', 0)"
const SHARED_LOCK_BLOCK = `  PERFORM pg_catalog.pg_advisory_xact_lock(
    ${SHARED_LOCK}
  );
`

/** md5(prosrc) of each executor in production before the hardening migration. */
const PRODUCTION_PROSRC_MD5: Record<string, string> = {
  apply_catalog_authority_oil_repair_v1: "553e7d693f4403a7b52995b2b52c23d6",
  apply_catalog_enrichment_leave_in_calibration_v1: "43bb9cfe786d39be9105f1b66dd4e8aa",
  apply_catalog_enrichment_personal_plan_heat_v1: "ed02876aaaa4b8917022d055ed126d33",
  apply_catalog_enrichment_personal_plan_scalp_v1: "fb1c61a2a2bc64ea307a060d98366676",
  apply_catalog_enrichment_scalp_image_correction_v1: "d513b129758ce02bde0e6b36a3094d80",
  apply_personal_plan_exact_catalog_bundle_v1: "e83351a955f45c206b2a43ad7796afa0",
  apply_personal_plan_product_disposition_resolutions_v1: "b65cfb7483fb792faaa67657806e9eae",
  apply_personal_plan_product_search_disposition_reversal_v1: "f664f22e3d3c2f887c7913a62aaf1fef",
  apply_personal_plan_product_search_dispositions_v1: "0b78424a5727759043cf206348f73111",
  apply_personal_plan_stage5_protocol_batch_v1: "092b5257128e56601fa528db6c5bb9c9",
  apply_personal_plan_stage5_v2_artifact_v1: "2b35c8567575da2a43511ca91b04c1f7",
  apply_scan_expansion_batch_v1: "153d93c13dd0e277a22ab7bf1fa3c13b",
  apply_scanner_existing_identifier_backfill_v1: "cafa85453ae4e42b464252261e776662",
}

/**
 * Production's scan-expansion executor was installed from a copy of
 * 20260902160000 with its comment-only lines stripped; every code line is
 * identical. Its pin is therefore compared with those lines removed.
 */
const COMMENT_STRIPPED_IN_PRODUCTION = new Set(["apply_scan_expansion_batch_v1"])

/** Executors outside this migration's scope, with the reason. */
const ALREADY_HARDENED = new Set([
  // 20260914170000 — the reference implementation of both fixes.
  "apply_personal_plan_stage5_v2_pointer_delta_v1",
])

const DOLLAR_TAG = /\bAS\s+(\$[A-Za-z0-9_]*\$)/

type HardenCall = {
  signature: string
  name: string
  edits: Array<[string, string]>
  anchor: string
}

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort()
}

function readMigration(file: string): string {
  return readFileSync(new URL(file, MIGRATIONS_DIR), "utf8")
}

function parseHardenCalls(sql: string): HardenCall[] {
  const calls = sql.matchAll(
    /SELECT pg_temp\.harden_catalog_apply_executor\(\n {2}'([^']+)',\n {2}ARRAY\[([\s\S]*?)\](?:::text\[\])?,\n {2}\$a\$([\s\S]*?)\$a\$\n\);/g,
  )
  return [...calls].map(([, signature, array, anchor]) => {
    const olds = [...array!.matchAll(/\$o\$([\s\S]*?)\$o\$/g)].map((match) => match[1]!)
    const news = [...array!.matchAll(/\$n\$([\s\S]*?)\$n\$/g)].map((match) => match[1]!)
    assert.equal(olds.length, news.length, `${signature}: unpaired edit`)
    return {
      signature: signature!,
      name: signature!.slice("public.".length, signature!.indexOf("(")),
      edits: olds.map((old, index) => [old, news[index]!] as [string, string]),
      anchor: anchor!,
    }
  })
}

/** Every CREATE of, and every in-place patch block for, the named executors, in migration order. */
function installationStatements(names: string[], beforeFile: string): string[] {
  const statements: Array<{ file: string; at: number; sql: string }> = []
  for (const file of migrationFiles().filter((candidate) => candidate < beforeFile)) {
    const sql = readMigration(file)
    for (const name of names) {
      const create = new RegExp(`CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\s*\\(`, "g")
      for (const match of sql.matchAll(create)) {
        const tag = sql.slice(match.index).match(DOLLAR_TAG)!
        const bodyStart = match.index + tag.index! + tag[0].length
        const end = sql.indexOf(tag[1]!, bodyStart) + tag[1]!.length
        statements.push({ file, at: match.index, sql: `${sql.slice(match.index, end)};` })
      }
    }
    for (const match of sql.matchAll(/DO\s+(\$[A-Za-z0-9_]*\$)([\s\S]*?)\1\s*;/g)) {
      const body = match[2]!
      if (
        body.includes("pg_get_functiondef") &&
        names.some((name) => body.includes(`public.${name}(`))
      ) {
        statements.push({ file, at: match.index, sql: match[0] })
      }
    }
  }
  return statements
    .sort((left, right) => left.file.localeCompare(right.file) || left.at - right.at)
    .map((statement) => statement.sql)
}

/** Names of every apply_* executor whose latest repository body takes a reviewer argument. */
function reviewerGatedApplyExecutors(beforeFile: string): Set<string> {
  const latest = new Map<string, string>()
  for (const file of migrationFiles().filter((candidate) => candidate < beforeFile)) {
    const sql = readMigration(file)
    for (const match of sql.matchAll(/CREATE (?:OR REPLACE )?FUNCTION public\.(apply_\w+)\s*\(/g)) {
      const tag = sql.slice(match.index).match(DOLLAR_TAG)!
      latest.set(
        match[1]!,
        sql.slice(match.index, sql.indexOf(tag[1]!, match.index + tag.index! + tag[0].length)),
      )
    }
  }
  return new Set(
    [...latest]
      .filter(([, definition]) => definition.includes("p_reviewed_by"))
      .map(([name]) => name),
  )
}

function md5(value: string): string {
  return createHash("md5").update(value).digest("hex")
}

async function prosrc(pg: PGlite, name: string): Promise<string> {
  const result = await pg.query<{ prosrc: string }>(
    `SELECT prosrc FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace`,
    [name],
  )
  assert.equal(result.rows.length, 1, `${name} is installed exactly once`)
  return result.rows[0]!.prosrc
}

async function rebuiltDatabase(
  t: { after: (fn: () => Promise<void>) => void },
  calls: HardenCall[],
): Promise<PGlite> {
  const pg = new PGlite()
  t.after(async () => {
    await pg.close()
  })
  await pg.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA IF NOT EXISTS extensions;
    SET check_function_bodies = off;
  `)
  for (const statement of installationStatements(
    calls.map((call) => call.name),
    HARDENING_FILE,
  )) {
    await pg.exec(statement)
  }
  return pg
}

const hardeningSql = readMigration(HARDENING_FILE)
const hardenCalls = parseHardenCalls(hardeningSql)

test("the migration's inventory is every reviewer-gated apply executor not already hardened", () => {
  assert.equal(hardenCalls.length, 13)
  assert.equal(
    hardenCalls.length,
    (hardeningSql.match(/SELECT pg_temp\.harden_catalog_apply_executor\(/g) ?? []).length,
    "every harden call was parsed",
  )
  const hardened = new Set(hardenCalls.map((call) => call.name))
  assert.equal(hardened.size, hardenCalls.length, "no executor is patched twice")
  const expected = new Set(
    [...reviewerGatedApplyExecutors(HARDENING_FILE)].filter((name) => !ALREADY_HARDENED.has(name)),
  )
  assert.deepEqual([...hardened].sort(), [...expected].sort())
  assert.deepEqual([...hardened].sort(), Object.keys(PRODUCTION_PROSRC_MD5).sort())
})

test("the rebuilt pre-hardening definitions are exactly production's", async (t) => {
  const pg = await rebuiltDatabase(t, hardenCalls)
  for (const { name } of hardenCalls) {
    let body = await prosrc(pg, name)
    if (COMMENT_STRIPPED_IN_PRODUCTION.has(name)) {
      body = body
        .split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n")
    }
    assert.equal(md5(body), PRODUCTION_PROSRC_MD5[name], `${name} matches production`)
  }
})

test("the whole migration applies, and each body changes only by its listed edits", async (t) => {
  const pg = await rebuiltDatabase(t, hardenCalls)
  const before = new Map<string, string>()
  for (const { name } of hardenCalls) before.set(name, await prosrc(pg, name))
  await pg.query(
    `GRANT EXECUTE ON FUNCTION public.apply_catalog_enrichment_leave_in_calibration_v1(text,text,text) TO service_role`,
  )

  await pg.exec(hardeningSql)

  for (const call of hardenCalls) {
    const after = await prosrc(pg, call.name)
    // Undo the listed edits; what remains must be the original body byte for byte.
    // Replacer functions: the guard text contains `$'`, a special pattern in string replacements.
    let reverted = after.replace(`${SHARED_LOCK_BLOCK}${call.anchor}`, () => call.anchor)
    for (const [oldText, newText] of call.edits) {
      assert.equal(after.split(newText).length, 2, `${call.name}: edit text is unique`)
      reverted = reverted.replace(newText, () => oldText)
    }
    assert.equal(reverted, before.get(call.name), `${call.name} has no unlisted change`)
  }
  const privilege = await pg.query<{ service: boolean }>(
    `SELECT has_function_privilege('service_role', $1, 'EXECUTE') AS service`,
    ["public.apply_catalog_enrichment_leave_in_calibration_v1(text,text,text)"],
  )
  assert.equal(privilege.rows[0]!.service, true, "CREATE OR REPLACE keeps the existing grant")
})

test("every patched executor takes the shared lock first and has no NULL-unsafe argument guard", async (t) => {
  const pg = await rebuiltDatabase(t, hardenCalls)
  await pg.exec(hardeningSql)

  for (const { name } of hardenCalls) {
    const body = await prosrc(pg, name)
    const shared = body.indexOf(SHARED_LOCK)
    assert.ok(shared > 0, `${name} takes the shared lock`)
    assert.equal(body.lastIndexOf(SHARED_LOCK), shared, `${name} takes it once`)
    const prefix = body.slice(0, shared)
    for (const pattern of [
      /FOR UPDATE/,
      /\bUPDATE public\./,
      /\bINSERT INTO public\./,
      /\bDELETE FROM public\./,
    ]) {
      assert.doesNotMatch(prefix, pattern, `${name}: ${pattern.source} precedes the shared lock`)
    }
    assert.equal(
      prefix.match(/pg_advisory_xact_lock\(/g)?.length,
      1,
      `${name}: the shared lock's own PERFORM is the only advisory lock before it`,
    )
    assert.ok(
      body.indexOf("pg_advisory_xact_lock(", shared) > shared,
      `${name} still takes its own advisory lock after the shared one`,
    )

    assert.doesNotMatch(body, /p_reviewed_by <>/, `${name} reviewer guard`)
    // Local variables only: comparisons against stored ledger columns (`v_existing.x`) are out of scope.
    assert.doesNotMatch(
      body,
      /(?<![.\w])\w+_fingerprint <> p_expected_\w+/,
      `${name} fingerprint match`,
    )
    assert.doesNotMatch(body, /(?<![.\w])\w+_fingerprint <> v_approved_\w+/, `${name} approved pin`)
    for (const match of body.matchAll(/\b(p_\w+) !~/g)) {
      const preceding = body.slice(Math.max(0, match.index - 80), match.index)
      assert.match(
        preceding,
        new RegExp(`${match[1]} IS NULL\\s+OR\\s*$`),
        `${name}: ${match[1]} regex guard has an explicit NULL check`,
      )
    }
  }
})

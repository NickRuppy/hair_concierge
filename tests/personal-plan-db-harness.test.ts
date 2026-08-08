import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import test from "node:test"

const helper = join(process.cwd(), "scripts/ci/prepare-personal-plan-db-transition.mjs")
const sourceMigrationHead = "20260803122000"
const requiredMigrations = [
  "20260808062602_personal_plan_stage1_3_foundation.sql",
  "20260808062603_personal_plan_routine_backend.sql",
  "20260808062620_personal_plan_product_intake_user_products.sql",
  "20260808062747_personal_plan_application_guidance.sql",
  "20260808065528_personal_plan_category_readiness.sql",
  "20260808070000_personal_plan_routine_successor_lifecycle.sql",
  "20260808071000_personal_plan_routine_source_reconciliation.sql",
]

test("database harness isolates its project and ports from a developer Supabase stack", () => {
  const harness = readFileSync(join(process.cwd(), "scripts/test-personal-plan-db.sh"), "utf8")
  assert.match(harness, /hair_conscierge_personal_plan_contract/)
  assert.match(harness, /port = 55321/)
  assert.match(harness, /port = 55322/)
  assert.doesNotMatch(harness, /repository_supabase/)
})

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

function makeFixture({
  expectedSha,
  extraMigrations = [],
}: {
  expectedSha: string
  extraMigrations?: string[]
}) {
  const root = mkdtempSync(join(tmpdir(), "personal-plan-db-harness-test-"))
  const migrationsDir = join(root, "migrations")
  const outputDir = join(root, "output")
  mkdirSync(migrationsDir)
  mkdirSync(outputDir)
  const baselineFile = join(root, "baseline.sql")
  const metadataFile = join(root, "metadata.json")
  const referenceSeedFile = join(root, "reference-seed.sql")
  writeFileSync(baselineFile, "select 'production baseline';\n")
  writeFileSync(referenceSeedFile, "select 'reference seed';\n")
  writeFileSync(
    metadataFile,
    JSON.stringify({
      sourceProjectId: "project-test",
      capturedAt: "2026-08-08",
      sourceMigrationHead,
      schemaFile: "baseline.sql",
      sha256: expectedSha,
      contentIntent: "schema-only; no production rows or customer data",
    }),
  )
  for (const migration of [...requiredMigrations, ...extraMigrations]) {
    writeFileSync(join(migrationsDir, migration), `select '${migration}';\n`)
  }
  return { baselineFile, metadataFile, migrationsDir, outputDir, referenceSeedFile }
}

function runHelper(fixture: ReturnType<typeof makeFixture>) {
  return spawnSync(
    process.execPath,
    [
      helper,
      "--metadata",
      fixture.metadataFile,
      "--baseline",
      fixture.baselineFile,
      "--migrations",
      fixture.migrationsDir,
      "--output",
      fixture.outputDir,
      "--reference-seed",
      fixture.referenceSeedFile,
    ],
    { encoding: "utf8" },
  )
}

test("database transition preparation fails closed before copying on a baseline hash mismatch", () => {
  const fixture = makeFixture({ expectedSha: "0".repeat(64) })
  const result = runHelper(fixture)

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /Baseline SHA-256 mismatch/)
  assert.deepEqual(readdirSync(fixture.outputDir), [])
})

test("database transition preparation includes every future migration in numeric order", () => {
  const baseline = "select 'production baseline';\n"
  const fixture = makeFixture({
    expectedSha: sha256(baseline),
    extraMigrations: ["20260809000000_future_contract.sql"],
  })
  const result = runHelper(fixture)

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(readdirSync(fixture.outputDir).sort(), [
    "20260803122000_production_public_schema.sql",
    "20260803122001_personal_plan_reference_seed.sql",
    ...requiredMigrations,
    "20260809000000_future_contract.sql",
  ])
})

test("database transition preparation rejects duplicate and malformed migration versions", () => {
  const baseline = "select 'production baseline';\n"
  const duplicateFixture = makeFixture({
    expectedSha: sha256(baseline),
    extraMigrations: ["20260808062620_duplicate.sql"],
  })
  const duplicateResult = runHelper(duplicateFixture)
  assert.notEqual(duplicateResult.status, 0)
  assert.match(duplicateResult.stderr, /Duplicate migration version 20260808062620/)

  const malformedFixture = makeFixture({ expectedSha: sha256(baseline) })
  writeFileSync(join(malformedFixture.migrationsDir, "not-a-version.sql"), "select 1;\n")
  const malformedResult = runHelper(malformedFixture)
  assert.notEqual(malformedResult.status, 0)
  assert.match(malformedResult.stderr, /Malformed migration filename not-a-version\.sql/)

  const missingFixture = makeFixture({ expectedSha: sha256(baseline) })
  const missingMigration = requiredMigrations[2]!
  const missingMigrationPath = join(missingFixture.migrationsDir, missingMigration)
  const renamedMigrationPath = join(
    missingFixture.migrationsDir,
    "20260808062620_not_the_required_migration.sql",
  )
  renameSync(missingMigrationPath, `${missingMigrationPath}.absent`)
  writeFileSync(renamedMigrationPath, "select 'wrong migration';\n")
  const missingRequiredResult = runHelper(missingFixture)
  assert.notEqual(missingRequiredResult.status, 0)
  assert.match(
    missingRequiredResult.stderr,
    new RegExp(`Missing required Personal Plan migration ${missingMigration}`),
  )
})

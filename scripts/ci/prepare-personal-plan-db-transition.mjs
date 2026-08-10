#!/usr/bin/env node

import { createHash } from "node:crypto"
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs"
import { basename, join } from "node:path"

const requiredPersonalPlanMigrations = [
  "20260808062602_personal_plan_stage1_3_foundation.sql",
  "20260808062603_personal_plan_routine_backend.sql",
  "20260808062620_personal_plan_product_intake_user_products.sql",
  "20260808062747_personal_plan_application_guidance.sql",
  "20260808065528_personal_plan_category_readiness.sql",
  "20260808070000_personal_plan_routine_successor_lifecycle.sql",
  "20260808071000_personal_plan_routine_source_reconciliation.sql",
]

function fail(message) {
  throw new Error(message)
}

function parseArguments(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith("--") || !value) fail(`Invalid argument near ${flag ?? "end"}`)
    if (values.has(flag)) fail(`Duplicate argument ${flag}`)
    values.set(flag, value)
  }
  const required = ["--metadata", "--baseline", "--migrations", "--output", "--reference-seed"]
  for (const flag of required) {
    if (!values.has(flag)) fail(`Missing required argument ${flag}`)
  }
  return {
    metadata: values.get("--metadata"),
    baseline: values.get("--baseline"),
    migrations: values.get("--migrations"),
    output: values.get("--output"),
    referenceSeed: values.get("--reference-seed"),
  }
}

function readMetadata(metadataFile) {
  let metadata
  try {
    metadata = JSON.parse(readFileSync(metadataFile, "utf8"))
  } catch (error) {
    fail(`Invalid baseline metadata: ${error instanceof Error ? error.message : String(error)}`)
  }
  const requiredStrings = [
    "sourceProjectId",
    "capturedAt",
    "sourceMigrationHead",
    "schemaFile",
    "sha256",
    "contentIntent",
  ]
  for (const field of requiredStrings) {
    if (typeof metadata[field] !== "string" || metadata[field].length === 0) {
      fail(`Invalid baseline metadata field ${field}`)
    }
  }
  if (!/^\d{14}$/.test(metadata.sourceMigrationHead)) {
    fail(`Invalid source migration head ${metadata.sourceMigrationHead}`)
  }
  if (!/^[a-f0-9]{64}$/.test(metadata.sha256)) fail("Invalid baseline SHA-256 metadata")
  return metadata
}

function verifyBaseline(metadata, baselineFile) {
  if (basename(baselineFile) !== metadata.schemaFile) {
    fail(`Baseline filename ${basename(baselineFile)} does not match metadata ${metadata.schemaFile}`)
  }
  const actualSha = createHash("sha256").update(readFileSync(baselineFile)).digest("hex")
  if (actualSha !== metadata.sha256) {
    fail(`Baseline SHA-256 mismatch: expected ${metadata.sha256}, received ${actualSha}`)
  }
}

function discoverMigrations(migrationsDirectory, sourceMigrationHead) {
  const migrations = []
  const versions = new Map()
  for (const filename of readdirSync(migrationsDirectory).filter((name) => name.endsWith(".sql"))) {
    const match = /^(\d+)_([a-zA-Z0-9][a-zA-Z0-9_-]*)\.sql$/.exec(filename)
    if (!match) fail(`Malformed migration filename ${filename}`)
    const versionText = match[1]
    const normalizedVersion = BigInt(versionText).toString()
    if (versions.has(normalizedVersion)) {
      fail(`Duplicate migration version ${versionText}: ${versions.get(normalizedVersion)} and ${filename}`)
    }
    versions.set(normalizedVersion, filename)
    migrations.push({ filename, version: BigInt(versionText) })
  }

  const baselineVersion = BigInt(sourceMigrationHead)
  const futureMigrations = migrations
    .filter(({ version }) => version > baselineVersion)
    .sort((left, right) =>
      left.version < right.version ? -1 : left.version > right.version ? 1 : 0,
    )

  let previousIndex = -1
  for (const requiredFilename of requiredPersonalPlanMigrations) {
    const currentIndex = futureMigrations.findIndex(({ filename }) => filename === requiredFilename)
    if (currentIndex === -1) fail(`Missing required Personal Plan migration ${requiredFilename}`)
    if (currentIndex <= previousIndex) {
      fail(`Required Personal Plan migrations are out of order at ${requiredFilename}`)
    }
    previousIndex = currentIndex
  }
  return { futureMigrations, versions }
}

function prepareTransition({ metadata, baseline, migrations, output, referenceSeed }) {
  for (const file of [metadata, baseline, referenceSeed]) {
    if (!existsSync(file) || !statSync(file).isFile()) fail(`Missing required file ${file}`)
  }
  if (!existsSync(migrations) || !statSync(migrations).isDirectory()) {
    fail(`Missing migrations directory ${migrations}`)
  }
  if (!existsSync(output) || !statSync(output).isDirectory()) {
    fail(`Missing output directory ${output}`)
  }
  if (readdirSync(output).length > 0) fail(`Output directory must be empty: ${output}`)

  const baselineMetadata = readMetadata(metadata)
  verifyBaseline(baselineMetadata, baseline)
  const { futureMigrations, versions } = discoverMigrations(
    migrations,
    baselineMetadata.sourceMigrationHead,
  )
  const seedVersion = (BigInt(baselineMetadata.sourceMigrationHead) + 1n)
    .toString()
    .padStart(baselineMetadata.sourceMigrationHead.length, "0")
  if (versions.has(BigInt(seedVersion).toString())) {
    fail(`Reference seed version ${seedVersion} collides with repository migration ${versions.get(BigInt(seedVersion).toString())}`)
  }

  const baselineTarget = `${baselineMetadata.sourceMigrationHead}_production_public_schema.sql`
  const seedTarget = `${seedVersion}_personal_plan_reference_seed.sql`
  copyFileSync(baseline, join(output, baselineTarget))
  copyFileSync(referenceSeed, join(output, seedTarget))
  for (const { filename } of futureMigrations) {
    copyFileSync(join(migrations, filename), join(output, filename))
  }

  process.stdout.write(`${JSON.stringify({
    sourceMigrationHead: baselineMetadata.sourceMigrationHead,
    baselineSha256: baselineMetadata.sha256,
    copiedMigrations: futureMigrations.map(({ filename }) => filename),
  })}\n`)
}

try {
  prepareTransition(parseArguments(process.argv.slice(2)))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}

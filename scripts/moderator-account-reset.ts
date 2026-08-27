#!/usr/bin/env tsx

import { readFile } from "node:fs/promises"
import {
  assertPrivateInputPath,
  buildRedactedResetReport,
  prepareResetSqlArtifact,
} from "./lib/moderator-account-reset-execution"
import { buildModeratorResetPlan } from "./lib/moderator-account-reset-plan"
import { fingerprintManifest } from "./lib/moderator-account-reset-types"

type CliArgs = {
  command: "dry-run" | "fingerprint" | "prepare-sql" | "apply"
  manifestPath: string | null
  outputPath: string | null
  maintenanceJournalPath: string | null
  showSql: boolean
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.manifestPath) {
    throw new Error(
      "Usage: tsx scripts/moderator-account-reset.ts <dry-run|fingerprint|prepare-sql|apply> --manifest <path> [--output <private-path>] [--maintenance-journal <private-path>] [--show-sql]",
    )
  }
  const raw = await readFile(args.manifestPath, "utf8")
  if (args.command === "fingerprint") {
    console.log(fingerprintManifest(JSON.parse(raw) as unknown))
    return
  }

  if (args.command === "prepare-sql") {
    if (!args.outputPath) {
      throw new Error("prepare-sql requires --output <private-path-outside-repository>")
    }
    const maintenanceJournalBytes = args.maintenanceJournalPath
      ? await readFile(await assertPrivateInputPath(args.maintenanceJournalPath), "utf8")
      : undefined
    const artifact = await prepareResetSqlArtifact({
      manifestBytes: raw,
      outputPath: args.outputPath,
      maintenanceJournalBytes,
    })
    console.log(
      JSON.stringify(
        {
          prepared: true,
          applied: false,
          sqlPath: artifact.sqlPath,
          receiptPath: artifact.receiptPath,
          receipt: artifact.receipt,
          nextStep:
            "Review this exact SQL and execute it only through the reviewed Supabase MCP transport.",
        },
        null,
        2,
      ),
    )
    return
  }

  const plan = buildModeratorResetPlan(JSON.parse(raw) as unknown)
  console.log(JSON.stringify(buildRedactedResetReport(plan), null, 2))

  if (args.showSql && plan.sql) {
    console.log("\n--- guarded-sql ---")
    console.log(plan.sql)
  }

  if (args.command === "apply") {
    throw new Error(
      "apply is intentionally disabled: review the prepared SQL and use the approved Supabase MCP transport; this command never executes production SQL",
    )
  }

  if (plan.blockers.length > 0) {
    process.exitCode = 2
  }
}

function parseArgs(argv: string[]): CliArgs {
  const [command] = argv
  if (
    command !== "dry-run" &&
    command !== "fingerprint" &&
    command !== "prepare-sql" &&
    command !== "apply"
  ) {
    throw new Error("First argument must be dry-run, fingerprint, prepare-sql, or apply")
  }
  let manifestPath: string | null = null
  let outputPath: string | null = null
  let maintenanceJournalPath: string | null = null
  let showSql = false
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--manifest") {
      manifestPath = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (arg === "--output") {
      outputPath = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (arg === "--maintenance-journal") {
      maintenanceJournalPath = argv[index + 1] ?? null
      index += 1
      continue
    }
    if (arg === "--show-sql") {
      showSql = true
      continue
    }
    throw new Error(`Unknown argument ${arg}`)
  }
  return { command, manifestPath, outputPath, maintenanceJournalPath, showSql }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

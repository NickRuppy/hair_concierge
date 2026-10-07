import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { promisify } from "node:util"

import {
  LEAVE_IN_CALIBRATION_BATCH_ID,
  applyLeaveInCalibration,
  buildLeaveInCalibrationPackage,
  classifyLeaveInCalibrationRun,
  parseLeaveInCalibrationApplyArgs,
  preflightLeaveInCalibration,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration"
import { printJson } from "../cli"
import {
  leaveInCalibrationReadAdapter,
  leaveInCalibrationWriteAdapter,
} from "./leave-in-research-calibration-client"

/**
 * Guarded apply. Without `--apply` this is a dry run that writes nothing; with
 * `--apply` every other guard flag must be present and exact, the preflight must
 * be green, the built package must match both the reviewed fingerprints and the
 * migration-pinned approved fingerprint, and the worktree must be the exact
 * clean reviewed head. Same shape as `heat-apply.ts`.
 */

const DEFAULT_MANIFEST = "plans/leave-in-apply/leave-in-research-enrichment-manifest.json"

async function gitState() {
  const [head, status] = await Promise.all([
    promisify(execFile)("git", ["rev-parse", "HEAD"]),
    promisify(execFile)("git", ["status", "--porcelain", "--untracked-files=all"]),
  ])
  return { head: head.stdout.trim(), clean: status.stdout.trim().length === 0 }
}

function manifestPath(argv: readonly string[]) {
  const index = argv.indexOf("--file")
  return index >= 0 ? (argv[index + 1] ?? DEFAULT_MANIFEST) : DEFAULT_MANIFEST
}

async function main() {
  const argv = process.argv.slice(2)
  const args = parseLeaveInCalibrationApplyArgs(argv)
  const batch = JSON.parse(await readFile(resolve(manifestPath(argv)), "utf8"))
  const built = buildLeaveInCalibrationPackage(batch)
  const read = leaveInCalibrationReadAdapter()
  const preflight = await preflightLeaveInCalibration({ read, batch })
  // Read the ledger before deciding anything: an apply that committed but whose
  // response was lost leaves stale fingerprints, and without this the retry would
  // refuse instead of reaching the executor's replay verification.
  const run = classifyLeaveInCalibrationRun({
    built,
    preflight,
    ledger: await read.appliedLedger(LEAVE_IN_CALIBRATION_BATCH_ID),
  })

  if (!args.apply) {
    printJson({
      mode: "dry-run",
      writes: false,
      run,
      batch_fingerprint: built.fingerprint,
      cohort_index_fingerprint: built.cohort_index_fingerprint,
      preflight,
    })
    process.exitCode = run.mode === "blocked" ? 1 : 0
    return
  }

  const result = await applyLeaveInCalibration({
    args,
    preflight,
    built,
    run,
    gitState,
    write: leaveInCalibrationWriteAdapter(),
  })
  printJson({ mode: result.replay ? "replay-verified" : "applied", ...result })
}

void main()

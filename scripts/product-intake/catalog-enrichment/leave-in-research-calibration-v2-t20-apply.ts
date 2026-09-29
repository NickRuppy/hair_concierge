import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { promisify } from "node:util"

import {
  LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
  LEAVE_IN_CALIBRATION_V2_T20_MANIFEST,
  applyLeaveInCalibrationV2T20,
  buildLeaveInCalibrationV2T20Package,
  classifyLeaveInCalibrationV2T20Run,
  parseLeaveInCalibrationV2T20ApplyArgs,
  preflightLeaveInCalibrationV2T20,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration-v2-t20"
import { printJson } from "../cli"
import { leaveInCalibrationReadAdapter } from "./leave-in-research-calibration-client"
import { leaveInCalibrationV2T20WriteAdapter } from "./leave-in-research-calibration-v2-t20-client"

/**
 * Guarded apply for batch v2-t20. Without `--apply` this is a dry run that writes
 * nothing. With `--apply` every other guard flag must be present and exact, the
 * run must classify as first apply or replay, the built package must match both
 * reviewed fingerprints and the migration-pinned ones, and the worktree must be
 * the exact clean reviewed head. Same shape as the v1 lane's apply script.
 */
async function gitState() {
  const [head, status] = await Promise.all([
    promisify(execFile)("git", ["rev-parse", "HEAD"]),
    promisify(execFile)("git", ["status", "--porcelain", "--untracked-files=all"]),
  ])
  return { head: head.stdout.trim(), clean: status.stdout.trim().length === 0 }
}

function manifestPath(argv: readonly string[]) {
  const index = argv.indexOf("--file")
  return index >= 0
    ? (argv[index + 1] ?? LEAVE_IN_CALIBRATION_V2_T20_MANIFEST)
    : LEAVE_IN_CALIBRATION_V2_T20_MANIFEST
}

async function main() {
  const argv = process.argv.slice(2)
  const args = parseLeaveInCalibrationV2T20ApplyArgs(argv)
  const batch = JSON.parse(await readFile(resolve(manifestPath(argv)), "utf8"))
  const built = buildLeaveInCalibrationV2T20Package(batch)
  const read = leaveInCalibrationReadAdapter()
  const preflight = await preflightLeaveInCalibrationV2T20({ read, batch })
  const run = classifyLeaveInCalibrationV2T20Run({
    built,
    preflight,
    ledger: await read.appliedLedger(LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID),
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

  const result = await applyLeaveInCalibrationV2T20({
    args,
    preflight,
    built,
    run,
    gitState,
    write: leaveInCalibrationV2T20WriteAdapter(),
  })
  printJson({ mode: result.replay ? "replay-verified" : "applied", ...result })
}

void main()

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { preflightLeaveInCalibration } from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration"
import { parseArgs, flag, printJson } from "../cli"
import { leaveInCalibrationReadAdapter } from "./leave-in-research-calibration-client"

/**
 * Read-only preflight against production. Only the read half of the client is
 * constructed, so no write, upload or RPC path is reachable from here — the same
 * posture as the Heat and Scalp preflights.
 */

const DEFAULT_MANIFEST = "plans/leave-in-apply/leave-in-research-enrichment-manifest.json"

async function main() {
  const args = parseArgs()
  const path = flag(args, "file") ?? DEFAULT_MANIFEST
  const batch = JSON.parse(await readFile(resolve(path), "utf8"))
  const report = await preflightLeaveInCalibration({
    read: leaveInCalibrationReadAdapter(),
    batch,
  })
  printJson(report)
  process.exitCode = report.ok ? 0 : 1
}

void main()

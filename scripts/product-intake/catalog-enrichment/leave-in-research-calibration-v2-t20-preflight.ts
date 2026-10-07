import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  LEAVE_IN_CALIBRATION_V2_T20_MANIFEST,
  preflightLeaveInCalibrationV2T20,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration-v2-t20"
import { parseArgs, flag, printJson } from "../cli"
import { leaveInCalibrationReadAdapter } from "./leave-in-research-calibration-client"

/**
 * Read-only preflight against production for batch v2-t20. Only the read half of
 * the client is constructed, so no write or RPC path is reachable from here.
 */
async function main() {
  const args = parseArgs()
  const path = flag(args, "file") ?? LEAVE_IN_CALIBRATION_V2_T20_MANIFEST
  const batch = JSON.parse(await readFile(resolve(path), "utf8"))
  const report = await preflightLeaveInCalibrationV2T20({
    read: leaveInCalibrationReadAdapter(),
    batch,
  })
  printJson(report)
  process.exitCode = report.ok ? 0 : 1
}

void main()

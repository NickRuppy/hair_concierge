import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  LEAVE_IN_CALIBRATION_V2_T20_MANIFEST,
  buildLeaveInCalibrationV2T20Package,
  verifyLeaveInCalibrationV2T20,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration-v2-t20"
import { parseArgs, flag, printJson } from "../cli"
import { leaveInCalibrationReadAdapter } from "./leave-in-research-calibration-client"

/**
 * Read-only post-apply verification: every live spec/fit column, the eligibility
 * set and `suitable_thicknesses` must equal the full v1.1 projection.
 */
async function main() {
  const args = parseArgs()
  const path = flag(args, "file") ?? LEAVE_IN_CALIBRATION_V2_T20_MANIFEST
  const batch = JSON.parse(await readFile(resolve(path), "utf8"))
  const built = buildLeaveInCalibrationV2T20Package(batch)
  const report = await verifyLeaveInCalibrationV2T20({
    read: leaveInCalibrationReadAdapter(),
    built,
  })
  printJson({ ...report, batch_fingerprint: built.fingerprint })
  process.exitCode = report.ok ? 0 : 1
}

void main()

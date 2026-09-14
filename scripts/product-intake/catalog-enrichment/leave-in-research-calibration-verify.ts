import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  buildLeaveInCalibrationPackage,
  verifyLeaveInCalibration,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration"
import { parseArgs, flag, printJson } from "../cli"
import { leaveInCalibrationReadAdapter } from "./leave-in-research-calibration-client"

/**
 * Read-only post-apply verification: every live row must equal what the reviewed
 * package intended — the projected spec/fit values, the projection's exact
 * eligibility set, the projected `suitable_thicknesses`, and no surviving row
 * the batch planned to delete.
 */

const DEFAULT_MANIFEST = "plans/leave-in-apply/leave-in-research-enrichment-manifest.json"

async function main() {
  const args = parseArgs()
  const path = flag(args, "file") ?? DEFAULT_MANIFEST
  const batch = JSON.parse(await readFile(resolve(path), "utf8"))
  const built = buildLeaveInCalibrationPackage(batch)
  const report = await verifyLeaveInCalibration({
    read: leaveInCalibrationReadAdapter(),
    built,
  })
  printJson({ ...report, batch_fingerprint: built.fingerprint })
  process.exitCode = report.ok ? 0 : 1
}

void main()

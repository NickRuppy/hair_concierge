import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import { CATALOG_ENRICHMENT_SCHEMA_VERSION } from "@/lib/product-intake/catalog-enrichment"
import {
  LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID,
  LEAVE_IN_CALIBRATION_V2_T20_MANIFEST,
  buildLeaveInCalibrationV2T20Package,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration-v2-t20"
import { parseArgs, flag, printJson } from "../cli"

/**
 * Offline validation of the v2-t20 manifest batch. No network, no writes. It
 * builds the executor package, which runs the shared contract validation per
 * manifest plus the batch's own invariants (one spec upsert only; only
 * care_direction / care_benefits / functional_benefits may differ from the
 * pinned state; fit, eligibility and thicknesses identical).
 */
async function main() {
  const args = parseArgs()
  const path = flag(args, "file") ?? LEAVE_IN_CALIBRATION_V2_T20_MANIFEST
  const batch = JSON.parse(await readFile(resolve(path), "utf8")) as Record<string, unknown>

  const envelopeViolations: string[] = []
  if (batch.schema_version !== CATALOG_ENRICHMENT_SCHEMA_VERSION)
    envelopeViolations.push("schema_version must be the shared catalog-enrichment schema")
  if (batch.batch_id !== LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID)
    envelopeViolations.push(`batch_id must be ${LEAVE_IN_CALIBRATION_V2_T20_BATCH_ID}`)
  if (batch.lifecycle_classification !== "existing_product_enrichment")
    envelopeViolations.push("lifecycle_classification must be existing_product_enrichment")

  let built: ReturnType<typeof buildLeaveInCalibrationV2T20Package> | null = null
  let packageError: string | null = null
  try {
    built = buildLeaveInCalibrationV2T20Package(batch)
  } catch (error) {
    packageError = error instanceof Error ? error.message : String(error)
  }

  const report = {
    mode: "validate",
    writes: false,
    file: path,
    ok: envelopeViolations.length === 0 && packageError === null,
    envelopeViolations,
    packageError,
    batch_fingerprint: built?.fingerprint ?? null,
    cohort_index_fingerprint: built?.cohort_index_fingerprint ?? null,
    products:
      built?.package.products.map((product) => ({
        product_key: product.product_key,
        changed_spec_columns: product.changed_spec_columns,
        eligibility_rows_unchanged: product.projected_eligibility.length,
      })) ?? [],
  }
  printJson(report)
  process.exitCode = report.ok ? 0 : 1
}

void main()

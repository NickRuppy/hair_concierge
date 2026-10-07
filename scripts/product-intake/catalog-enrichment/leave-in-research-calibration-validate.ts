import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  CATALOG_ENRICHMENT_SCHEMA_VERSION,
  orderCatalogEnrichmentOperations,
  validateCatalogEnrichmentManifest,
  type CatalogEnrichmentOperation,
} from "@/lib/product-intake/catalog-enrichment"
import {
  LEAVE_IN_CALIBRATION_BATCH_ID,
  LEAVE_IN_CALIBRATION_TARGETS,
} from "@/lib/product-intake/catalog-enrichment/leave-in-research-calibration"
import { parseArgs, flag, printJson } from "../cli"

/** Offline schema validation of the Leave-In calibration manifest batch. No network, no writes. */

const DEFAULT_MANIFEST = "plans/leave-in-apply/leave-in-research-enrichment-manifest.json"

async function main() {
  const args = parseArgs()
  const path = flag(args, "file") ?? DEFAULT_MANIFEST
  const batch = JSON.parse(await readFile(resolve(path), "utf8")) as Record<string, unknown>

  const envelopeViolations: string[] = []
  if (batch.schema_version !== CATALOG_ENRICHMENT_SCHEMA_VERSION)
    envelopeViolations.push("schema_version must be the shared catalog-enrichment schema")
  if (batch.batch_id !== LEAVE_IN_CALIBRATION_BATCH_ID)
    envelopeViolations.push(`batch_id must be ${LEAVE_IN_CALIBRATION_BATCH_ID}`)
  if (batch.lifecycle_classification !== "existing_product_enrichment")
    envelopeViolations.push("lifecycle_classification must be existing_product_enrichment")
  const manifests = Array.isArray(batch.products) ? batch.products : []
  if (manifests.length !== LEAVE_IN_CALIBRATION_TARGETS.length)
    envelopeViolations.push(
      `products must cover all ${LEAVE_IN_CALIBRATION_TARGETS.length} calibration targets`,
    )

  const products = LEAVE_IN_CALIBRATION_TARGETS.map((target) => {
    const manifest = manifests.find(
      (candidate) =>
        candidate &&
        typeof candidate === "object" &&
        (candidate as Record<string, unknown>).product_key === target.product_key,
    ) as Record<string, unknown> | undefined
    if (!manifest)
      return {
        product_key: target.product_key,
        slot: target.slot,
        status: "fail" as const,
        violations: ["manifest missing from batch"],
        operations: [],
      }
    const result = validateCatalogEnrichmentManifest(manifest)
    const operations = orderCatalogEnrichmentOperations(
      (manifest.planned_operations ?? []) as CatalogEnrichmentOperation[],
    )
    return {
      product_key: target.product_key,
      slot: target.slot,
      status: result.ok ? ("pass" as const) : ("fail" as const),
      violations: result.ok ? [] : result.errors,
      operations: operations.map((operation) => ({
        type: operation.type,
        table: operation.table,
        rows: "rows" in operation && Array.isArray(operation.rows) ? operation.rows.length : 0,
      })),
    }
  })

  const failed = products.filter((product) => product.status === "fail").length
  const report = {
    mode: "validate",
    writes: false,
    file: path,
    ok: envelopeViolations.length === 0 && failed === 0,
    envelopeViolations,
    products,
    summary: {
      totalProducts: products.length,
      productsPassed: products.length - failed,
      productsFailed: failed,
      totalDeleteRows: products.reduce(
        (total, product) =>
          total +
          product.operations
            .filter((operation) => operation.type === "delete")
            .reduce((rows, operation) => rows + operation.rows, 0),
        0,
      ),
    },
  }
  printJson(report)
  process.exitCode = report.ok ? 0 : 1
}

void main()

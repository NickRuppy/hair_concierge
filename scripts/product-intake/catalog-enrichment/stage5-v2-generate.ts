import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"

import { composeProductApplicationProtocolsV2 } from "../../../src/lib/routines/personal-plan/application/compiler-v2"
import { buildProductApplicationPointerV2 } from "../../../src/lib/product-intake/catalog-enrichment/stage5-v2-builder"
import { stage5V2SourceFingerprint } from "../../../src/lib/product-intake/catalog-enrichment/stage5-v2-application"
import type { ApplicationGuidanceProtocolV1 } from "../../../src/lib/routines/personal-plan/application/contracts"
import { SHARED_APPLICATION_TEMPLATES_V2 } from "../../../src/lib/routines/personal-plan/application/shared-templates-v2"

const root = process.cwd()
const sourceRoot = join(root, "data/catalog-enrichment/personal-plan-stage5-v1")
const outputPath = join(
  root,
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
)
const bundledCategories = new Set(["deep_cleansing_shampoo", "leave_in", "mask", "oil"])

type SourceRow = {
  product_id: string
  product_name: string
  role: string
  guidance_payload: ApplicationGuidanceProtocolV1
}

type ResearchFile = {
  products?: Array<
    SourceRow & {
      research_status: string
    }
  >
}

type BundleFile = {
  items?: Array<{
    product_id: string
    product_name: string
    protocols: Array<{ role: string; guidance_payload: ApplicationGuidanceProtocolV1 }>
  }>
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")
const stableJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

function sourceFiles() {
  const researchDir = join(sourceRoot, "protocol-research")
  const bundleDir = join(sourceRoot, "exact-bundles")
  return [
    ...readdirSync(researchDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => join(researchDir, name)),
    ...readdirSync(bundleDir)
      .filter((name) => name.endsWith(".json"))
      .map((name) => join(bundleDir, name)),
  ].sort()
}

function loadRows(files: readonly string[]): SourceRow[] {
  const rows: SourceRow[] = []
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as ResearchFile & BundleFile
    for (const product of parsed.products ?? []) {
      if (
        product.research_status === "verified" &&
        !bundledCategories.has(product.guidance_payload.scope.category)
      ) {
        rows.push(product)
      }
    }
    for (const item of parsed.items ?? []) {
      for (const protocol of item.protocols ?? []) {
        rows.push({
          product_id: item.product_id,
          product_name: item.product_name,
          role: protocol.role,
          guidance_payload: protocol.guidance_payload,
        })
      }
    }
  }
  return rows.sort(
    (left, right) =>
      left.product_id.localeCompare(right.product_id) || left.role.localeCompare(right.role),
  )
}

function protocolFingerprint(protocols: readonly ApplicationGuidanceProtocolV1[]) {
  return sha256(
    JSON.stringify(
      protocols.map((protocol) => ({
        applicationFamily: protocol.applicationFamily,
        steps: protocol.steps,
      })),
    ),
  )
}

function generate() {
  const files = sourceFiles()
  const rows = loadRows(files)
  const keys = rows.map((row) => `${row.product_id}:${row.role}`)
  if (new Set(keys).size !== keys.length) throw new Error("duplicate product/source-role key")
  const items = rows.map((row) => {
    const pointer = buildProductApplicationPointerV2({
      sourceRole: row.role,
      guidancePayload: row.guidance_payload,
    })
    const composed = composeProductApplicationProtocolsV2(pointer, SHARED_APPLICATION_TEMPLATES_V2)
    if (composed.status === "unresolved") {
      throw new Error(`${row.product_id}:${row.role}:${composed.reason}`)
    }
    const protocols = composed.protocols
    const templateKeys = protocols.map((protocol) =>
      protocol.guidanceKey.replace(`v2-composed-`, "").replace(`-${row.product_id}`, ""),
    )
    return {
      key: `${row.product_id}:${row.role}`,
      product_id: row.product_id,
      product_name: row.product_name,
      source_role: row.role,
      source_fingerprint: stage5V2SourceFingerprint(row.role, row.guidance_payload),
      template_keys: pointer.workflowId ? [] : templateKeys,
      exact_workflow_id: pointer.workflowId,
      before_visible_step_fingerprint: sha256(JSON.stringify(row.guidance_payload.steps)),
      after_visible_step_fingerprint: protocolFingerprint(protocols),
      guidance_payload_v2: pointer,
    }
  })
  const byCategory = Object.fromEntries(
    [...new Set(items.map((item) => item.guidance_payload_v2.scope.category))]
      .sort()
      .map((category) => [
        category,
        items.filter((item) => item.guidance_payload_v2.scope.category === category).length,
      ]),
  )
  const document = {
    schema_version: "personal-plan-stage5-application-pointer-backfill-v2",
    snapshot_date: "2026-08-12",
    source_kind: "reviewed_stage5_v1_artifacts",
    source_files: files.map((file) => ({
      path: relative(root, file),
      sha256: sha256(readFileSync(file, "utf8")),
    })),
    observed_counts: {
      rows: items.length,
      products: new Set(items.map((item) => item.product_id).values()).size,
      exact_workflows: items.filter((item) => item.exact_workflow_id !== null).length,
      family_templates: SHARED_APPLICATION_TEMPLATES_V2.length,
      composable_rows: items.filter((item) => item.guidance_payload_v2.runtimeBlockerCode === null)
        .length,
      blocked_rows: items.filter((item) => item.guidance_payload_v2.runtimeBlockerCode !== null)
        .length,
      by_category: byCategory,
    },
    family_templates: SHARED_APPLICATION_TEMPLATES_V2,
    items,
  }
  return stableJson(document)
}

const generated = generate()
if (process.argv.includes("--check")) {
  const current = readFileSync(outputPath, "utf8")
  if (current !== generated) throw new Error(`${relative(root, outputPath)} is stale`)
  const counts = JSON.parse(generated).observed_counts
  process.stdout.write(
    `application V2 audit passed: ${counts.rows} reviewed rows; ${counts.composable_rows} composable; ${counts.blocked_rows} explicit blocker\n`,
  )
} else {
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, generated)
  process.stdout.write(`wrote ${relative(root, outputPath)}\n`)
}

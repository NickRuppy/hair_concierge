import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"

import { z } from "zod"

import { composeProductApplicationProtocolsV2 } from "../../../src/lib/routines/personal-plan/application/compiler-v2"
import { parseOilAuthorityRepairManifest } from "../../../src/lib/catalog-authority/oil-repair"
import { catalogAuthorityRepairReviewFingerprint } from "../../../src/lib/catalog-authority/repair"
import { buildProductApplicationPointerV2 } from "../../../src/lib/product-intake/catalog-enrichment/stage5-v2-builder"
import { stage5V2SourceFingerprint } from "../../../src/lib/product-intake/catalog-enrichment/stage5-v2-application"
import { buildReviewedLeaveInUseCases } from "../../../src/lib/product-intake/catalog-enrichment/leave-in-use-case-manifest"
import { buildLeaveInUseCasePointerDelta } from "../../../src/lib/product-intake/catalog-enrichment/leave-in-use-case-delta"
import { buildStage5ProtocolAmendmentManifest } from "../../../src/lib/product-intake/catalog-enrichment/stage5-protocol-amendments"
import {
  applicationGuidanceProtocolSchema,
  type ApplicationGuidanceProtocolV1,
} from "../../../src/lib/routines/personal-plan/application/contracts"
import {
  productApplicationPointerV2Schema,
  type ProductApplicationPointerV2,
} from "../../../src/lib/routines/personal-plan/application/contracts-v2"
import { SHARED_APPLICATION_TEMPLATES_V2 } from "../../../src/lib/routines/personal-plan/application/shared-templates-v2"

const root = process.cwd()
const sourceRoot = join(root, "data/catalog-enrichment/personal-plan-stage5-v1")
const outputPath = join(
  root,
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-backfill.json",
)
const baselineOutputPath = join(
  root,
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-baseline-2026-08-12.json",
)
const leaveInManifestPath = join(
  root,
  "data/catalog-enrichment/personal-plan-stage5-v2/leave-in-use-cases-2026-08-14.json",
)
const protocolAmendmentRoot = join(
  root,
  "data/catalog-enrichment/personal-plan-stage5-v2/protocol-amendments",
)
const k18ReadinessPath = join(sourceRoot, "S5R-02-k18-molecular-repair-hair-mist-readiness.json")
const oilAuthorityPath = join(
  root,
  "data/catalog-enrichment/oil-authority-enrichment-v1/manifest.json",
)

const k18ReadinessProtocolSchema = z.object({
  schema_version: z.literal("k18-molecular-repair-hair-mist-readiness-v1"),
  review: z.object({
    state: z.literal("approved_by_nick"),
    reviewed_by: z.literal("nick"),
  }),
  item: z.object({
    expected_product: z.object({
      id: z.string().uuid(),
      name: z.string().min(1),
      category_key: z.literal("leave_in"),
    }),
    target: z.object({
      protocol: z.object({
        role: z.literal("post_wash_leave_in"),
        application_family: z.literal("post_wash_damp_conditioning"),
        guidance_payload: applicationGuidanceProtocolSchema,
        guidance_payload_v2: productApplicationPointerV2Schema,
      }),
    }),
  }),
})

type SourceRow = {
  product_id: string
  product_name: string
  role: string
  guidance_payload: ApplicationGuidanceProtocolV1
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex")
const stableJson = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`
const counted = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`

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

function protocolAmendmentFiles() {
  return readdirSync(protocolAmendmentRoot)
    .filter((name) => /^S5-[0-9]{2}-[a-z0-9-]+\.json$/.test(name))
    .map((name) => join(protocolAmendmentRoot, name))
    .sort()
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

function artifactItem(
  row: SourceRow,
  pointer = buildProductApplicationPointerV2({
    sourceRole: row.role,
    guidancePayload: row.guidance_payload,
  }),
) {
  const composed = composeProductApplicationProtocolsV2(pointer, SHARED_APPLICATION_TEMPLATES_V2)
  if (composed.status === "unresolved") {
    throw new Error(`${row.product_id}:${row.role}:${pointer.applicationFamily}:${composed.reason}`)
  }
  const protocols = composed.protocols
  const templateKeys = protocols.map((protocol) =>
    protocol.guidanceKey.replace(`v2-composed-`, "").replace(`-${row.product_id}`, ""),
  )
  return {
    key: `${row.product_id}:${row.role}:${pointer.applicationFamily}`,
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
}

function k18LiveProtocolSource(input: unknown) {
  const manifest = k18ReadinessProtocolSchema.parse(input)
  const product = manifest.item.expected_product
  const protocol = manifest.item.target.protocol
  const expectedPointer = buildProductApplicationPointerV2({
    sourceRole: protocol.role,
    guidancePayload: protocol.guidance_payload,
  })
  if (JSON.stringify(expectedPointer) !== JSON.stringify(protocol.guidance_payload_v2)) {
    throw new Error("k18_readiness_v2_pointer_mismatch")
  }
  if (
    protocol.guidance_payload.scope.kind !== "product" ||
    protocol.guidance_payload.scope.productId !== product.id ||
    protocol.guidance_payload.scope.category !== product.category_key ||
    protocol.guidance_payload_v2.scope.productId !== product.id ||
    protocol.guidance_payload_v2.scope.category !== product.category_key ||
    protocol.guidance_payload_v2.sourceRole !== protocol.role ||
    protocol.guidance_payload_v2.applicationFamily !== protocol.application_family
  ) {
    throw new Error("k18_readiness_protocol_scope_mismatch")
  }
  return {
    row: {
      product_id: product.id,
      product_name: product.name,
      role: protocol.role,
      guidance_payload: protocol.guidance_payload,
    },
    pointer: protocol.guidance_payload_v2,
  }
}

function oilAuthorityProtocolSources(input: unknown) {
  const manifest = parseOilAuthorityRepairManifest(input)
  if (
    manifest.review.state !== "approved" ||
    manifest.review.reviewedBy !== "nick" ||
    !manifest.review.reviewedAt ||
    manifest.review.reviewedContentFingerprint !== catalogAuthorityRepairReviewFingerprint(manifest)
  ) {
    throw new Error("oil_authority_protocol_source_not_approved")
  }
  return manifest.entries.flatMap((entry) =>
    entry.intendedAuthority.protocols.map((protocol) => ({
      product_id: entry.productId,
      product_name: entry.intendedAuthority.identity.name,
      role: protocol.role,
      guidance_payload: protocol.guidancePayload,
    })),
  )
}

function documentFor(
  items: ReturnType<typeof artifactItem>[],
  files: readonly string[],
  snapshotDate: string,
  sourceKind:
    | "reviewed_stage5_v1_artifacts"
    | "reviewed_stage5_v1_and_use_case_artifacts"
    | "reviewed_stage5_v1_use_case_and_amendment_artifacts",
) {
  const byCategory = Object.fromEntries(
    [...new Set(items.map((item) => item.guidance_payload_v2.scope.category))]
      .sort()
      .map((category) => [
        category,
        items.filter((item) => item.guidance_payload_v2.scope.category === category).length,
      ]),
  )
  return {
    schema_version: "personal-plan-stage5-application-pointer-backfill-v2",
    snapshot_date: snapshotDate,
    source_kind: sourceKind,
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
}

function generate() {
  const files = sourceFiles()
  const baselineText = readFileSync(baselineOutputPath, "utf8")
  const baseline = JSON.parse(baselineText) as ReturnType<typeof documentFor>
  const currentSourceFiles = files.map((file) => ({
    path: relative(root, file),
    sha256: sha256(readFileSync(file, "utf8")),
  }))
  if (JSON.stringify(baseline.source_files) !== JSON.stringify(currentSourceFiles)) {
    throw new Error("application_pointer_baseline_source_fingerprint_mismatch")
  }
  const reviewedLeaveIns = buildReviewedLeaveInUseCases(
    JSON.parse(readFileSync(leaveInManifestPath, "utf8")),
    baseline,
    sha256(baselineText),
  )
  const delta = buildLeaveInUseCasePointerDelta(reviewedLeaveIns, baseline)
  const amendmentFiles = protocolAmendmentFiles()
  const amendments = amendmentFiles.map((file) =>
    buildStage5ProtocolAmendmentManifest(JSON.parse(readFileSync(file, "utf8")), baselineText),
  )
  const k18 = k18LiveProtocolSource(JSON.parse(readFileSync(k18ReadinessPath, "utf8")))
  const oilAuthorityRows = oilAuthorityProtocolSources(
    JSON.parse(readFileSync(oilAuthorityPath, "utf8")),
  )
  const deleted = new Set(
    delta.deletes.map(
      (item) => `${item.product_id}:${item.source_role}:${item.application_family}`,
    ),
  )
  const preOilItems = [
    ...baseline.items.filter((item) => !deleted.has(item.key)),
    ...delta.inserts.map((item) =>
      artifactItem(
        {
          product_id: item.product_id,
          product_name: item.product_name,
          role: item.source_role,
          guidance_payload: item.guidance_payload,
        },
        item.guidance_payload_v2,
      ),
    ),
    ...amendments.flatMap((amendment) =>
      amendment.v2Inserts.map((item) =>
        artifactItem(
          {
            product_id: item.product_id,
            product_name: item.product_name,
            role: item.source_role,
            guidance_payload: item.guidance_payload,
          },
          item.guidance_payload_v2,
        ),
      ),
    ),
    artifactItem(k18.row, k18.pointer),
  ]
  const oilAuthorityItems = oilAuthorityRows.map((row) => artifactItem(row))
  const oilAuthorityKeys = new Set(oilAuthorityItems.map(({ key }) => key))
  const replacedOilRows = preOilItems.filter(({ key }) => oilAuthorityKeys.has(key)).length
  const items = [
    ...preOilItems.filter(({ key }) => !oilAuthorityKeys.has(key)),
    ...oilAuthorityItems,
  ].sort((left, right) => left.key.localeCompare(right.key))
  if (new Set(items.map((item) => item.key)).size !== items.length) {
    throw new Error("duplicate product/source-role/application-family key")
  }
  return {
    baseline: baselineText,
    deltaCounts: {
      inserts: delta.inserts.length,
      corrections: delta.deletes.length,
      amendments: amendments.reduce((count, amendment) => count + amendment.v2Inserts.length, 0),
      liveCarryForwards: 1,
      authorityRepairInserts: oilAuthorityItems.length - replacedOilRows,
      authorityRepairReplacements: replacedOilRows,
    },
    final: stableJson(
      documentFor(
        items,
        [...files, leaveInManifestPath, k18ReadinessPath, oilAuthorityPath, ...amendmentFiles],
        "2026-09-01",
        "reviewed_stage5_v1_use_case_and_amendment_artifacts",
      ),
    ),
  }
}

const generated = generate()
if (process.argv.includes("--check")) {
  const current = readFileSync(outputPath, "utf8")
  const currentBaseline = readFileSync(baselineOutputPath, "utf8")
  if (current !== generated.final) throw new Error(`${relative(root, outputPath)} is stale`)
  if (currentBaseline !== generated.baseline)
    throw new Error(`${relative(root, baselineOutputPath)} is stale`)
  const counts = JSON.parse(generated.final).observed_counts
  const artifact = JSON.parse(current)
  const leaveInManifest = JSON.parse(readFileSync(leaveInManifestPath, "utf8"))
  const reviewedLeaveIns = buildReviewedLeaveInUseCases(
    leaveInManifest,
    JSON.parse(generated.baseline),
    leaveInManifest.baseline.sha256,
  )
  const oilItems = artifact.items.filter(
    (item: { guidance_payload_v2: ProductApplicationPointerV2 }) =>
      item.guidance_payload_v2.scope.category === "oil",
  )
  const oilProductIds = new Set(oilItems.map((item: { product_id: string }) => item.product_id))
  const conventionalOilProductIds = new Set(
    oilItems
      .filter(
        (item: { guidance_payload_v2: ProductApplicationPointerV2 }) =>
          (item.guidance_payload_v2.role === "finish" ||
            item.guidance_payload_v2.role === "leave_in") &&
          item.guidance_payload_v2.facts.rinse === "leave_in" &&
          (item.guidance_payload_v2.facts.applicationArea === "hair_lengths_ends" ||
            item.guidance_payload_v2.facts.applicationArea === "hair_ends") &&
          item.guidance_payload_v2.workflowId === null &&
          item.guidance_payload_v2.requiredCompanionProductId === null &&
          item.guidance_payload_v2.runtimeBlockerCode === null,
      )
      .map((item: { product_id: string }) => item.product_id),
  )
  process.stdout.write(
    `application V2 audit passed: ${counts.rows} reviewed rows; ${counts.composable_rows} composable; ${counted(counts.blocked_rows, "explicit blocker")}; ${reviewedLeaveIns.reviewedProductCount} Leave-ins reviewed with universal damp/dry between-wash methods; ${conventionalOilProductIds.size}/${oilProductIds.size} Oils eligible for universal dry-first/damp-alternative between-wash methods; ${counted(oilProductIds.size - conventionalOilProductIds.size, "exact-only Oil exception")}; ${counted(generated.deltaCounts.inserts, "product-specific use-case insert")}, ${counted(generated.deltaCounts.corrections, "correction")}, ${counted(generated.deltaCounts.amendments, "post-baseline protocol amendment")}, ${counted(generated.deltaCounts.liveCarryForwards, "live protocol carry-forward")}, ${counted(generated.deltaCounts.authorityRepairInserts, "authority-repair insert")}, and ${counted(generated.deltaCounts.authorityRepairReplacements, "authority-repair replacement")} are included in the final artifact\n`,
  )
} else {
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(baselineOutputPath, generated.baseline)
  writeFileSync(outputPath, generated.final)
  process.stdout.write(
    `wrote ${relative(root, baselineOutputPath)} and ${relative(root, outputPath)}\n`,
  )
}

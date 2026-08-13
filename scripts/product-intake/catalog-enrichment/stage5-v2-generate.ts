import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"

import { composeProductApplicationProtocolsV2 } from "../../../src/lib/routines/personal-plan/application/compiler-v2"
import { stage5V2SourceFingerprint } from "../../../src/lib/product-intake/catalog-enrichment/stage5-v2-application"
import type { ApplicationGuidanceProtocolV1 } from "../../../src/lib/routines/personal-plan/application/contracts"
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

function applicationFamily(row: SourceRow) {
  if (
    row.guidance_payload.scope.category === "leave_in" &&
    row.guidance_payload.role === "leave_in" &&
    row.guidance_payload.applicationFamily === "either_state_protection"
  ) {
    return "post_wash_damp_conditioning" as const
  }
  return row.guidance_payload.applicationFamily
}

function applicationState(family: string, category: string) {
  if (
    ["standard_rinse_out_cleanse", "targeted_treatment_shampoo", "reset_cleanse"].includes(family)
  )
    return "wet_hair" as const
  if (["standard_rinse_out_conditioning", "post_shampoo_rinse_out_mask"].includes(family))
    return "wet_hair" as const
  if (
    [
      "post_wash_booster",
      "post_wash_damp_conditioning",
      "between_wash_damp_refresh",
      "pre_heat_damp",
    ].includes(family)
  )
    return "damp_hair" as const
  if (
    [
      "between_wash_dry_care",
      "dry_finish",
      "pre_heat_dry",
      "aerosol_spray",
      "foam",
      "liquid_to_dry",
    ].includes(family)
  )
    return "dry_hair" as const
  if (family === "either_state_protection") return "damp_or_dry_hair" as const
  if (
    [
      "pre_wash_lengths_treatment",
      "pre_shampoo_single_treatment",
      "pre_shampoo_booster_plus_treatment",
    ].includes(family)
  )
    return "pre_wash_dry_hair" as const
  if (family === "post_shampoo_timed_leave_in") return "damp_hair" as const
  if (family === "leave_on_scalp_care") return "clean_damp_or_dry_scalp" as const
  if (family === "rinse_off_scalp_care") return "clean_damp_scalp" as const
  throw new Error(`unsupported application state ${category}/${family}`)
}

function applicationArea(row: SourceRow): ProductApplicationPointerV2["facts"]["applicationArea"] {
  const area = row.guidance_payload.protocolFacts.applicationArea
  if (
    row.guidance_payload.scope.category === "shampoo" ||
    row.guidance_payload.scope.category === "deep_cleansing_shampoo"
  )
    return "scalp_roots"
  if (row.guidance_payload.scope.category === "scalp_care") return "scalp_roots"
  if (area === "ends") return "hair_ends"
  if (area === "all_hair" && row.guidance_payload.role === "heat_protection")
    return "root_to_tip_hair"
  return "hair_lengths_ends"
}

function contactTime(row: SourceRow): ProductApplicationPointerV2["facts"]["contactTime"] {
  const category = row.guidance_payload.scope.category
  if (
    category === "shampoo" &&
    row.guidance_payload.applicationFamily === "standard_rinse_out_cleanse"
  )
    return null
  if (category === "conditioner") {
    if (/Nivea Power Repair Conditioner/i.test(row.product_name))
      return { kind: "seconds", seconds: 60 }
    if (/Elvital Fiber Booster Conditioner/i.test(row.product_name))
      return { kind: "seconds", seconds: 180 }
    return null
  }
  const seconds = row.guidance_payload.protocolFacts.contactTimeSeconds
  if (seconds !== null) return { kind: "seconds", seconds }
  const waitCopy = row.guidance_payload.steps
    .filter((step) => step.action === "wait")
    .map((step) => step.copyTemplateDe)
    .join(" ")
  const rangeMinutes = waitCopy.match(/(\d+)\s*[–-]\s*(\d+)\s*Minuten/i)
  if (rangeMinutes) {
    return {
      kind: "range_seconds",
      minimumSeconds: Number(rangeMinutes[1]) * 60,
      maximumSeconds: Number(rangeMinutes[2]) * 60,
    }
  }
  const maximumMinutes = waitCopy.match(/bis zu\s*(\d+)\s*Minuten/i)
  if (maximumMinutes)
    return { kind: "maximum_seconds", maximumSeconds: Number(maximumMinutes[1]) * 60 }
  const singleMinutes = waitCopy.match(/(\d+)\s*Minuten?/i)
  if (singleMinutes) return { kind: "seconds", seconds: Number(singleMinutes[1]) * 60 }
  const singleSeconds = waitCopy.match(/(\d+)\s*Sekunden?/i)
  if (singleSeconds) return { kind: "seconds", seconds: Number(singleSeconds[1]) }
  if (row.guidance_payload.applicationFamily === "targeted_treatment_shampoo")
    return { kind: "label_directed" }
  return null
}

function amount(row: SourceRow): ProductApplicationPointerV2["facts"]["amount"] {
  if (row.product_id === "38dace91-0fba-49ee-a93f-ac36e488fe4b") {
    return { kind: "pumps", minimum: 1, maximum: 3 }
  }
  if (row.guidance_payload.scope.category !== "oil") return null
  const copy = row.guidance_payload.protocolFacts.amount?.copyDe ?? ""
  if (/\b1 Tropfen\b/i.test(copy)) return { kind: "qualitative", value: "one_drop" }
  if (/wenige|ein paar Tropfen/i.test(copy)) return { kind: "qualitative", value: "few_drops" }
  if (/sehr kleine/i.test(copy)) return { kind: "qualitative", value: "very_small_amount" }
  if (/kleine Menge/i.test(copy)) return { kind: "qualitative", value: "small_amount" }
  if (/großzüg/i.test(copy)) return { kind: "qualitative", value: "generous" }
  return null
}

function heatFacts(row: SourceRow): ProductApplicationPointerV2["facts"]["heat"] {
  if (row.guidance_payload.role !== "heat_protection") return null
  const family = row.guidance_payload.applicationFamily
  const supportedStates =
    family === "pre_heat_damp"
      ? (["damp_hair"] as const)
      : family === "pre_heat_dry"
        ? (["dry_hair"] as const)
        : (["damp_hair", "dry_hair"] as const)
  const allCopy = row.guidance_payload.steps.map((step) => step.copyTemplateDe).join(" ")
  const temperature = allCopy.match(/\b(\d{3})\s*°?\s*C\b/i)?.[1]
  return {
    supportedStates: [...supportedStates],
    activationRequired: /aktivier/i.test(allCopy),
    maximumClaimedTemperatureC: temperature ? Number(temperature) : null,
    reapplication:
      row.guidance_payload.protocolFacts.reapplication === "each_separate_heat_event"
        ? "each_separate_heat_event"
        : "none",
  }
}

function conditionerPolicy(
  row: SourceRow,
): ProductApplicationPointerV2["facts"]["conditionerPolicy"] {
  return row.guidance_payload.protocolFacts.conditionerRelationship ?? "not_applicable"
}

const workflowByProductId = {
  "515de93c-1c77-465d-ae0d-2a8d6ddb3d73": "swiss_o_par_tea_tree_two_pass",
  "f8a63590-9d80-454a-8008-e2a56321e64c": "epres_bond_repair",
  "38dace91-0fba-49ee-a93f-ac36e488fe4b": "k18_leave_in_molecular_repair",
  "aadbbab5-bcf5-4b46-b38a-5533648bcb1d": "olaplex_no0_companion",
  "3dc24d67-e6c0-4239-a273-058a87d13553": "olaplex_no3plus_complete_repair",
} as const

function exactSteps(row: SourceRow, workflowId: string | null) {
  if (!workflowId) return []
  return row.guidance_payload.steps.map((step) => ({
    stepKey: step.stepKey,
    action: step.action,
    copyDe:
      workflowId === "k18_leave_in_molecular_repair" && step.stepKey === "apply-k18"
        ? "1–3 Pumpstöße für das gesamte Haar verwenden und von den Spitzen nach oben gleichmäßig einarbeiten."
        : step.copyTemplateDe,
  }))
}

function cautionCodes(row: SourceRow): ProductApplicationPointerV2["cautionCodes"] {
  const codes: ProductApplicationPointerV2["cautionCodes"] = []
  if (row.guidance_payload.applicationFamily === "aerosol_spray") {
    codes.push("avoid_eye_contact", "flammable_aerosol", "use_in_ventilated_area")
  }
  if (/Multi-Peptide|Anti-Haarverlust/i.test(row.product_name)) codes.push("cosmetic_claim_only")
  if (/Multi-Peptide/i.test(row.product_name)) codes.push("stop_on_irritation")
  return codes
}

function pointerFrom(row: SourceRow): ProductApplicationPointerV2 {
  const workflowId = workflowByProductId[row.product_id as keyof typeof workflowByProductId] ?? null
  const family = applicationFamily(row)
  const rinse =
    row.guidance_payload.applicationFamily === "pre_wash_lengths_treatment" ||
    workflowId === "epres_bond_repair"
      ? "follow_with_shampoo"
      : row.guidance_payload.protocolFacts.rinse === "leave_in"
        ? "leave_in"
        : "rinse_out"
  return productApplicationPointerV2Schema.parse({
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: row.guidance_payload.scope,
    sourceRole: row.role,
    role: row.guidance_payload.role,
    applicationFamily: family,
    facts: {
      applicationState: applicationState(family, row.guidance_payload.scope.category),
      applicationArea: applicationArea(row),
      rinse,
      contactTime: contactTime(row),
      amount: amount(row),
      heat: heatFacts(row),
      conditionerPolicy: conditionerPolicy(row),
    },
    workflowId,
    requiredCompanionProductId: null,
    runtimeBlockerCode:
      workflowId === "olaplex_no0_companion" ? "missing_verified_companion" : null,
    exactSteps: exactSteps(row, workflowId),
    cautionCodes: cautionCodes(row),
    evidence: row.guidance_payload.evidence,
  })
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
    const pointer = pointerFrom(row)
    const composed = composeProductApplicationProtocolsV2(pointer, SHARED_APPLICATION_TEMPLATES_V2)
    const isReviewedCompanionBlocker =
      composed.status === "unresolved" &&
      composed.reason === "blocked_missing_verified_companion" &&
      pointer.workflowId === "olaplex_no0_companion"
    if (composed.status === "unresolved" && !isReviewedCompanionBlocker) {
      throw new Error(`${row.product_id}:${row.role}:${composed.reason}`)
    }
    const protocols = composed.status === "resolved" ? composed.protocols : []
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
      after_visible_step_fingerprint: isReviewedCompanionBlocker
        ? sha256("blocked_missing_verified_companion")
        : protocolFingerprint(protocols),
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

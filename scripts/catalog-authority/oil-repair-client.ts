import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import type { SupabaseClient } from "@supabase/supabase-js"

import {
  assertOilAuthorityRepairReady,
  inspectOilAuthorityRepair,
  oilAuthorityRepairContent,
  OIL_AUTHORITY_PRODUCT_IDS,
  parseOilAuthorityRepairManifest,
} from "@/lib/catalog-authority/oil-repair"
import {
  catalogAuthorityCanonicalJson,
  type CatalogAuthorityCurrentState,
} from "@/lib/catalog-authority/repair"
import {
  createSupabaseClientFromEnv,
  flag,
  flagBool,
  parseArgs,
  printJson,
  requireFlag,
} from "../product-intake/cli"

const PROJECT_ID = "pqdkhefxsxkyeqelqegq"
const DEFAULT_MANIFEST = "data/catalog-enrichment/oil-authority-enrichment-v1/manifest.json"

type ProductRow = {
  id: string
  name: string
  brand: string
  category_key: string
  affiliate_link: string
  origin: string
  is_active: boolean
  lifecycle_status: string
  is_chaarlie_recommended: boolean
  suitable_thicknesses: string[]
}

export async function fetchOilAuthorityCurrentStates(
  client: SupabaseClient,
): Promise<CatalogAuthorityCurrentState[]> {
  const ids = [...OIL_AUTHORITY_PRODUCT_IDS]
  const [products, thicknesses, specs, eligibility, protocols, evidence] = await Promise.all([
    client
      .from("products")
      .select(
        "id,name,brand,category_key,affiliate_link,origin,is_active,lifecycle_status,is_chaarlie_recommended,suitable_thicknesses",
      )
      .in("id", ids)
      .returns<ProductRow[]>(),
    client
      .from("product_thickness_eligibility")
      .select("product_id,category_key,thickness")
      .in("product_id", ids)
      .eq("category_key", "oil"),
    client
      .from("product_oil_specs")
      .select("product_id,category_key,weight,role_support,provides_heat_protection")
      .in("product_id", ids),
    client
      .from("product_oil_eligibility")
      .select("product_id,category_key,thickness,oil_subtype,oil_purpose,ingredient_flags")
      .in("product_id", ids),
    client
      .from("product_application_protocols")
      .select(
        "product_id,category_key,role,application_family,cadence,application_stage,application_state,placement,contact_time_seconds,rinse_action,reapplication,instruction_modifiers,source_label,source_url,source_text,guidance_payload",
      )
      .in("product_id", ids)
      .eq("category_key", "oil"),
    client
      .from("personal_plan_catalog_fact_evidence")
      .select(
        "product_id,fact_key,fact_value,source_label,source_url,source_text,source_type,checked_at",
      )
      .in("product_id", ids)
      .eq("fact_key", "oil.authority_facts"),
  ])

  for (const [label, result] of [
    ["products", products],
    ["thickness eligibility", thicknesses],
    ["Oil specs", specs],
    ["Oil eligibility", eligibility],
    ["protocols", protocols],
    ["fact evidence", evidence],
  ] as const) {
    if (result.error) throw new Error(`Oil repair ${label} read failed: ${result.error.message}`)
  }

  return (products.data ?? []).map((product) => {
    const spec = (specs.data ?? []).find((row) => row.product_id === product.id)
    return {
      productId: product.id,
      categoryKey: "oil" as const,
      authority: {
        identity: {
          name: product.name,
          brand: product.brand,
          origin: product.origin,
          isActive: product.is_active,
          productId: product.id,
          categoryKey: product.category_key,
          affiliateLink: product.affiliate_link,
          lifecycleStatus: product.lifecycle_status,
          suitableThicknesses: product.suitable_thicknesses,
          isChaarlieRecommended: product.is_chaarlie_recommended,
          normalizedThicknesses: (thicknesses.data ?? [])
            .filter((row) => row.product_id === product.id)
            .map((row) => row.thickness)
            .sort(),
        },
        productOilSpec: spec
          ? {
              weight: spec.weight,
              roleSupport: spec.role_support,
              providesHeatProtection: spec.provides_heat_protection,
            }
          : null,
        productOilEligibility: (eligibility.data ?? [])
          .filter((row) => row.product_id === product.id)
          .sort((left, right) =>
            `${left.thickness}:${left.oil_subtype}`.localeCompare(
              `${right.thickness}:${right.oil_subtype}`,
            ),
          )
          .map((row) => ({
            thickness: row.thickness,
            oilSubtype: row.oil_subtype,
            oilPurpose: row.oil_purpose,
            ingredientFlags: row.ingredient_flags,
          })),
        protocols: (protocols.data ?? [])
          .filter((row) => row.product_id === product.id)
          .sort((left, right) =>
            `${left.role}:${left.application_family}`.localeCompare(
              `${right.role}:${right.application_family}`,
            ),
          )
          .map((row) => ({
            role: row.role,
            applicationFamily: row.application_family,
            cadence: row.cadence,
            applicationStage: row.application_stage,
            applicationState: row.application_state,
            placement: row.placement,
            contactTimeSeconds: row.contact_time_seconds,
            rinseAction: row.rinse_action,
            reapplication: row.reapplication,
            instructionModifiers: row.instruction_modifiers,
            sourceLabel: row.source_label,
            sourceUrl: row.source_url,
            sourceText: row.source_text,
            guidancePayload: row.guidance_payload,
          })),
        factEvidence: (evidence.data ?? [])
          .filter((row) => row.product_id === product.id)
          .sort((left, right) => left.source_url.localeCompare(right.source_url))
          .map((row) => ({
            factKey: row.fact_key,
            factValue: row.fact_value,
            sourceLabel: row.source_label,
            sourceUrl: row.source_url,
            sourceText: row.source_text,
            sourceType: row.source_type,
            checkedAt: row.checked_at,
          })),
      },
    }
  })
}

export function assertOilRepairApplyCliGate(input: {
  apply: boolean
  confirm: boolean
  confirmProject: string | null
  reviewedHead: string | null
  expectedFingerprint: string | null
  actualFingerprint: string
  manifestReady: boolean
  gitHead?: string
  gitStatus?: string
}): void {
  if (!input.apply) return
  if (!input.confirm) throw new Error("oil_repair_apply_confirmation_missing")
  if (input.confirmProject !== PROJECT_ID)
    throw new Error("oil_repair_project_confirmation_mismatch")
  if (!input.reviewedHead) throw new Error("oil_repair_reviewed_head_missing")
  if (input.expectedFingerprint !== input.actualFingerprint) {
    throw new Error("oil_repair_expected_fingerprint_mismatch")
  }
  if (!input.manifestReady) throw new Error("oil_repair_manifest_not_approved")
  const gitHead =
    input.gitHead ?? execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const gitStatus =
    input.gitStatus ?? execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" })
  if (gitHead !== input.reviewedHead) throw new Error("oil_repair_reviewed_head_mismatch")
  if (gitStatus.trim()) throw new Error("oil_repair_worktree_not_clean")
}

async function main() {
  const args = parseArgs()
  const manifestPath = resolve(flag(args, "file") ?? DEFAULT_MANIFEST)
  const manifest = parseOilAuthorityRepairManifest(JSON.parse(readFileSync(manifestPath, "utf8")))
  const client = createSupabaseClientFromEnv()
  const currentStates = await fetchOilAuthorityCurrentStates(client)
  const inspection = inspectOilAuthorityRepair(manifest, currentStates)
  const apply = flagBool(args, "apply")

  assertOilRepairApplyCliGate({
    apply,
    confirm: flagBool(args, "confirm"),
    confirmProject: flag(args, "confirm-project"),
    reviewedHead: flag(args, "reviewed-head"),
    expectedFingerprint: flag(args, "expected-fingerprint"),
    actualFingerprint: inspection.contentFingerprint,
    manifestReady: manifest.review.state === "approved" && inspection.blockers.length === 0,
  })

  if (!apply) {
    printJson({ mode: "dry-run", projectId: PROJECT_ID, manifestPath, ...inspection })
    return
  }

  assertOilAuthorityRepairReady(manifest, currentStates)
  const content = catalogAuthorityCanonicalJson(oilAuthorityRepairContent(manifest))
  const { data, error } = await client.rpc("apply_catalog_authority_oil_repair_v1", {
    p_manifest_json: content,
    p_expected_manifest_fingerprint: requireFlag(args, "expected-fingerprint"),
    p_reviewed_by: "nick",
  })
  if (error) throw new Error(`Oil repair apply failed: ${error.message}`)
  printJson({ mode: "apply", projectId: PROJECT_ID, rows: data })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}

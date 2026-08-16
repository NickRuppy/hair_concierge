import { pathToFileURL } from "node:url"

import { createClient } from "@supabase/supabase-js"

import { PRODUCT_APPLICATION_FACTS_SELECT } from "../../src/lib/catalog-authority/product-spec-relationships"
import {
  STAGE5_COHORT_AUDIT_FALLBACK_SELECT,
  STAGE5_COHORT_AUDIT_SELECT,
} from "../product-intake/catalog-enrichment/stage5-protocol-client"

// Read-only hosted-branch check. Use the package scripts for the explicit pre- or
// post-convergence mode and provide CATALOG_RELATIONSHIP_VERIFY_SUPABASE_URL,
// CATALOG_RELATIONSHIP_VERIFY_SERVICE_ROLE_KEY, and CATALOG_RELATIONSHIP_VERIFY_PROJECT_REF.
// The target must be a matching non-production *.supabase.co project.

const PRODUCTION_PROJECT_REF = "pqdkhefxsxkyeqelqegq"
const LEGACY_AMBIGUOUS_SELECT = "id,product_leave_in_specs(product_id)"
const APPLICATION_SINGLETON_EMBEDS = [
  "product_leave_in_specs",
  "product_bondbuilder_specs",
  "product_mask_specs",
  "product_oil_specs",
  "product_heat_protectant_specs",
  "product_scalp_care_specs",
  "product_dry_shampoo_specs",
] as const
const COHORT_SINGLETON_EMBEDS = [
  "product_leave_in_specs",
  "product_mask_specs",
  "product_oil_specs",
  "product_scalp_care_specs",
  "product_deep_cleansing_shampoo_specs",
] as const

type VerificationTarget = { url: string; serviceRoleKey: string; projectRef: string }

export function readRelationshipVerificationTarget(
  env: Partial<Record<string, string | undefined>> = process.env,
): VerificationTarget {
  const url = env.CATALOG_RELATIONSHIP_VERIFY_SUPABASE_URL
  const serviceRoleKey = env.CATALOG_RELATIONSHIP_VERIFY_SERVICE_ROLE_KEY
  const projectRef = env.CATALOG_RELATIONSHIP_VERIFY_PROJECT_REF
  if (!url || !serviceRoleKey || !projectRef) {
    throw new Error("catalog_relationship_verification_credentials_missing")
  }
  if (projectRef === PRODUCTION_PROJECT_REF) {
    throw new Error("catalog_relationship_verification_production_forbidden")
  }
  const hostname = new URL(url).hostname
  if (hostname !== `${projectRef}.supabase.co`) {
    throw new Error("catalog_relationship_verification_project_mismatch")
  }
  return { url, serviceRoleKey, projectRef }
}

export async function runProductSpecRelationshipVerification(argv: string[]): Promise<void> {
  const mode = argv[0]
  if (!mode || !["--expect-dual-relationships", "--expect-converged"].includes(mode)) {
    throw new Error("expected --expect-dual-relationships or --expect-converged")
  }
  if (argv.length !== 1) throw new Error("unexpected catalog relationship verification argument")

  const target = readRelationshipVerificationTarget()
  const client = createClient(target.url, target.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const legacy = await client.from("products").select(LEGACY_AMBIGUOUS_SELECT).limit(1)
  if (mode === "--expect-dual-relationships") {
    if (legacy.error?.code !== "PGRST201") {
      throw new Error("catalog_relationship_expected_legacy_ambiguity_missing")
    }
  } else if (legacy.error) {
    throw new Error("catalog_relationship_legacy_selector_still_ambiguous")
  }

  const application = await client
    .from("products")
    .select(PRODUCT_APPLICATION_FACTS_SELECT)
    .eq("is_active", true)
    .limit(10)
  if (application.error) throw new Error("catalog_relationship_hinted_projection_failed")
  const applicationRows = assertProductSpecProjectionShape(
    application.data,
    APPLICATION_SINGLETON_EMBEDS,
  )

  const cohort = await client
    .from("products")
    .select(STAGE5_COHORT_AUDIT_SELECT)
    .eq("is_active", true)
    .limit(10)
  if (cohort.error) throw new Error("catalog_relationship_cohort_projection_failed")
  assertProductSpecProjectionShape(cohort.data, COHORT_SINGLETON_EMBEDS, ["product_shampoo_specs"])

  const cohortFallback = await client
    .from("products")
    .select(STAGE5_COHORT_AUDIT_FALLBACK_SELECT)
    .eq("is_active", true)
    .limit(10)
  if (cohortFallback.error) {
    throw new Error("catalog_relationship_cohort_fallback_projection_failed")
  }
  assertProductSpecProjectionShape(cohortFallback.data, COHORT_SINGLETON_EMBEDS, [
    "product_shampoo_specs",
  ])

  process.stdout.write(
    `${JSON.stringify({ mode, projectRef: target.projectRef, checkedRows: applicationRows.length, status: "ok" })}\n`,
  )
}

export function assertProductSpecProjectionShape(
  data: unknown,
  singletonKeys: readonly string[],
  arrayKeys: readonly string[] = [],
): Record<string, unknown>[] {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("catalog_relationship_hinted_projection_empty")
  }
  return data.map((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("catalog_relationship_hinted_projection_shape_invalid")
    }
    const row = value as Record<string, unknown>
    if (typeof row.id !== "string") {
      throw new Error("catalog_relationship_hinted_projection_shape_invalid")
    }
    for (const key of singletonKeys) {
      const nested = row[key]
      if (
        !(key in row) ||
        Array.isArray(nested) ||
        (nested !== null && typeof nested !== "object")
      ) {
        throw new Error("catalog_relationship_hinted_projection_shape_invalid")
      }
    }
    for (const key of arrayKeys) {
      if (!Array.isArray(row[key])) {
        throw new Error("catalog_relationship_hinted_projection_shape_invalid")
      }
    }
    return row
  })
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(entry).href) {
  runProductSpecRelationshipVerification(process.argv.slice(2)).catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}

import { z } from "zod"

import { applicationFamilySchema } from "@/lib/routines/personal-plan/application/contracts"

const useCaseSchema = z
  .object({
    source_role: z.enum(["post_wash_leave_in", "pre_heat_protection"]),
    application_family: applicationFamilySchema,
    source_url: z.string().url(),
    source_type: z.enum(["manufacturer", "retailer", "professional_authority"]),
    checked_at: z.string().date(),
    maximum_claimed_temperature_c: z.number().int().positive().nullable().optional(),
  })
  .strict()

const candidateDispositionSchema = z
  .object({
    use_case: z.enum([
      "post_wash_damp",
      "between_wash_damp",
      "between_wash_dry",
      "post_style",
      "pre_heat",
    ]),
    status: z.enum(["supported", "unsupported"]),
    reason: z.string().min(1),
  })
  .strict()

export const leaveInUseCaseManifestSchema = z
  .object({
    schema_version: z.literal("personal-plan-leave-in-use-cases-v1"),
    snapshot_date: z.string().date(),
    baseline: z
      .object({
        path: z.literal(
          "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-baseline-2026-08-12.json",
        ),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    between_wash_policy: z
      .object({
        eligibility: z.literal("all_true_leave_ins"),
        methods: z.tuple([
          z.literal("between_wash_damp_refresh"),
          z.literal("between_wash_dry_care"),
        ]),
        preferred_method: z.literal("between_wash_damp_refresh"),
        adaptation_facts: z.tuple([
          z.literal("format"),
          z.literal("thickness"),
          z.literal("density"),
        ]),
        source_urls: z.array(z.string().url()).min(2),
      })
      .strict(),
    reviewed_product_ids: z.array(z.string().uuid()).min(1),
    overrides: z.array(
      z
        .object({
          product_id: z.string().uuid(),
          product_name: z.string().min(1),
          uses: z.array(useCaseSchema).min(1),
          candidate_dispositions: z.array(candidateDispositionSchema).min(1),
        })
        .strict(),
    ),
  })
  .strict()

type BackfillArtifact = {
  items: Array<{
    product_id: string
    product_name: string
    source_role: string
    guidance_payload_v2: {
      scope: { category: string }
      applicationFamily: string
      evidence: Array<{
        sourceUrl: string
        sourceType: "manufacturer" | "retailer" | "professional_authority"
        checkedAt: string
      }>
    }
  }>
}

function compareSets(actual: Set<string>, expected: Set<string>, label: string) {
  const missing = [...expected].filter((value) => !actual.has(value)).sort()
  const extra = [...actual].filter((value) => !expected.has(value)).sort()
  if (missing.length || extra.length) {
    throw new Error(`${label}:missing=${missing.join(",")}:extra=${extra.join(",")}`)
  }
}

export function buildReviewedLeaveInUseCases(
  input: unknown,
  artifact: BackfillArtifact,
  baselineSha256: string,
) {
  const manifest = leaveInUseCaseManifestSchema.parse(input)
  if (manifest.baseline.sha256 !== baselineSha256) {
    throw new Error("leave_in_use_case_baseline_fingerprint_mismatch")
  }

  const baselineByProduct = new Map<
    string,
    { productId: string; productName: string; uses: z.infer<typeof useCaseSchema>[] }
  >()
  for (const item of artifact.items) {
    if (item.guidance_payload_v2.scope.category !== "leave_in") continue
    const evidence = item.guidance_payload_v2.evidence[0]
    if (!evidence) throw new Error(`leave_in_use_case_missing_evidence:${item.product_id}`)
    const product = baselineByProduct.get(item.product_id) ?? {
      productId: item.product_id,
      productName: item.product_name,
      uses: [],
    }
    product.uses.push(
      useCaseSchema.parse({
        source_role: item.source_role,
        application_family: item.guidance_payload_v2.applicationFamily,
        source_url: evidence.sourceUrl,
        source_type: evidence.sourceType,
        checked_at: evidence.checkedAt,
      }),
    )
    baselineByProduct.set(item.product_id, product)
  }

  compareSets(
    new Set(manifest.reviewed_product_ids),
    new Set(baselineByProduct.keys()),
    "leave_in_use_case_reviewed_cohort_mismatch",
  )
  if (new Set(manifest.reviewed_product_ids).size !== manifest.reviewed_product_ids.length) {
    throw new Error("leave_in_use_case_duplicate_reviewed_product")
  }

  const overrides = new Map<string, (typeof manifest.overrides)[number]>()
  for (const override of manifest.overrides) {
    const baseline = baselineByProduct.get(override.product_id)
    if (!baseline) throw new Error(`leave_in_use_case_unknown_override:${override.product_id}`)
    if (baseline.productName !== override.product_name) {
      throw new Error(`leave_in_use_case_product_name_mismatch:${override.product_id}`)
    }
    if (overrides.has(override.product_id)) {
      throw new Error(`leave_in_use_case_duplicate_override:${override.product_id}`)
    }
    overrides.set(override.product_id, override)
  }

  const products = [...baselineByProduct.values()]
    .map((baseline) => {
      const override = overrides.get(baseline.productId)
      const uses = override?.uses ?? baseline.uses
      const identities = uses.map((use) => `${use.source_role}:${use.application_family}`)
      if (new Set(identities).size !== identities.length) {
        throw new Error(`leave_in_use_case_duplicate_identity:${baseline.productId}`)
      }
      return {
        product_id: baseline.productId,
        product_name: baseline.productName,
        uses,
        candidate_dispositions: override?.candidate_dispositions ?? [],
        changed_from_baseline: Boolean(override),
      }
    })
    .sort((left, right) => left.product_name.localeCompare(right.product_name))

  return {
    schemaVersion: manifest.schema_version,
    snapshotDate: manifest.snapshot_date,
    products,
    reviewedProductCount: products.length,
    changedProductCount: overrides.size,
    useCaseCount: products.reduce((sum, product) => sum + product.uses.length, 0),
    betweenWashPolicy: manifest.between_wash_policy,
  }
}

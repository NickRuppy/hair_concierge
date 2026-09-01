import { z } from "zod"

import { applicationGuidanceProtocolSchema } from "@/lib/routines/personal-plan/application/contracts"

import {
  assertCatalogAuthorityRepairReady,
  catalogAuthorityRepairManifestSchema,
  catalogAuthorityRepairReviewFingerprint,
  catalogAuthorityValueFingerprint,
  type CatalogAuthorityCurrentState,
  type CatalogAuthorityRepairManifest,
} from "./repair"

const thicknessSchema = z.enum(["fine", "normal", "coarse"])
const oilRoleSchema = z.enum([
  "pre_wash_fibre_treatment",
  "leave_on_fibre_conditioning",
  "dry_finish",
  "pre_heat_protection",
])

const identitySchema = z
  .object({
    productId: z.string().uuid(),
    name: z.string().min(1),
    brand: z.string().min(1),
    categoryKey: z.literal("oil"),
    affiliateLink: z.string().url(),
    origin: z.literal("curated"),
    isActive: z.literal(true),
    lifecycleStatus: z.literal("active"),
    isChaarlieRecommended: z.literal(true),
    suitableThicknesses: thicknessSchema.array().length(1),
    normalizedThicknesses: thicknessSchema.array().length(1),
  })
  .strict()

const oilSpecSchema = z
  .object({
    weight: z.enum(["light", "medium", "rich"]),
    roleSupport: oilRoleSchema.array().min(1),
    providesHeatProtection: z.boolean(),
  })
  .strict()

const currentOilSpecSchema = z
  .object({
    weight: z.enum(["light", "medium", "rich"]).nullable(),
    roleSupport: oilRoleSchema.array().nullable(),
    providesHeatProtection: z.boolean().nullable(),
  })
  .strict()

const oilEligibilitySchema = z
  .object({
    thickness: thicknessSchema,
    oilSubtype: z.enum(["natuerliches-oel", "styling-oel", "trocken-oel"]),
    oilPurpose: z.enum(["pre_wash_oiling", "styling_finish", "light_finish"]).nullable(),
    ingredientFlags: z.enum(["oils", "silicones"]).array(),
  })
  .strict()

const protocolSchema = z
  .object({
    role: oilRoleSchema,
    applicationFamily: z.string().min(1),
    cadence: z.string().nullable(),
    applicationStage: z.string().min(1),
    applicationState: z.string().min(1),
    placement: z.enum(["lengths_ends", "ends"]),
    contactTimeSeconds: z.number().int().nonnegative().nullable(),
    rinseAction: z.enum(["shampoo_out", "leave_in"]),
    reapplication: z.enum(["not_stated", "optional", "required"]),
    instructionModifiers: z.string().array(),
    sourceLabel: z.string().min(1),
    sourceUrl: z.string().url(),
    sourceText: z.string().min(1),
    guidancePayload: applicationGuidanceProtocolSchema,
  })
  .strict()

const factEvidenceSchema = z
  .object({
    factKey: z.literal("oil.authority_facts"),
    factValue: z.record(z.string(), z.unknown()),
    sourceLabel: z.string().min(1),
    sourceUrl: z.string().url(),
    sourceText: z.string().min(1),
    sourceType: z.enum(["manufacturer", "retailer", "professional_authority", "internal_verified"]),
    checkedAt: z.string().date(),
  })
  .strict()

const oilCurrentAuthoritySchema = z
  .object({
    identity: identitySchema,
    productOilSpec: currentOilSpecSchema.nullable(),
    productOilEligibility: oilEligibilitySchema.array().length(1),
    protocols: protocolSchema.array(),
    factEvidence: factEvidenceSchema.array(),
  })
  .strict()

const oilTargetAuthoritySchema = oilCurrentAuthoritySchema.extend({ productOilSpec: oilSpecSchema })

export type OilAuthority = z.infer<typeof oilTargetAuthoritySchema>

export const OIL_AUTHORITY_PRODUCT_IDS = [
  "19aea9c4-4b90-4ec4-8cb6-90cb270010f7",
  "1dce2c18-6a45-4017-a748-e3a7f1cba36f",
  "1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf",
  "29e36443-93ff-4b62-9cf0-55ad9f89f530",
  "2ffeae68-c625-4df5-be02-0c1b620aa0fc",
  "38886b62-2c45-4b34-9a24-7d831e97946e",
  "3acd3c18-0a4b-45f8-9178-5bd2f4e0a38b",
  "3eb198a5-9aab-4f28-9df1-c4869c6a12db",
  "4a95e1de-54e9-4fcd-b227-72a5824d13c1",
  "517dca50-5d55-4038-ba1d-f9b745708327",
  "9bfe0a67-72ad-4951-bb99-9f2f5d5c724a",
  "a11855eb-64e5-438f-8880-1d3573efa9fa",
  "acf9d5cd-76e4-49c7-9c04-0af1f20506ad",
  "c574ee6f-ad22-45c0-b936-57b847d93433",
  "ca4ae209-79d2-4f4d-8e44-46e586cec62d",
] as const

const OGX_ID = "1ed63e8e-4840-49ec-a49e-2b9f19f8bfbf"
const GARNIER_ID = "c574ee6f-ad22-45c0-b936-57b847d93433"

export type OilAuthorityInspection = {
  writes: false
  contentFingerprint: string
  productFingerprints: Array<{ productId: string; before: string; after: string }>
  blockers: string[]
}

export function parseOilAuthorityRepairManifest(input: unknown): CatalogAuthorityRepairManifest {
  const manifest = catalogAuthorityRepairManifestSchema.parse(input)
  validateOilManifest(manifest)
  return manifest
}

export function inspectOilAuthorityRepair(
  input: unknown,
  currentStates: readonly CatalogAuthorityCurrentState[] = [],
): OilAuthorityInspection {
  const manifest = parseOilAuthorityRepairManifest(input)
  const blockers: string[] = []
  if (
    manifest.review.state !== "approved" ||
    !manifest.review.reviewedBy ||
    !manifest.review.reviewedAt ||
    !manifest.review.reviewedContentFingerprint
  ) {
    blockers.push("approval_pending")
  }

  const currentById = new Map(currentStates.map((current) => [current.productId, current]))
  for (const entry of manifest.entries) {
    const current = currentById.get(entry.productId)
    if (!current) {
      blockers.push(`live_prestate_not_checked:${entry.productId}`)
      continue
    }
    if (catalogAuthorityValueFingerprint(current.authority) !== entry.expectedOldFingerprint) {
      blockers.push(`live_prestate_drift:${entry.productId}`)
    }
  }

  return {
    writes: false,
    contentFingerprint: catalogAuthorityRepairReviewFingerprint(manifest),
    productFingerprints: manifest.entries.map((entry) => ({
      productId: entry.productId,
      before: entry.expectedOldFingerprint,
      after: entry.expectedNewFingerprint,
    })),
    blockers: [...new Set(blockers)],
  }
}

export function assertOilAuthorityRepairReady(
  input: unknown,
  currentStates: readonly CatalogAuthorityCurrentState[],
): CatalogAuthorityRepairManifest {
  const manifest = parseOilAuthorityRepairManifest(input)
  return assertCatalogAuthorityRepairReady(manifest, currentStates)
}

export function oilAuthorityRepairContent(manifest: CatalogAuthorityRepairManifest) {
  return { schemaVersion: manifest.schemaVersion, slice: manifest.slice, entries: manifest.entries }
}

function validateOilManifest(manifest: CatalogAuthorityRepairManifest): void {
  if (manifest.slice !== "leave_in_oil") throw new Error("oil_authority_repair_wrong_slice")

  const actualIds = manifest.entries.map((entry) => entry.productId).sort()
  const expectedIds = [...OIL_AUTHORITY_PRODUCT_IDS].sort()
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error("oil_authority_repair_wrong_cohort")
  }

  let protocolCount = 0
  for (const entry of manifest.entries) {
    if (entry.categoryKey !== "oil" || !entry.expectedCurrentAuthority) {
      throw new Error(`oil_authority_repair_incomplete_prestate:${entry.productId}`)
    }
    if (
      catalogAuthorityValueFingerprint(entry.expectedCurrentAuthority) !==
      entry.expectedOldFingerprint
    ) {
      throw new Error(`oil_authority_repair_old_fingerprint_mismatch:${entry.productId}`)
    }
    if (
      catalogAuthorityValueFingerprint(entry.intendedAuthority) !== entry.expectedNewFingerprint
    ) {
      throw new Error(`oil_authority_repair_new_fingerprint_mismatch:${entry.productId}`)
    }

    const current = oilCurrentAuthoritySchema.parse(entry.expectedCurrentAuthority)
    const target = oilTargetAuthoritySchema.parse(entry.intendedAuthority)
    if (
      current.identity.productId !== entry.productId ||
      target.identity.productId !== entry.productId
    ) {
      throw new Error(`oil_authority_repair_identity_product_mismatch:${entry.productId}`)
    }
    if (
      catalogAuthorityValueFingerprint(current.identity) !==
      catalogAuthorityValueFingerprint(target.identity)
    ) {
      throw new Error(`oil_authority_repair_identity_mutation:${entry.productId}`)
    }
    if (
      target.identity.suitableThicknesses[0] !== target.identity.normalizedThicknesses[0] ||
      target.identity.suitableThicknesses[0] !== target.productOilEligibility[0].thickness
    ) {
      throw new Error(`oil_authority_repair_thickness_mismatch:${entry.productId}`)
    }

    const protocolRoles = target.protocols.map((protocol) => protocol.role).sort()
    const specRoles = [...target.productOilSpec.roleSupport].sort()
    if (JSON.stringify(protocolRoles) !== JSON.stringify(specRoles)) {
      throw new Error(`oil_authority_repair_protocol_role_mismatch:${entry.productId}`)
    }
    for (const protocol of target.protocols) {
      if (
        protocol.guidancePayload.scope.kind !== "product" ||
        protocol.guidancePayload.scope.category !== "oil" ||
        protocol.guidancePayload.scope.productId !== entry.productId ||
        protocol.guidancePayload.applicationFamily !== protocol.applicationFamily
      ) {
        throw new Error(`oil_authority_repair_protocol_scope_mismatch:${entry.productId}`)
      }
    }
    protocolCount += target.protocols.length

    const eligibility = target.productOilEligibility[0]
    if (entry.productId === GARNIER_ID) {
      if (
        eligibility.oilPurpose !== null ||
        target.productOilSpec.roleSupport.length !== 1 ||
        target.productOilSpec.roleSupport[0] !== "pre_heat_protection"
      ) {
        throw new Error("oil_authority_repair_garnier_heat_only_contract")
      }
    } else if (entry.productId === OGX_ID) {
      if (eligibility.oilPurpose !== "styling_finish") {
        throw new Error("oil_authority_repair_ogx_styling_contract")
      }
    } else if (eligibility.oilPurpose !== "pre_wash_oiling") {
      throw new Error(`oil_authority_repair_natural_oil_purpose_mismatch:${entry.productId}`)
    }

    const shouldProtectFromHeat = entry.productId === OGX_ID || entry.productId === GARNIER_ID
    if (target.productOilSpec.providesHeatProtection !== shouldProtectFromHeat) {
      throw new Error(`oil_authority_repair_heat_flag_mismatch:${entry.productId}`)
    }
  }
  if (protocolCount !== 18) throw new Error("oil_authority_repair_protocol_count_mismatch")
}

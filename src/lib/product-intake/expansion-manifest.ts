import { z } from "zod"

import { HAIR_THICKNESSES } from "@/lib/vocabulary"
import { isProductConcernCode } from "@/lib/product-specs/concern-taxonomy"
import { validateEanInput } from "@/lib/scan/identifier-lookup"
import { deriveShampooProtocolRoles } from "@/lib/product-intake/shampoo-protocol-roles"
import { validateProductIntakeCategorySpecs } from "@/lib/product-intake/category-validators"

/**
 * Research-engine output contract for the Scan DB Expansion pilot (T2 of
 * plans/2026-09-01-scan-db-expansion-pilot.md).
 *
 * This module composes/reuses the existing Product Intake validators rather than
 * forking them:
 *  - `category_specs` per product is validated structurally by
 *    `validateProductIntakeCategorySpecs` from category-validators.ts — the same
 *    function the live approval path uses. We only ADD tightened non-null
 *    requirements for the runtime-consumed fields the strict readiness oracle
 *    reads even when the generic schema allows null (F-03).
 *  - shampoo protocol-role coverage reuses `deriveShampooProtocolRoles` verbatim.
 *  - conditioner/mask/leave_in/oil role derivation mirrors the (unexported)
 *    `requiredProtocolRoles()` in category-validators.ts field-for-field; it is
 *    re-declared locally only because that helper isn't exported and this task
 *    may not edit category-validators.ts. See `deriveRequiredProtocolRoles`.
 *  - EAN GS1 check-digit validation reuses `validateEanInput` from
 *    src/lib/scan/identifier-lookup.ts verbatim (no server-only dependency).
 *
 * Known disagreement between the plan's field list and the live code (followed
 * here, not guessed): the plan's T2 text lists "oil ... provides_heat_protection"
 * as a runtime-consumed oil spec field. `product_oil_specs` (category-validators.ts)
 * has NO such boolean column — an oil's heat-protection role is carried entirely by
 * `role_support` containing `"pre_heat_protection"`. This module follows the code:
 * there is no oil `provides_heat_protection` field to validate, and the
 * heat-protection role requirement for oils is derived from `role_support` instead.
 */

// ---------------------------------------------------------------------------
// Category + template vocabulary
// ---------------------------------------------------------------------------

export const EXPANSION_CATEGORY_KEYS = [
  "shampoo",
  "conditioner",
  "leave_in",
  "oil",
  "mask",
] as const

export type ExpansionCategoryKey = (typeof EXPANSION_CATEGORY_KEYS)[number]

export const EXPANSION_TEMPLATE_IDS = [
  "TPL-SHAMPOO-STD",
  "TPL-SHAMPOO-TARGETED",
  "TPL-SHAMPOO-DANDRUFF",
  "TPL-CONDITIONER",
  "TPL-MASK",
  "TPL-LEAVEIN-DAMP",
  "TPL-LEAVEIN-DRYCARE",
  "TPL-LEAVEIN-HEAT",
  "TPL-OIL-DRYFINISH",
  "TPL-OIL-LEAVEON",
  "TPL-OIL-HEAT",
  "TPL-OIL-PREWASH",
] as const

export type ExpansionTemplateId = (typeof EXPANSION_TEMPLATE_IDS)[number]

const HEAT_TEMPLATE_IDS = new Set<ExpansionTemplateId>(["TPL-LEAVEIN-HEAT", "TPL-OIL-HEAT"])
const MASK_TEMPLATE_ID: ExpansionTemplateId = "TPL-MASK"

/** Maps each template to the (category, derived protocol role) it stamps — plans/scan-db-expansion/protocol-templates.md §4. */
export const EXPANSION_TEMPLATE_META: Record<
  ExpansionTemplateId,
  { category: ExpansionCategoryKey; role: string }
> = {
  "TPL-SHAMPOO-STD": { category: "shampoo", role: "shampoo_everyday" },
  "TPL-SHAMPOO-TARGETED": { category: "shampoo", role: "shampoo_everyday" },
  "TPL-SHAMPOO-DANDRUFF": { category: "shampoo", role: "shampoo_dandruff" },
  "TPL-CONDITIONER": { category: "conditioner", role: "conditioner_rinse_out" },
  "TPL-MASK": { category: "mask", role: "intensive_conditioning_mask" },
  "TPL-LEAVEIN-DAMP": { category: "leave_in", role: "post_wash_leave_in" },
  "TPL-LEAVEIN-DRYCARE": { category: "leave_in", role: "post_wash_leave_in" },
  "TPL-LEAVEIN-HEAT": { category: "leave_in", role: "pre_heat_protection" },
  "TPL-OIL-DRYFINISH": { category: "oil", role: "dry_finish" },
  "TPL-OIL-LEAVEON": { category: "oil", role: "leave_on_fibre_conditioning" },
  "TPL-OIL-HEAT": { category: "oil", role: "pre_heat_protection" },
  "TPL-OIL-PREWASH": { category: "oil", role: "pre_wash_fibre_treatment" },
}

/** Safe lookup for a possibly-unrecognized template id (see callers for why this matters). */
function getTemplateMeta(
  templateId: string,
): { category: ExpansionCategoryKey; role: string } | undefined {
  return Object.prototype.hasOwnProperty.call(EXPANSION_TEMPLATE_META, templateId)
    ? EXPANSION_TEMPLATE_META[templateId as ExpansionTemplateId]
    : undefined
}

/**
 * Required protocol roles per category, derived from reviewed facts — mirrors
 * `requiredProtocolRoles()` in category-validators.ts (not exported there).
 * Keep in sync with that function if it changes.
 */
export function deriveRequiredProtocolRoles(
  categoryKey: ExpansionCategoryKey,
  categorySpecs: Record<string, unknown>,
): string[] {
  switch (categoryKey) {
    case "shampoo": {
      const rows = Array.isArray(categorySpecs.product_shampoo_specs)
        ? (categorySpecs.product_shampoo_specs as Array<Record<string, unknown>>)
        : []
      return deriveShampooProtocolRoles(
        rows.map((row) => (row.shampoo_bucket as string | null | undefined) ?? null),
      )
    }
    case "conditioner":
      return ["conditioner_rinse_out"]
    case "mask":
      return ["intensive_conditioning_mask"]
    case "leave_in": {
      const specs = categorySpecs.product_leave_in_specs as
        | { provides_heat_protection?: unknown }
        | undefined
      return specs?.provides_heat_protection === true
        ? ["post_wash_leave_in", "pre_heat_protection"]
        : ["post_wash_leave_in"]
    }
    case "oil": {
      const specs = categorySpecs.product_oil_specs as { role_support?: unknown } | undefined
      return Array.isArray(specs?.role_support) ? (specs.role_support as string[]) : []
    }
    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// Shared field schemas
// ---------------------------------------------------------------------------

const trimmedNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1),
)

const isoDateString = z.string().datetime({ offset: true })
const isoDateOnlyString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
const urlString = z.string().url()
const uuidString = z.string().uuid()

// ---------------------------------------------------------------------------
// Identifiers (F-05-adjacent identity rule inputs; GS1 check digit reused)
// ---------------------------------------------------------------------------

export const expansionEanIdentifierSchema = z
  .object({
    type: z.literal("ean"),
    value: trimmedNonEmptyString,
    cross_source_agreement: z.boolean(),
    source_urls: z.array(urlString).min(1),
    excluded_from_apply: z.boolean().default(false),
  })
  .strict()
  .superRefine((identifier, ctx) => {
    const validated = validateEanInput(identifier.value)
    if (!validated.ok) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message:
          validated.reason === "length"
            ? "EAN must be 8 or 13 digits"
            : "EAN fails the GS1 mod-10 check digit",
      })
    }
    if (identifier.cross_source_agreement === false && identifier.excluded_from_apply !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["excluded_from_apply"],
        message:
          "identifiers with cross_source_agreement=false must be marked excluded_from_apply=true",
      })
    }
  })

export type ExpansionEanIdentifier = z.infer<typeof expansionEanIdentifierSchema>

// ---------------------------------------------------------------------------
// final.product
// ---------------------------------------------------------------------------

const candidateImageSchema = z
  .object({
    url: urlString,
    source_url: urlString,
  })
  .strict()

const expansionFinalProductSchema = z
  .object({
    name: trimmedNonEmptyString,
    brand: trimmedNonEmptyString,
    category_key: z.enum(EXPANSION_CATEGORY_KEYS),
    origin: z.literal("curated"),
    // Schema-level hard pin (R3): any other value fails, no matter what the engine sends.
    is_chaarlie_recommended: z.literal(false),
    price_eur: z.number().finite().nonnegative().optional(),
    net_content_value: z.number().finite().positive().optional(),
    net_content_unit: z.enum(["ml", "g"]).optional(),
    candidate_image: candidateImageSchema,
    description: trimmedNonEmptyString.optional(),
  })
  .strict()
  .refine((product) => (product.net_content_value == null) === (product.net_content_unit == null), {
    path: ["net_content_unit"],
    message: "net_content_value and net_content_unit must be supplied together",
  })

// ---------------------------------------------------------------------------
// final.protocols
// ---------------------------------------------------------------------------

const protocolSourceSchema = z
  .object({
    label: trimmedNonEmptyString,
    url: urlString,
    text: trimmedNonEmptyString,
  })
  .strict()

const protocolDeviationSchema = z
  .object({
    reason: trimmedNonEmptyString,
    packaging_text: trimmedNonEmptyString,
  })
  .strict()

const protocolContactTimeSchema = z
  .object({
    seconds: z.number().int().positive().nullable(),
    source_text: trimmedNonEmptyString,
  })
  .strict()

export const expansionProtocolSchema = z
  .object({
    template_id: z.enum(EXPANSION_TEMPLATE_IDS),
    product_source: protocolSourceSchema,
    deviation: protocolDeviationSchema.nullable(),
    contact_time: protocolContactTimeSchema.optional(),
    usable_on_dry_hair: z.boolean().optional(),
  })
  .strict()
  .superRefine((protocol, ctx) => {
    const isMask = protocol.template_id === MASK_TEMPLATE_ID
    if (isMask && !protocol.contact_time) {
      ctx.addIssue({
        code: "custom",
        path: ["contact_time"],
        message: "TPL-MASK protocols require contact_time",
      })
    }
    if (!isMask && protocol.contact_time) {
      ctx.addIssue({
        code: "custom",
        path: ["contact_time"],
        message: "contact_time is only valid for TPL-MASK",
      })
    }

    const isHeat = HEAT_TEMPLATE_IDS.has(protocol.template_id)
    if (isHeat && protocol.usable_on_dry_hair === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["usable_on_dry_hair"],
        message: "TPL-LEAVEIN-HEAT / TPL-OIL-HEAT protocols require usable_on_dry_hair",
      })
    }
    if (!isHeat && protocol.usable_on_dry_hair !== undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["usable_on_dry_hair"],
        message: "usable_on_dry_hair is only valid for TPL-LEAVEIN-HEAT / TPL-OIL-HEAT",
      })
    }
  })

export type ExpansionProtocol = z.infer<typeof expansionProtocolSchema>

// ---------------------------------------------------------------------------
// final.evidence — rows shaped for personal_plan_catalog_fact_evidence
// ---------------------------------------------------------------------------

export const expansionEvidenceRowSchema = z
  .object({
    fact_key: trimmedNonEmptyString,
    fact_value: z.unknown(),
    source_label: trimmedNonEmptyString,
    source_url: urlString,
    source_type: z.enum(["manufacturer", "retailer", "professional_authority"]),
    // Verbatim quote from the source backing this fact. Optional in the manifest
    // (the apply builder can derive it from a protocol source on the same URL),
    // but personal_plan_catalog_fact_evidence.source_text is NOT NULL, so a
    // product with neither a quote nor a derivable fallback is parked at preflight.
    source_text: trimmedNonEmptyString.optional(),
    checked_at: isoDateOnlyString,
  })
  .strict()

// ---------------------------------------------------------------------------
// Per-product manifest entry
// ---------------------------------------------------------------------------

export const expansionManifestProductSchema = z
  .object({
    final: z
      .object({
        product: expansionFinalProductSchema,
        identifiers: z.array(expansionEanIdentifierSchema).min(1),
        category_specs: z.record(z.string(), z.unknown()),
        thickness_eligibility: z.array(z.enum(HAIR_THICKNESSES)).min(1),
        concern_eligibility: z.array(trimmedNonEmptyString),
        protocols: z.array(expansionProtocolSchema).min(1),
        evidence: z.array(expansionEvidenceRowSchema).min(1),
        field_rationales: z.record(z.string(), trimmedNonEmptyString),
      })
      .strict(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    const { product, category_specs, protocols, concern_eligibility } = entry.final
    const categoryKey = product.category_key

    // Reuse the live category-specs structural validator (category-validators.ts) —
    // the same function the Product Intake approval path calls.
    const specsResult = validateProductIntakeCategorySpecs(categoryKey, category_specs)
    if (!specsResult.ok) {
      for (const path of specsResult.missingFields) {
        ctx.addIssue({
          code: "custom",
          path: path.split("."),
          message: "invalid or missing category spec field",
        })
      }
    }

    // F-03 tightening: fields nullable in the generic validator but consumed as
    // required non-null by the strict readiness oracle.
    for (const path of runtimeConsumedNullViolations(categoryKey, category_specs)) {
      ctx.addIssue({
        code: "custom",
        path: ["final", "category_specs", ...path],
        message: "runtime-consumed field must not be null (F-03)",
      })
    }

    // Concern eligibility must be a recognized catalog concern code. NOTE: we deliberately
    // do NOT use `getAllowedProductConcernCodes` from concern-taxonomy.ts here — its
    // isShampooCategory/isMaskCategory/isOilCategory guards match legacy display-name
    // category strings ("Shampoo", "Maske", "Öle"), not the category_key enum values
    // ("shampoo", "mask", "oil") this manifest and category-validators.ts use, so it
    // silently returns [] for exactly those three categories (verified). Using it would
    // incorrectly reject every concern for shampoo/mask/oil products.
    concern_eligibility.forEach((concern, index) => {
      if (!isProductConcernCode(concern)) {
        ctx.addIssue({
          code: "custom",
          path: ["final", "concern_eligibility", index],
          message: `"${concern}" is not a recognized product concern code`,
        })
      }
    })

    // Protocol role coverage: every role the reviewed facts require must be stamped.
    // Guarded with getTemplateMeta because an unrecognized template_id may still reach
    // this superRefine (zod runs effects on "dirty" data, not only fully-valid data) —
    // the z.enum(EXPANSION_TEMPLATE_IDS) check already reports that as its own issue.
    if (specsResult.ok) {
      const requiredRoles = deriveRequiredProtocolRoles(categoryKey, category_specs)
      const stampedRoles = new Set(
        protocols.flatMap((protocol) => {
          const meta = getTemplateMeta(protocol.template_id)
          return meta && meta.category === categoryKey ? [meta.role] : []
        }),
      )
      for (const role of requiredRoles) {
        if (!stampedRoles.has(role)) {
          ctx.addIssue({
            code: "custom",
            path: ["final", "protocols"],
            message: `no protocol stamps the derived role "${role}" required for category "${categoryKey}"`,
          })
        }
      }
    }

    // Every protocol's template must belong to the product's own category.
    protocols.forEach((protocol, index) => {
      const meta = getTemplateMeta(protocol.template_id)
      if (meta && meta.category !== categoryKey) {
        ctx.addIssue({
          code: "custom",
          path: ["final", "protocols", index, "template_id"],
          message: `template "${protocol.template_id}" belongs to category "${meta.category}", not "${categoryKey}"`,
        })
      }
    })
  })

export type ExpansionManifestProduct = z.infer<typeof expansionManifestProductSchema>

/**
 * F-03 non-null tightening for fields the generic category-validators.ts schema
 * allows to be null/absent but the strict readiness oracle reads as required:
 *  - shampoo: per-row `cleansing_intensity` (product_shampoo_specs[].cleansing_intensity)
 *  - conditioner: `product_conditioner_rerank_specs.balance_direction`
 *  - mask: `product_mask_specs.balance_direction`
 * leave_in and oil runtime-consumed fields listed in the plan (format, weight,
 * care_direction, repair_support_level, plan_roles, application_stage, role_support)
 * are already required non-null by the generic schemas in category-validators.ts, so
 * no extra tightening is needed for them here.
 */
function runtimeConsumedNullViolations(
  categoryKey: ExpansionCategoryKey,
  categorySpecs: Record<string, unknown>,
): string[][] {
  const violations: string[][] = []

  if (categoryKey === "shampoo") {
    const rows = Array.isArray(categorySpecs.product_shampoo_specs)
      ? (categorySpecs.product_shampoo_specs as Array<Record<string, unknown>>)
      : []
    rows.forEach((row, index) => {
      if (row.cleansing_intensity == null) {
        violations.push(["product_shampoo_specs", String(index), "cleansing_intensity"])
      }
    })
  }

  if (categoryKey === "conditioner") {
    const rerank = categorySpecs.product_conditioner_rerank_specs as
      | { balance_direction?: unknown }
      | undefined
    if (rerank && rerank.balance_direction == null) {
      violations.push(["product_conditioner_rerank_specs", "balance_direction"])
    }
  }

  if (categoryKey === "mask") {
    const mask = categorySpecs.product_mask_specs as { balance_direction?: unknown } | undefined
    if (mask && mask.balance_direction == null) {
      violations.push(["product_mask_specs", "balance_direction"])
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// existing_product_updates (F-09 identity rule: same-formulation new EAN/size)
// ---------------------------------------------------------------------------

const renameSchema = z
  .object({
    from: trimmedNonEmptyString,
    to: trimmedNonEmptyString,
    reason: trimmedNonEmptyString,
  })
  .strict()

export const expansionExistingProductUpdateSchema = z
  .object({
    product_id: uuidString,
    add_identifiers: z.array(expansionEanIdentifierSchema).optional(),
    rename: renameSchema.optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    const hasAddIdentifiers = (entry.add_identifiers?.length ?? 0) > 0
    const hasRename = entry.rename !== undefined
    if (!hasAddIdentifiers && !hasRename) {
      ctx.addIssue({
        code: "custom",
        path: [],
        message: "existing_product_updates entry requires at least one action (add_identifiers or rename)",
      })
    }
  })

export type ExpansionExistingProductUpdate = z.infer<typeof expansionExistingProductUpdateSchema>

// ---------------------------------------------------------------------------
// Top-level manifest
// ---------------------------------------------------------------------------

export const expansionManifestSchema = z
  .object({
    batch_id: trimmedNonEmptyString,
    generated_at: isoDateString,
    products: z.array(expansionManifestProductSchema),
    existing_product_updates: z.array(expansionExistingProductUpdateSchema),
  })
  .strict()

export type ExpansionManifest = z.infer<typeof expansionManifestSchema>

// ---------------------------------------------------------------------------
// CLI-facing validation report
// ---------------------------------------------------------------------------

export type ExpansionManifestItemReport = {
  index: number
  label: string
  status: "pass" | "fail"
  violations: string[]
}

export type ExpansionManifestValidationReport = {
  ok: boolean
  batchId: string | null
  envelopeViolations: string[]
  products: ExpansionManifestItemReport[]
  existingProductUpdates: ExpansionManifestItemReport[]
  deviationFlagged: { index: number; label: string; templateIds: string[] }[]
  excludedEans: { index: number; label: string; value: string }[]
  duplicateEans: { value: string; occurrences: string[] }[]
  summary: {
    totalProducts: number
    productsPassed: number
    productsFailed: number
    deviationFlaggedCount: number
    excludedEanCount: number
    totalExistingProductUpdates: number
    existingProductUpdatesPassed: number
    existingProductUpdatesFailed: number
    duplicateEanCount: number
  }
}

function issueLines(issues: z.core.$ZodIssue[]): string[] {
  return issues.map((issue) => {
    const path = issue.path.map(String).join(".")
    return path.length > 0 ? `${path}: ${issue.message}` : issue.message
  })
}

function productLabel(raw: unknown, index: number): string {
  const product = (raw as { final?: { product?: { brand?: unknown; name?: unknown } } })?.final
    ?.product
  const brand = typeof product?.brand === "string" ? product.brand : undefined
  const name = typeof product?.name === "string" ? product.name : undefined
  if (brand && name) return `${brand} ${name}`
  if (name) return name
  return `products[${index}]`
}

/**
 * Validates a raw parsed-JSON expansion manifest and returns a structured report
 * suitable for CLI printing: per-product PASS/FAIL with named violations, the
 * deviation-flagged product list, the excluded-EAN list, and a summary. Exit-code
 * decisions belong to the caller (the CLI sets exit 1 on `!report.ok`).
 */
export function validateExpansionManifest(raw: unknown): ExpansionManifestValidationReport {
  const envelope = z
    .object({
      batch_id: z.unknown(),
      generated_at: z.unknown(),
      products: z.array(z.unknown()).default([]),
      existing_product_updates: z.array(z.unknown()).default([]),
    })
    .safeParse(raw)

  const envelopeViolations: string[] = []
  const rawProducts: unknown[] = envelope.success ? envelope.data.products : []
  const rawUpdates: unknown[] = envelope.success ? envelope.data.existing_product_updates : []

  if (!envelope.success) {
    envelopeViolations.push(...issueLines(envelope.error.issues))
  } else {
    const batchIdResult = z.string().min(1).safeParse(envelope.data.batch_id)
    if (!batchIdResult.success) envelopeViolations.push("batch_id: required non-empty string")
    const generatedAtResult = isoDateString.safeParse(envelope.data.generated_at)
    if (!generatedAtResult.success)
      envelopeViolations.push("generated_at: must be an ISO-8601 datetime")
  }

  const batchId =
    envelope.success && typeof envelope.data.batch_id === "string" ? envelope.data.batch_id : null

  const products: ExpansionManifestItemReport[] = rawProducts.map((rawProduct, index) => {
    const result = expansionManifestProductSchema.safeParse(rawProduct)
    return {
      index,
      label: productLabel(rawProduct, index),
      status: result.success ? "pass" : "fail",
      violations: result.success ? [] : issueLines(result.error.issues),
    }
  })

  const existingProductUpdates: ExpansionManifestItemReport[] = rawUpdates.map((rawUpdate, index) => {
    const result = expansionExistingProductUpdateSchema.safeParse(rawUpdate)
    const productId = (rawUpdate as { product_id?: unknown })?.product_id
    return {
      index,
      label: typeof productId === "string" ? productId : `existing_product_updates[${index}]`,
      status: result.success ? "pass" : "fail",
      violations: result.success ? [] : issueLines(result.error.issues),
    }
  })

  const deviationFlagged: ExpansionManifestValidationReport["deviationFlagged"] = []
  const excludedEans: ExpansionManifestValidationReport["excludedEans"] = []
  const eanOccurrences = new Map<string, string[]>()

  rawProducts.forEach((rawProduct, index) => {
    const label = productLabel(rawProduct, index)
    const protocols = (rawProduct as { final?: { protocols?: unknown } })?.final?.protocols
    if (Array.isArray(protocols)) {
      const deviatedTemplateIds = protocols
        .filter(
          (protocol) =>
            protocol && typeof protocol === "object" && (protocol as { deviation?: unknown }).deviation,
        )
        .map((protocol) => String((protocol as { template_id?: unknown }).template_id))
      if (deviatedTemplateIds.length > 0) {
        deviationFlagged.push({ index, label, templateIds: deviatedTemplateIds })
      }
    }

    const identifiers = (rawProduct as { final?: { identifiers?: unknown } })?.final?.identifiers
    if (Array.isArray(identifiers)) {
      for (const identifier of identifiers) {
        if (!identifier || typeof identifier !== "object") continue
        const value = (identifier as { value?: unknown }).value
        if (typeof value !== "string") continue
        const occurrences = eanOccurrences.get(value) ?? []
        occurrences.push(label)
        eanOccurrences.set(value, occurrences)
        if ((identifier as { excluded_from_apply?: unknown }).excluded_from_apply === true) {
          excludedEans.push({ index, label, value })
        }
      }
    }
  })

  rawUpdates.forEach((rawUpdate) => {
    const productId = (rawUpdate as { product_id?: unknown })?.product_id
    const label = typeof productId === "string" ? productId : "existing_product_update"
    const addIdentifiers = (rawUpdate as { add_identifiers?: unknown })?.add_identifiers
    if (Array.isArray(addIdentifiers)) {
      for (const identifier of addIdentifiers) {
        if (!identifier || typeof identifier !== "object") continue
        const value = (identifier as { value?: unknown }).value
        if (typeof value !== "string") continue
        const occurrences = eanOccurrences.get(value) ?? []
        occurrences.push(label)
        eanOccurrences.set(value, occurrences)
      }
    }
  })

  const duplicateEans = [...eanOccurrences.entries()]
    .filter(([, occurrences]) => occurrences.length > 1)
    .map(([value, occurrences]) => ({ value, occurrences }))

  const productsFailed = products.filter((product) => product.status === "fail").length
  const existingProductUpdatesFailed = existingProductUpdates.filter(
    (update) => update.status === "fail",
  ).length

  const ok =
    envelopeViolations.length === 0 && productsFailed === 0 && existingProductUpdatesFailed === 0 &&
    duplicateEans.length === 0

  return {
    ok,
    batchId,
    envelopeViolations,
    products,
    existingProductUpdates,
    deviationFlagged,
    excludedEans,
    duplicateEans,
    summary: {
      totalProducts: products.length,
      productsPassed: products.length - productsFailed,
      productsFailed,
      deviationFlaggedCount: deviationFlagged.length,
      excludedEanCount: excludedEans.length,
      totalExistingProductUpdates: existingProductUpdates.length,
      existingProductUpdatesPassed: existingProductUpdates.length - existingProductUpdatesFailed,
      existingProductUpdatesFailed,
      duplicateEanCount: duplicateEans.length,
    },
  }
}

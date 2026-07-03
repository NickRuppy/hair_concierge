import { z } from "zod"

import { PRODUCT_BALANCE_TARGETS } from "@/lib/product-specs/constants"
import {
  PRODUCT_BOND_APPLICATION_MODES,
  PRODUCT_BOND_PRODUCT_FORMATS,
  PRODUCT_BOND_REPAIR_AXES,
  PRODUCT_BOND_REPAIR_INTENSITIES,
  PRODUCT_BOND_TREATMENT_MODES,
  PRODUCT_BOND_USAGE_PROTOCOLS,
  DRY_SHAMPOO_FORMATS,
  DRY_SHAMPOO_HAIR_COLOR_FITS,
  DRY_SHAMPOO_PRIMARY_EFFECTS,
  DRY_SHAMPOO_SCALP_SENSITIVITY_FITS,
  PRODUCT_SCALP_TYPE_FOCUSES,
} from "@/lib/product-specs/constants"
import {
  DEEP_CLEANSING_COLOR_TREATED_SUITABILITIES,
  DEEP_CLEANSING_RESET_FOCUSES,
  DEEP_CLEANSING_RESET_INTENSITIES,
} from "@/lib/deep-cleansing-shampoo/constants"
import {
  CONDITIONER_INGREDIENT_FLAGS,
  CONDITIONER_REPAIR_LEVELS,
  CONDITIONER_WEIGHTS,
} from "@/lib/conditioner/constants"
import {
  LEAVE_IN_APPLICATION_STAGES,
  LEAVE_IN_CARE_BENEFITS,
  LEAVE_IN_CONDITIONER_RELATIONSHIPS,
  LEAVE_IN_FIT_CARE_BENEFITS,
  LEAVE_IN_FORMATS,
  LEAVE_IN_INGREDIENT_FLAGS,
  LEAVE_IN_NEED_BUCKETS,
  LEAVE_IN_ROLES,
  LEAVE_IN_WEIGHTS,
} from "@/lib/leave-in/constants"
import { MASK_CONCENTRATIONS, MASK_INGREDIENT_FLAGS, MASK_WEIGHTS } from "@/lib/mask/constants"
import { OIL_INGREDIENT_FLAGS, OIL_PURPOSES, OIL_SUBTYPES } from "@/lib/oil/constants"
import { SHAMPOO_BUCKETS } from "@/lib/shampoo/constants"
import { HAIR_THICKNESSES, PROTEIN_MOISTURE_LEVELS } from "@/lib/vocabulary"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"

export const PRODUCT_INTAKE_PRODUCT_ID_PLACEHOLDER = "__PRODUCT_ID__" as const

export const PRODUCT_INTAKE_REVIEW_CATEGORY_KEYS = SUPPORTED_PRODUCT_CATEGORY_KEYS

export type ProductIntakeReviewCategoryKey = (typeof PRODUCT_INTAKE_REVIEW_CATEGORY_KEYS)[number]

export type ProductIntakeTargetSpecTable =
  | "product_shampoo_specs"
  | "product_conditioner_specs"
  | "product_conditioner_rerank_specs"
  | "product_mask_specs"
  | "product_leave_in_specs"
  | "product_leave_in_fit_specs"
  | "product_leave_in_eligibility"
  | "product_oil_eligibility"
  | "product_dry_shampoo_specs"
  | "product_deep_cleansing_shampoo_specs"
  | "product_bondbuilder_specs"

type ProductIntakeSpecRowByTable = {
  product_shampoo_specs: {
    thickness: string
    shampoo_bucket: string
    scalp_route: string
    cleansing_intensity?: string | null
  }
  product_conditioner_specs: {
    thickness: string
    protein_moisture_balance: string
  }
  product_conditioner_rerank_specs: {
    weight: string
    repair_level: string
    balance_direction: string | null
    ingredient_flags: string[]
  }
  product_mask_specs: {
    weight: string
    concentration: string
    balance_direction: string | null
    ingredient_flags: string[]
  }
  product_leave_in_specs: {
    format: string
    weight: string
    roles: string[]
    provides_heat_protection: boolean
    heat_protection_max_c: number | null
    heat_activation_required: boolean
    care_benefits: string[]
    ingredient_flags: string[]
    application_stage: string[]
  }
  product_leave_in_fit_specs: {
    weight: string
    conditioner_relationship: string
    care_benefits: string[]
  }
  product_leave_in_eligibility: {
    thickness: string
    need_bucket: string
    styling_context: string
  }
  product_oil_eligibility: {
    thickness: string
    oil_subtype: string
    oil_purpose: string | null
    ingredient_flags: string[]
  }
  product_dry_shampoo_specs: {
    primary_effect: string
    hair_color_fit: string
    scalp_sensitivity_fit: string
    format: string
  }
  product_deep_cleansing_shampoo_specs: {
    scalp_type_focus: string
    reset_intensity: string
    reset_focus: string
    color_treated_suitability: string
  }
  product_bondbuilder_specs: {
    bond_repair_intensity: string
    application_mode: string
    bond_repair_axis: string
    treatment_mode: string
    product_format: string
    usage_protocol: string
  }
}

export type ProductIntakeTargetSpecRow<
  T extends ProductIntakeTargetSpecTable = ProductIntakeTargetSpecTable,
> = ProductIntakeSpecRowByTable[T] & {
  product_id: typeof PRODUCT_INTAKE_PRODUCT_ID_PLACEHOLDER
}

export type ProductIntakeTargetSpecOperation = {
  [Table in ProductIntakeTargetSpecTable]: {
    type: "upsert"
    table: Table
    rows: Array<ProductIntakeTargetSpecRow<Table>>
  }
}[ProductIntakeTargetSpecTable]

const trimmedString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1),
)

const optionalNullableTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}, z.string().min(1).nullable().optional())

const isoDateString = z.string().datetime({ offset: true })
const currencyString = z.literal("EUR")
const urlString = z.string().url()
const productIdPlaceholder = PRODUCT_INTAKE_PRODUCT_ID_PLACEHOLDER
const identifierTypeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(["ean", "gtin", "barcode", "retailer_sku", "retailer_url"]),
)
const barcodeIdentifierTypes = new Set(["ean", "gtin", "barcode"])

const sourceSchema = z
  .object({
    url: urlString,
    title: trimmedString,
    evidence: trimmedString,
  })
  .strict()

const identifierSchema = z
  .object({
    type: identifierTypeSchema,
    value: trimmedString,
    source: optionalNullableTrimmedString,
  })
  .strict()
  .transform((identifier) => ({
    ...identifier,
    value: barcodeIdentifierTypes.has(identifier.type)
      ? identifier.value.replace(/[^\p{Letter}\p{Number}]+/gu, "")
      : identifier.value,
  }))

const reviewedProductSchema = z
  .object({
    canonical_brand: trimmedString,
    product_line: optionalNullableTrimmedString,
    clean_name: trimmedString,
    category_key: z.enum(PRODUCT_INTAKE_REVIEW_CATEGORY_KEYS),
    affiliate_link: urlString,
    image_url: urlString.nullable(),
    price_eur: z.number().finite().nonnegative(),
    currency: currencyString,
    purchase_link_status: z.enum(["available", "unavailable"]),
    purchase_link_checked_at: isoDateString,
    price_checked_at: isoDateString,
  })
  .strict()

const finalPayloadSchema = z
  .object({
    product: reviewedProductSchema,
    identifiers: z.array(identifierSchema).default([]),
    category_specs: z.record(z.string(), z.unknown()),
    sources: z.array(sourceSchema).min(1),
    field_rationales: z.record(z.string(), trimmedString),
    review: z
      .object({
        manual_reviewed: z.literal(true),
        reviewed_by: trimmedString.optional(),
        reviewed_at: isoDateString.optional(),
        notes: trimmedString.optional(),
      })
      .strict(),
  })
  .strict()

const researchedPayloadSchema = z
  .object({
    draft: z.unknown().optional(),
    final: finalPayloadSchema.optional(),
  })
  .strict()

const approvalPayloadSchema = researchedPayloadSchema.extend({
  final: finalPayloadSchema,
})

export type ProductIntakeFinalReviewedPayload = z.infer<typeof finalPayloadSchema>
export type ProductIntakeResearchedPayload = z.infer<typeof researchedPayloadSchema>

export type ProductIntakeResearchedPayloadParseResult =
  | {
      ok: true
      missingFields: []
      payload: ProductIntakeResearchedPayload
    }
  | {
      ok: false
      missingFields: string[]
      payload: null
    }

export type ProductIntakeApprovalValidationResult =
  | {
      ok: true
      missingFields: []
      normalizedPayload: ProductIntakeResearchedPayload & {
        final: ProductIntakeFinalReviewedPayload
      }
      targetSpecOperations: ProductIntakeTargetSpecOperation[]
    }
  | {
      ok: false
      missingFields: string[]
      normalizedPayload: null
      targetSpecOperations: []
    }

export type ProductIntakeCategoryApprovalValidator = (
  finalPayload: ProductIntakeFinalReviewedPayload,
) => ProductIntakeApprovalValidationResult

function issuePath(issue: z.core.$ZodIssue, prefix: string[] = []): string {
  const path = [...prefix, ...issue.path].map(String)
  return path.length > 0 ? path.join(".") : "payload"
}

function uniquePaths(paths: string[]): string[] {
  return Array.from(new Set(paths))
}

function parseErrors(error: z.ZodError, prefix: string[] = []): string[] {
  return uniquePaths(error.issues.map((issue) => issuePath(issue, prefix)))
}

export function parseProductIntakeResearchedPayload(
  value: unknown,
): ProductIntakeResearchedPayloadParseResult {
  const parsed = researchedPayloadSchema.safeParse(value)
  if (!parsed.success) {
    return {
      ok: false,
      missingFields: parseErrors(parsed.error),
      payload: null,
    }
  }

  return {
    ok: true,
    missingFields: [],
    payload: parsed.data,
  }
}

function withProductId<Table extends ProductIntakeTargetSpecTable>(
  row: ProductIntakeSpecRowByTable[Table],
): ProductIntakeTargetSpecRow<Table> {
  return {
    product_id: productIdPlaceholder,
    ...row,
  }
}

function upsert<Table extends ProductIntakeTargetSpecTable>(
  table: Table,
  rows: Array<ProductIntakeSpecRowByTable[Table]>,
): Extract<ProductIntakeTargetSpecOperation, { table: Table }> {
  return {
    type: "upsert",
    table,
    rows: rows.map(withProductId),
  } as unknown as Extract<ProductIntakeTargetSpecOperation, { table: Table }>
}

function invalidCategoryResult(missingFields: string[]): ProductIntakeApprovalValidationResult {
  return {
    ok: false,
    missingFields: uniquePaths(missingFields),
    normalizedPayload: null,
    targetSpecOperations: [],
  }
}

function validCategoryResult(
  finalPayload: ProductIntakeFinalReviewedPayload,
  targetSpecOperations: ProductIntakeTargetSpecOperation[],
): ProductIntakeApprovalValidationResult {
  return {
    ok: true,
    missingFields: [],
    normalizedPayload: { final: finalPayload },
    targetSpecOperations,
  }
}

const REQUIRED_REVIEWED_PRODUCT_RATIONALES = [
  "product.canonical_brand",
  "product.clean_name",
  "product.category_key",
  "product.affiliate_link",
  "product.image_url",
  "product.price_eur",
  "product.purchase_link_status",
]

function validateFieldRationales(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult | null {
  const missing = REQUIRED_REVIEWED_PRODUCT_RATIONALES.filter(
    (key) => !finalPayload.field_rationales[key],
  )

  for (const key of Object.keys(finalPayload.category_specs)) {
    const rationaleKey = `category_specs.${key}`
    if (!finalPayload.field_rationales[rationaleKey]) {
      missing.push(rationaleKey)
    }
  }

  return missing.length > 0
    ? invalidCategoryResult(missing.map((key) => `final.field_rationales.${key}`))
    : null
}

function validateSpecs<T>(
  finalPayload: ProductIntakeFinalReviewedPayload,
  schema: z.ZodType<T>,
): { ok: true; specs: T } | { ok: false; missingFields: string[] } {
  const parsed = schema.safeParse(finalPayload.category_specs)
  if (!parsed.success) {
    return {
      ok: false,
      missingFields: parseErrors(parsed.error, ["final", "category_specs"]),
    }
  }

  return { ok: true, specs: parsed.data }
}

const scalpRouteSchema = z.enum(["oily", "balanced", "dry", "dandruff", "dry_flakes", "irritated"])
const cleansingIntensitySchema = z.enum(["gentle", "regular", "clarifying"])

function scalpRouteMatchesShampooBucket(
  bucket: (typeof SHAMPOO_BUCKETS)[number],
  route: z.infer<typeof scalpRouteSchema>,
): boolean {
  switch (bucket) {
    case "dehydriert-fettig":
      return route === "oily"
    case "irritationen":
      return route === "irritated"
    case "normal":
      return route === "balanced"
    case "schuppen":
      return route === "dandruff" || route === "dry_flakes"
    case "trocken":
      return route === "dry"
  }
}

const shampooRowSchema = z
  .object({
    thickness: z.enum(HAIR_THICKNESSES),
    shampoo_bucket: z.enum(SHAMPOO_BUCKETS),
    scalp_route: scalpRouteSchema,
    cleansing_intensity: cleansingIntensitySchema.nullable().optional(),
  })
  .strict()
  .superRefine((row, ctx) => {
    if (!scalpRouteMatchesShampooBucket(row.shampoo_bucket, row.scalp_route)) {
      ctx.addIssue({
        code: "custom",
        path: ["scalp_route"],
        message: "scalp_route must match shampoo_bucket",
      })
    }
  })

const shampooSpecsSchema = z
  .object({
    product_shampoo_specs: z.array(shampooRowSchema).min(1),
    cleansing_intensity: cleansingIntensitySchema.nullable().optional(),
  })
  .strict()

const conditionerSpecsSchema = z
  .object({
    product_conditioner_specs: z
      .array(
        z
          .object({
            thickness: z.enum(HAIR_THICKNESSES),
            protein_moisture_balance: z.enum(PROTEIN_MOISTURE_LEVELS),
          })
          .strict(),
      )
      .min(1),
    product_conditioner_rerank_specs: z
      .object({
        weight: z.enum(CONDITIONER_WEIGHTS),
        repair_level: z.enum(CONDITIONER_REPAIR_LEVELS),
        balance_direction: z.enum(PRODUCT_BALANCE_TARGETS).nullable(),
        ingredient_flags: z.array(z.enum(CONDITIONER_INGREDIENT_FLAGS)),
      })
      .strict(),
  })
  .strict()

const maskSpecsSchema = z
  .object({
    product_mask_specs: z
      .object({
        weight: z.enum(MASK_WEIGHTS),
        concentration: z.enum(MASK_CONCENTRATIONS),
        balance_direction: z.enum(PRODUCT_BALANCE_TARGETS).nullable(),
        ingredient_flags: z.array(z.enum(MASK_INGREDIENT_FLAGS)),
      })
      .strict(),
  })
  .strict()

const leaveInStylingContextSchema = z.enum(["air_dry", "non_heat_style", "heat_style"])

const leaveInSpecsSchema = z
  .object({
    product_leave_in_specs: z
      .object({
        format: z.enum(LEAVE_IN_FORMATS),
        weight: z.enum(LEAVE_IN_WEIGHTS),
        roles: z.array(z.enum(LEAVE_IN_ROLES)).min(1),
        provides_heat_protection: z.boolean(),
        heat_protection_max_c: z.number().int().positive().nullable(),
        heat_activation_required: z.boolean(),
        care_benefits: z.array(z.enum(LEAVE_IN_CARE_BENEFITS)).min(1),
        ingredient_flags: z.array(z.enum(LEAVE_IN_INGREDIENT_FLAGS)),
        application_stage: z.array(z.enum(LEAVE_IN_APPLICATION_STAGES)).min(1),
      })
      .strict(),
    product_leave_in_fit_specs: z
      .object({
        weight: z.enum(LEAVE_IN_WEIGHTS),
        conditioner_relationship: z.enum(LEAVE_IN_CONDITIONER_RELATIONSHIPS),
        care_benefits: z.array(z.enum(LEAVE_IN_FIT_CARE_BENEFITS)).min(1),
      })
      .strict(),
    product_leave_in_eligibility: z
      .array(
        z
          .object({
            thickness: z.enum(HAIR_THICKNESSES),
            need_bucket: z.enum(LEAVE_IN_NEED_BUCKETS),
            styling_context: leaveInStylingContextSchema,
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

const oilSpecsSchema = z
  .object({
    product_oil_eligibility: z
      .array(
        z
          .object({
            thickness: z.enum(HAIR_THICKNESSES),
            oil_subtype: z.enum(OIL_SUBTYPES),
            oil_purpose: z.enum(OIL_PURPOSES).nullable(),
            ingredient_flags: z.array(z.enum(OIL_INGREDIENT_FLAGS)),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()

const dryShampooSpecsSchema = z
  .object({
    product_dry_shampoo_specs: z
      .object({
        primary_effect: z.enum(DRY_SHAMPOO_PRIMARY_EFFECTS),
        hair_color_fit: z.enum(DRY_SHAMPOO_HAIR_COLOR_FITS),
        scalp_sensitivity_fit: z.enum(DRY_SHAMPOO_SCALP_SENSITIVITY_FITS),
        format: z.enum(DRY_SHAMPOO_FORMATS),
      })
      .strict(),
  })
  .strict()

const deepCleansingShampooSpecsSchema = z
  .object({
    product_deep_cleansing_shampoo_specs: z
      .object({
        scalp_type_focus: z.enum(PRODUCT_SCALP_TYPE_FOCUSES),
        reset_intensity: z.enum(DEEP_CLEANSING_RESET_INTENSITIES),
        reset_focus: z.enum(DEEP_CLEANSING_RESET_FOCUSES),
        color_treated_suitability: z.enum(DEEP_CLEANSING_COLOR_TREATED_SUITABILITIES),
      })
      .strict(),
  })
  .strict()

const bondbuilderSpecsSchema = z
  .object({
    product_bondbuilder_specs: z
      .object({
        bond_repair_intensity: z.enum(PRODUCT_BOND_REPAIR_INTENSITIES),
        application_mode: z.enum(PRODUCT_BOND_APPLICATION_MODES),
        bond_repair_axis: z.enum(PRODUCT_BOND_REPAIR_AXES),
        treatment_mode: z.enum(PRODUCT_BOND_TREATMENT_MODES),
        product_format: z.enum(PRODUCT_BOND_PRODUCT_FORMATS),
        usage_protocol: z.enum(PRODUCT_BOND_USAGE_PROTOCOLS),
      })
      .strict(),
    product_relationships: z.unknown().optional(),
  })
  .strict()

function hasOwn(object: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(object, key)
}

function validateShampoo(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, shampooSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  const specs = parsed.specs
  const rows: Array<ProductIntakeSpecRowByTable["product_shampoo_specs"]> =
    specs.product_shampoo_specs.map((row) => {
      const operationRow: ProductIntakeSpecRowByTable["product_shampoo_specs"] = {
        thickness: row.thickness,
        shampoo_bucket: row.shampoo_bucket,
        scalp_route: row.scalp_route,
      }

      if (hasOwn(row, "cleansing_intensity")) {
        operationRow.cleansing_intensity = row.cleansing_intensity
      }

      return operationRow
    })

  return validCategoryResult(finalPayload, [upsert("product_shampoo_specs", rows)])
}

function validateConditioner(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, conditionerSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  const specs = parsed.specs
  return validCategoryResult(finalPayload, [
    upsert("product_conditioner_specs", specs.product_conditioner_specs),
    upsert("product_conditioner_rerank_specs", [specs.product_conditioner_rerank_specs]),
  ])
}

function validateMask(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, maskSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  return validCategoryResult(finalPayload, [
    upsert("product_mask_specs", [parsed.specs.product_mask_specs]),
  ])
}

function validateLeaveIn(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, leaveInSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  const specs = parsed.specs
  return validCategoryResult(finalPayload, [
    upsert("product_leave_in_specs", [specs.product_leave_in_specs]),
    upsert("product_leave_in_fit_specs", [specs.product_leave_in_fit_specs]),
    upsert("product_leave_in_eligibility", specs.product_leave_in_eligibility),
  ])
}

function validateOil(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, oilSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  return validCategoryResult(finalPayload, [
    upsert("product_oil_eligibility", parsed.specs.product_oil_eligibility),
  ])
}

function validateDryShampoo(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, dryShampooSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  return validCategoryResult(finalPayload, [
    upsert("product_dry_shampoo_specs", [parsed.specs.product_dry_shampoo_specs]),
  ])
}

function validateDeepCleansingShampoo(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, deepCleansingShampooSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  return validCategoryResult(finalPayload, [
    upsert("product_deep_cleansing_shampoo_specs", [
      parsed.specs.product_deep_cleansing_shampoo_specs,
    ]),
  ])
}

function validateBondbuilder(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, bondbuilderSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  return validCategoryResult(finalPayload, [
    upsert("product_bondbuilder_specs", [parsed.specs.product_bondbuilder_specs]),
  ])
}

export const PRODUCT_INTAKE_CATEGORY_APPROVAL_VALIDATORS = {
  shampoo: validateShampoo,
  conditioner: validateConditioner,
  mask: validateMask,
  leave_in: validateLeaveIn,
  oil: validateOil,
  dry_shampoo: validateDryShampoo,
  deep_cleansing_shampoo: validateDeepCleansingShampoo,
  bondbuilder: validateBondbuilder,
} satisfies Record<ProductIntakeReviewCategoryKey, ProductIntakeCategoryApprovalValidator>

export function validateProductIntakeApprovalPayload(
  value: unknown,
): ProductIntakeApprovalValidationResult {
  const parsed = approvalPayloadSchema.safeParse(value)
  if (!parsed.success) {
    return invalidCategoryResult(parseErrors(parsed.error))
  }

  const finalPayload = parsed.data.final
  const rationaleValidation = validateFieldRationales(finalPayload)
  if (rationaleValidation) return rationaleValidation

  const categoryValidation =
    PRODUCT_INTAKE_CATEGORY_APPROVAL_VALIDATORS[finalPayload.product.category_key](finalPayload)

  if (!categoryValidation.ok) return categoryValidation

  return {
    ...categoryValidation,
    normalizedPayload: parsed.data,
  }
}

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
import { SHAMPOO_BUCKETS, SHAMPOO_SCALP_ROUTES_BY_BUCKET } from "@/lib/shampoo/constants"
import { HAIR_THICKNESSES, PROTEIN_MOISTURE_LEVELS } from "@/lib/vocabulary"
import { canonicalizeGtin, SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"
import { buildProductApplicationPointerV2 } from "@/lib/product-intake/catalog-enrichment/stage5-v2-builder"
import { deriveShampooProtocolRoles } from "@/lib/product-intake/shampoo-protocol-roles"
import { applicationGuidanceProtocolSchema } from "@/lib/routines/personal-plan/application/contracts"

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
  | "product_oil_specs"
  | "product_dry_shampoo_specs"
  | "product_deep_cleansing_shampoo_specs"
  | "product_bondbuilder_specs"
  | "product_heat_protectant_specs"
  | "product_scalp_care_specs"
  | "product_application_protocols"

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
    repair_support_level: "low" | "medium" | "high"
    functional_benefits: string[]
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
    care_direction: "moisture" | "balanced" | "protein"
    repair_support_level: "low" | "medium" | "high"
    plan_roles: string[]
    functional_benefits: string[]
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
  product_oil_specs: {
    weight: "light" | "medium" | "rich"
    role_support: string[]
    provides_heat_protection: boolean
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
  product_heat_protectant_specs: {
    format: "spray"
    provides_heat_protection: boolean | null
  }
  product_scalp_care_specs: {
    primary_role:
      | "scalp_comfort"
      | "scalp_flake_oil_adjunct"
      | "density_claim_tonic"
      | "scalp_exfoliant"
    presentation_format:
      | "serum"
      | "tonic"
      | "lotion_or_fluid"
      | "oil"
      | "scrub"
      | "other"
      | "unknown"
    rinse_mode: "leave_on" | "rinse_off"
    application_instructions: string
  }
  product_application_protocols: {
    category: ProductIntakeReviewCategoryKey
    role: string
    cadence: Record<string, unknown> | null
    application_stage: string | null
    application_state: "damp" | "dry" | "either" | null
    placement: string | null
    contact_time_seconds: number | null
    rinse_action: string | null
    reapplication: "required" | "optional" | "not_stated" | null
    instruction_modifiers: string[]
    source_label: string | null
    source_url: string | null
    source_text: string | null
    guidance_payload: Record<string, unknown>
    guidance_payload_v2?: Record<string, unknown>
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

const nullableTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}, z.string().min(1).nullable())

const isoDateString = z.string().datetime({ offset: true })
const currencyString = z.literal("EUR")
const netContentUnit = z.enum(["ml", "g"])
const urlString = z.string().url()
const productIdPlaceholder = PRODUCT_INTAKE_PRODUCT_ID_PLACEHOLDER
const identifierTypeSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.enum(["ean", "gtin", "barcode", "manufacturer_sku", "retailer_sku", "retailer_url"]),
)
const barcodeIdentifierTypes = new Set(["ean", "gtin", "barcode"])

const sourceSchema = z
  .object({
    url: urlString,
    title: trimmedString,
    evidence: trimmedString,
  })
  .strict()

const identifierBaseSchema = z
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

const identifierSchema = identifierBaseSchema.superRefine((identifier, ctx) => {
  if (!barcodeIdentifierTypes.has(identifier.type)) return
  if (canonicalizeGtin(identifier.value) === null) {
    ctx.addIssue({
      code: "custom",
      path: ["value"],
      message: "barcode identifiers must be valid GS1 GTIN-8/12/13/14 values",
    })
  }
})

const reviewedProductSchema = z
  .object({
    canonical_brand: trimmedString,
    product_line: optionalNullableTrimmedString,
    clean_name: trimmedString,
    category_key: z.enum(PRODUCT_INTAKE_REVIEW_CATEGORY_KEYS),
    suitable_thicknesses: z.array(z.enum(HAIR_THICKNESSES)).optional(),
    affiliate_link: urlString,
    image_url: urlString.nullable(),
    canonical_image_sha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .optional(),
    thumbnail_image_url: urlString.nullable().optional(),
    price_eur: z.number().finite().nonnegative(),
    currency: currencyString,
    purchase_link_status: z.enum(["available", "unavailable"]),
    purchase_link_checked_at: isoDateString,
    price_checked_at: isoDateString,
    net_content_value: z.number().finite().positive().nullable().optional(),
    net_content_unit: netContentUnit.nullable().optional(),
  })
  .strict()
  .refine((product) => (product.net_content_value == null) === (product.net_content_unit == null), {
    path: ["net_content_value"],
    message: "net content value and unit must be supplied together",
  })

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

const legacyFinalPayloadSchema = finalPayloadSchema.extend({
  identifiers: z.array(identifierBaseSchema).default([]),
})

const legacyApprovalPayloadSchema = researchedPayloadSchema.extend({
  final: legacyFinalPayloadSchema,
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
  return (SHAMPOO_SCALP_ROUTES_BY_BUCKET[bucket] as readonly string[]).includes(route)
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
        repair_support_level: z.enum(["low", "medium", "high"]),
        functional_benefits: z
          .array(z.enum(["smoothing_frizz_control", "detangling_slip", "shine"]))
          .min(1),
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
        care_direction: z.enum(["moisture", "balanced", "protein"]),
        repair_support_level: z.enum(["low", "medium", "high"]),
        plan_roles: z.array(z.enum(["post_wash_leave_in", "pre_heat_application"])).min(1),
        functional_benefits: z
          .array(
            z.enum([
              "detangle",
              "moisture_softness",
              "smooth_anti_frizz",
              "heat_protect",
              "repair_support",
              "curl_shape_support",
              "shine_support",
            ]),
          )
          .min(1),
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
    product_oil_specs: z
      .object({
        weight: z.enum(["light", "medium", "rich"]),
        role_support: z
          .array(z.enum(["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"]))
          .min(1),
        provides_heat_protection: z.boolean(),
      })
      .strict(),
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

const heatProtectantSpecSchema = z
  .object({
    format: z.literal("spray"),
    provides_heat_protection: z.boolean().nullable(),
  })
  .strict()

const scalpCareRoleSchema = z.enum([
  "scalp_comfort",
  "scalp_flake_oil_adjunct",
  "density_claim_tonic",
  "scalp_exfoliant",
])

const canonicalGuidancePayloadSchema = z
  .unknown()
  .superRefine((value, context) => {
    if (!value || typeof value !== "object") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Canonical guidance payload is required",
      })
      return
    }
    const payload = value as Record<string, unknown>
    const scope = payload.scope
    const normalized =
      scope &&
      typeof scope === "object" &&
      (scope as Record<string, unknown>).productId === PRODUCT_INTAKE_PRODUCT_ID_PLACEHOLDER
        ? {
            ...payload,
            scope: {
              ...(scope as Record<string, unknown>),
              productId: "00000000-0000-4000-8000-000000000001",
            },
          }
        : value
    const parsed = applicationGuidanceProtocolSchema.safeParse(normalized)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: issue.path, message: issue.message })
      }
    }
  })
  .transform((value) => value as Record<string, unknown>)

const REQUIRED_PROTOCOL_ROLES_BY_CATEGORY = {
  shampoo: ["shampoo_everyday", "shampoo_dandruff"],
  conditioner: ["conditioner_rinse_out"],
  leave_in: ["post_wash_leave_in", "pre_heat_protection"],
  mask: ["intensive_conditioning_mask"],
  oil: ["pre_wash_fibre_treatment", "leave_on_fibre_conditioning", "dry_finish"],
  dry_shampoo: ["root_refresh_bridge"],
  deep_cleansing_shampoo: ["residue_reset", "mineral_reset"],
  bondbuilder: ["specialized_bond_treatment"],
  heat_protectant: ["pre_heat_protection"],
  scalp_care: [
    "scalp_comfort",
    "scalp_flake_oil_adjunct",
    "density_claim_tonic",
    "scalp_exfoliant",
  ],
} as const satisfies Record<ProductIntakeReviewCategoryKey, readonly string[]>

// The indexed protocol columns hold machine enum codes (e.g. "wet_cleanse",
// "all_hair", "rinse_out"); user-facing prose belongs in guidance_payload copy.
// Mirrors the product_application_protocols_*_code_format_check DB constraints.
const nullableProtocolIndexCode = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  },
  z
    .string()
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
    .nullable(),
)

const applicationProtocolBaseSchema = z
  .object({
    cadence: z.record(z.string(), z.unknown()).nullable(),
    application_stage: nullableProtocolIndexCode,
    application_state: z.enum(["damp", "dry", "either"]).nullable(),
    placement: nullableProtocolIndexCode,
    contact_time_seconds: z.number().int().nonnegative().nullable(),
    rinse_action: nullableProtocolIndexCode,
    reapplication: z.enum(["required", "optional", "not_stated"]).nullable(),
    instruction_modifiers: z.array(trimmedString).default([]),
    source_label: nullableTrimmedString,
    source_url: z.string().url().nullable(),
    source_text: nullableTrimmedString,
    guidance_payload: canonicalGuidancePayloadSchema,
  })
  .strict()

const heatProtectantProtocolSchema = applicationProtocolBaseSchema
  .extend({
    category: z.literal("heat_protectant"),
    role: z.literal("pre_heat_protection"),
    application_state: z.enum(["damp", "dry", "either"]),
    reapplication: z.enum(["required", "optional", "not_stated"]),
  })
  .strict()

// The launch-v1 cohort manifests are fingerprint-frozen history and predate the
// snake_case rule for indexed protocol columns; only the legacy profile keeps
// accepting their prose values.
const legacyHeatProtectantProtocolSchema = applicationProtocolBaseSchema
  .omit({ guidance_payload: true })
  .extend({
    application_stage: nullableTrimmedString,
    placement: nullableTrimmedString,
    rinse_action: nullableTrimmedString,
    category: z.literal("heat_protectant"),
    role: z.literal("pre_heat_protection"),
    application_state: z.enum(["damp", "dry", "either"]),
    reapplication: z.enum(["required", "optional", "not_stated"]),
  })
  .strict()

const heatProtectantSpecsSchema = z
  .object({
    product_heat_protectant_specs: heatProtectantSpecSchema,
    product_application_protocols: z.array(heatProtectantProtocolSchema).min(1),
  })
  .strict()

const legacyHeatProtectantSpecsSchema = z
  .object({
    product_heat_protectant_specs: heatProtectantSpecSchema,
    product_application_protocols: z.array(legacyHeatProtectantProtocolSchema).min(1),
  })
  .strict()

const scalpCareSpecSchema = z
  .object({
    primary_role: scalpCareRoleSchema,
    presentation_format: z.enum([
      "serum",
      "tonic",
      "lotion_or_fluid",
      "oil",
      "scrub",
      "other",
      "unknown",
    ]),
    rinse_mode: z.enum(["leave_on", "rinse_off"]),
    application_instructions: trimmedString,
  })
  .strict()

const scalpCareProtocolSchema = applicationProtocolBaseSchema
  .extend({
    category: z.literal("scalp_care"),
    role: scalpCareRoleSchema,
  })
  .strict()

const legacyScalpCareProtocolSchema = applicationProtocolBaseSchema
  .omit({ guidance_payload: true })
  .extend({
    application_stage: nullableTrimmedString,
    placement: nullableTrimmedString,
    rinse_action: nullableTrimmedString,
    category: z.literal("scalp_care"),
    role: scalpCareRoleSchema,
  })
  .strict()

const scalpCareSpecsSchema = z
  .object({
    product_scalp_care_specs: scalpCareSpecSchema,
    product_application_protocols: z.array(scalpCareProtocolSchema).min(1),
  })
  .strict()

const legacyScalpCareSpecsSchema = z
  .object({
    product_scalp_care_specs: scalpCareSpecSchema,
    product_application_protocols: z.array(legacyScalpCareProtocolSchema).min(1),
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
    upsert("product_oil_specs", [parsed.specs.product_oil_specs]),
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

function validateHeatProtectant(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, heatProtectantSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  return validCategoryResult(finalPayload, [
    upsert("product_heat_protectant_specs", [parsed.specs.product_heat_protectant_specs]),
    upsert("product_application_protocols", parsed.specs.product_application_protocols),
  ])
}

function validateLegacyHeatProtectant(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, legacyHeatProtectantSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  return validCategoryResult(finalPayload, [
    upsert("product_heat_protectant_specs", [parsed.specs.product_heat_protectant_specs]),
    upsert(
      "product_application_protocols",
      parsed.specs.product_application_protocols as unknown as Array<
        ProductIntakeSpecRowByTable["product_application_protocols"]
      >,
    ),
  ])
}

function validateScalpCare(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, scalpCareSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  const primaryRole = parsed.specs.product_scalp_care_specs.primary_role
  if (
    parsed.specs.product_application_protocols.some((protocol) => protocol.role !== primaryRole)
  ) {
    return invalidCategoryResult(["final.category_specs.product_application_protocols.role"])
  }

  return validCategoryResult(finalPayload, [
    upsert("product_scalp_care_specs", [parsed.specs.product_scalp_care_specs]),
    upsert("product_application_protocols", parsed.specs.product_application_protocols),
  ])
}

function validateLegacyScalpCare(
  finalPayload: ProductIntakeFinalReviewedPayload,
): ProductIntakeApprovalValidationResult {
  const parsed = validateSpecs(finalPayload, legacyScalpCareSpecsSchema)
  if (!parsed.ok) return invalidCategoryResult(parsed.missingFields)

  const primaryRole = parsed.specs.product_scalp_care_specs.primary_role
  if (
    parsed.specs.product_application_protocols.some((protocol) => protocol.role !== primaryRole)
  ) {
    return invalidCategoryResult(["final.category_specs.product_application_protocols.role"])
  }

  return validCategoryResult(finalPayload, [
    upsert("product_scalp_care_specs", [parsed.specs.product_scalp_care_specs]),
    upsert(
      "product_application_protocols",
      parsed.specs.product_application_protocols as unknown as Array<
        ProductIntakeSpecRowByTable["product_application_protocols"]
      >,
    ),
  ])
}

function validateExactProtocol(
  categoryKey: ProductIntakeReviewCategoryKey,
  categorySpecs: unknown,
): ProductIntakeCategorySpecsValidationResult {
  const requiredRoles = requiredProtocolRoles(categoryKey, categorySpecs)
  const protocols = z
    .object({
      product_application_protocols: z
        .array(
          applicationProtocolBaseSchema.extend({
            category: z.literal(categoryKey),
            role: z.string(),
            guidance_payload: canonicalGuidancePayloadSchema,
          }),
        )
        .min(1),
    })
    .passthrough()
    .safeParse(categorySpecs)

  if (!protocols.success) {
    return {
      ok: false,
      missingFields: parseErrors(protocols.error, ["final", "category_specs"]),
      targetSpecOperations: [],
    }
  }
  const suppliedRoles = new Set(
    protocols.data.product_application_protocols.map((protocol) => protocol.role),
  )
  const unsupportedShampooRole =
    categoryKey === "shampoo" && [...suppliedRoles].some((role) => !requiredRoles.includes(role))
  if (requiredRoles.some((role) => !suppliedRoles.has(role)) || unsupportedShampooRole) {
    return {
      ok: false,
      missingFields: ["final.category_specs.product_application_protocols.role"],
      targetSpecOperations: [],
    }
  }

  let protocolsWithV2: Array<
    (typeof protocols.data.product_application_protocols)[number] & {
      guidance_payload_v2: Record<string, unknown>
    }
  >
  try {
    protocolsWithV2 = protocols.data.product_application_protocols.map((protocol) => ({
      ...protocol,
      guidance_payload_v2: buildProductApplicationPointerV2({
        sourceRole: protocol.role,
        guidancePayload: protocol.guidance_payload,
        applicationState: protocol.application_state,
      }) as unknown as Record<string, unknown>,
    }))
  } catch {
    return {
      ok: false,
      missingFields: ["final.category_specs.product_application_protocols.guidance_payload"],
      targetSpecOperations: [],
    }
  }

  return {
    ok: true,
    missingFields: [],
    targetSpecOperations: [upsert("product_application_protocols", protocolsWithV2)],
  }
}

function requiredProtocolRoles(
  categoryKey: ProductIntakeReviewCategoryKey,
  categorySpecs: unknown,
): readonly string[] {
  const specs = categorySpecs as Record<string, unknown>
  switch (categoryKey) {
    case "shampoo": {
      const rows = Array.isArray(specs.product_shampoo_specs) ? specs.product_shampoo_specs : []
      return deriveShampooProtocolRoles(
        rows.map((row) => (row as { shampoo_bucket?: string | null }).shampoo_bucket),
      )
    }
    case "leave_in":
      return (specs.product_leave_in_specs as { provides_heat_protection?: unknown })
        ?.provides_heat_protection === true
        ? ["post_wash_leave_in", "pre_heat_protection"]
        : ["post_wash_leave_in"]
    case "oil": {
      return (specs.product_oil_specs as { role_support?: string[] })?.role_support ?? []
    }
    case "deep_cleansing_shampoo": {
      const focus = (specs.product_deep_cleansing_shampoo_specs as { reset_focus?: string })
        ?.reset_focus
      return focus === "metal_mineral_hard_water"
        ? ["mineral_reset"]
        : focus === "broad_spectrum_detox"
          ? ["residue_reset", "mineral_reset"]
          : ["residue_reset"]
    }
    case "scalp_care":
      return [(specs.product_scalp_care_specs as { primary_role?: string })?.primary_role ?? ""]
    default:
      return [REQUIRED_PROTOCOL_ROLES_BY_CATEGORY[categoryKey][0]]
  }
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
  heat_protectant: validateHeatProtectant,
  scalp_care: validateScalpCare,
} satisfies Record<ProductIntakeReviewCategoryKey, ProductIntakeCategoryApprovalValidator>

export type ProductIntakeCategorySpecsValidationResult =
  | {
      ok: true
      missingFields: []
      targetSpecOperations: ProductIntakeTargetSpecOperation[]
    }
  | {
      ok: false
      missingFields: string[]
      targetSpecOperations: []
    }

export type ProductIntakeValidationProfile = "current" | "legacy_personal_plan_launch_v1"

export function validateProductIntakeCategorySpecs(
  categoryKey: ProductIntakeReviewCategoryKey,
  categorySpecs: unknown,
  profile: ProductIntakeValidationProfile = "current",
): ProductIntakeCategorySpecsValidationResult {
  const result =
    profile === "legacy_personal_plan_launch_v1" && categoryKey === "heat_protectant"
      ? validateLegacyHeatProtectant({
          category_specs: categorySpecs,
        } as ProductIntakeFinalReviewedPayload)
      : profile === "legacy_personal_plan_launch_v1" && categoryKey === "scalp_care"
        ? validateLegacyScalpCare({
            category_specs: categorySpecs,
          } as ProductIntakeFinalReviewedPayload)
        : PRODUCT_INTAKE_CATEGORY_APPROVAL_VALIDATORS[categoryKey]({
            category_specs: categorySpecs,
          } as ProductIntakeFinalReviewedPayload)

  return result.ok
    ? {
        ok: true,
        missingFields: [],
        targetSpecOperations: result.targetSpecOperations,
      }
    : {
        ok: false,
        missingFields: result.missingFields,
        targetSpecOperations: [],
      }
}

export function validateProductIntakeApprovalPayload(
  value: unknown,
  profile: ProductIntakeValidationProfile = "current",
): ProductIntakeApprovalValidationResult {
  const parsed =
    profile === "legacy_personal_plan_launch_v1"
      ? legacyApprovalPayloadSchema.safeParse(value)
      : approvalPayloadSchema.safeParse(value)
  if (!parsed.success) {
    return invalidCategoryResult(parseErrors(parsed.error))
  }

  const finalPayload = parsed.data.final
  const rationaleValidation = validateFieldRationales(finalPayload)
  if (rationaleValidation) return rationaleValidation

  const categoryKey = finalPayload.product.category_key
  const categoryValidation =
    profile === "legacy_personal_plan_launch_v1" && categoryKey === "heat_protectant"
      ? validateLegacyHeatProtectant(finalPayload)
      : profile === "legacy_personal_plan_launch_v1" && categoryKey === "scalp_care"
        ? validateLegacyScalpCare(finalPayload)
        : PRODUCT_INTAKE_CATEGORY_APPROVAL_VALIDATORS[categoryKey](
            categoryKey === "heat_protectant" || categoryKey === "scalp_care"
              ? finalPayload
              : {
                  ...finalPayload,
                  category_specs: Object.fromEntries(
                    Object.entries(finalPayload.category_specs).filter(
                      ([key]) => key !== "product_application_protocols",
                    ),
                  ),
                },
          )

  if (!categoryValidation.ok) return categoryValidation

  if (
    profile === "legacy_personal_plan_launch_v1" &&
    (categoryKey === "heat_protectant" || categoryKey === "scalp_care")
  ) {
    // Offline launch-cohort enrichment retains its separate V2 backfill path.
    // The go-forward Product Intake approval RPC uses the default profile below.
    return categoryValidation
  }

  const protocolValidation = validateExactProtocol(categoryKey, finalPayload.category_specs)
  if (!protocolValidation.ok) {
    return {
      ok: false,
      missingFields: protocolValidation.missingFields,
      normalizedPayload: null,
      targetSpecOperations: [],
    }
  }

  return {
    ...categoryValidation,
    targetSpecOperations: [
      ...categoryValidation.targetSpecOperations.filter(
        (operation) => operation.table !== "product_application_protocols",
      ),
      ...protocolValidation.targetSpecOperations,
    ],
    normalizedPayload: parsed.data,
  }
}

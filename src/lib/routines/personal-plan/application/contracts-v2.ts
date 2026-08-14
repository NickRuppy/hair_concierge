import { z } from "zod"

import {
  EXACT_APPLICATION_WORKFLOW_IDS_V2,
  applicationCautionCodeV2Schema,
  applicationDayTypeKeySchema,
  exactApplicationWorkflowIdV2Schema,
  applicationFamilySchema,
  applicationSequenceAnchorSchema,
  personalPlanCategorySchema,
  semanticRoleSchema,
  type ApplicationFamily,
  type PersonalPlanCategory,
} from "./contracts"

export {
  APPLICATION_CAUTION_CODES_V2,
  EXACT_APPLICATION_WORKFLOW_IDS_V2,
  applicationCautionCodeV2Schema,
  exactApplicationWorkflowIdV2Schema,
} from "./contracts"

export const APPLICATION_TEMPLATE_VARIABLES_V2 = [
  "application_area_de",
  "contact_time_de",
  "max_temperature_c",
] as const

export const applicationTemplateVariableV2Schema = z.enum(APPLICATION_TEMPLATE_VARIABLES_V2)

const FAMILY_CATEGORIES = {
  standard_rinse_out_cleanse: ["shampoo"],
  targeted_treatment_shampoo: ["shampoo"],
  standard_rinse_out_conditioning: ["conditioner"],
  post_shampoo_rinse_out_mask: ["mask"],
  post_wash_booster: ["leave_in"],
  conditioner_replacement: ["leave_in"],
  between_wash_damp_refresh: ["leave_in", "oil"],
  between_wash_dry_care: ["leave_in", "oil"],
  pre_heat_damp: ["leave_in", "oil", "heat_protectant"],
  pre_heat_dry: ["leave_in", "oil", "heat_protectant"],
  post_style_finish: ["leave_in", "oil"],
  pre_wash_lengths_treatment: ["oil"],
  post_wash_damp_conditioning: ["leave_in", "oil"],
  dry_finish: ["oil"],
  reset_cleanse: ["deep_cleansing_shampoo"],
  aerosol_spray: ["dry_shampoo"],
  powder: ["dry_shampoo"],
  foam: ["dry_shampoo"],
  liquid_to_dry: ["dry_shampoo"],
  paste_or_balm: ["dry_shampoo"],
  damp_hair_protection: ["leave_in", "oil", "heat_protectant"],
  dry_hair_protection: ["leave_in", "oil", "heat_protectant"],
  either_state_protection: ["leave_in", "oil", "heat_protectant"],
  pre_shampoo_single_treatment: ["bondbuilder"],
  pre_shampoo_booster_plus_treatment: ["bondbuilder"],
  post_shampoo_rinse_out_treatment: ["bondbuilder"],
  post_shampoo_timed_leave_in: ["bondbuilder"],
  leave_on_scalp_care: ["scalp_care"],
  rinse_off_scalp_care: ["scalp_care"],
  styling_product: [],
} as const satisfies Record<ApplicationFamily, readonly PersonalPlanCategory[]>

const EXACT_WORKFLOW_FAMILIES = {
  swiss_o_par_tea_tree_two_pass: "targeted_treatment_shampoo",
  epres_bond_repair: "pre_shampoo_single_treatment",
  k18_leave_in_molecular_repair: "post_shampoo_timed_leave_in",
  olaplex_no3plus_complete_repair: "pre_shampoo_single_treatment",
} as const satisfies Record<(typeof EXACT_APPLICATION_WORKFLOW_IDS_V2)[number], ApplicationFamily>

const evidenceSchema = z
  .object({
    sourceUrl: z.string().url(),
    sourceType: z.enum([
      "manufacturer",
      "retailer",
      "professional_authority",
      "internal_authority",
    ]),
    checkedAt: z.string().date(),
  })
  .strict()

const familyScopeSchema = z
  .object({ kind: z.literal("application_family"), category: personalPlanCategorySchema })
  .strict()

const productScopeSchema = z
  .object({
    kind: z.literal("product"),
    category: personalPlanCategorySchema,
    productId: z.string().uuid(),
  })
  .strict()

const sequenceSchema = z
  .object({
    anchor: applicationSequenceAnchorSchema,
    before: z.array(applicationSequenceAnchorSchema),
    after: z.array(applicationSequenceAnchorSchema),
    conflictsWith: z.array(applicationSequenceAnchorSchema),
  })
  .strict()

const templateCopySchema = z
  .string()
  .min(1)
  .superRefine((copy, context) => {
    for (const match of copy.matchAll(/{{\s*([^}]+?)\s*}}/g)) {
      if (!APPLICATION_TEMPLATE_VARIABLES_V2.includes(match[1] as never)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Unsupported application template variable ${match[1]}`,
        })
      }
    }
  })

const stepActionSchema = z.enum(["apply_product", "wait", "rinse", "dry", "tool", "section"])

export const applicationFamilyTemplateV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    contractKind: z.literal("family_template"),
    guidanceKey: z.string().min(1),
    protocolVersion: z.number().int().positive(),
    locale: z.literal("de"),
    scope: familyScopeSchema,
    role: semanticRoleSchema,
    applicationFamily: applicationFamilySchema,
    compatibleDayTypes: z.array(applicationDayTypeKeySchema).min(1),
    sequence: sequenceSchema,
    steps: z
      .array(
        z
          .object({
            stepKey: z.string().min(1),
            action: stepActionSchema,
            copyTemplateDe: templateCopySchema,
          })
          .strict(),
      )
      .min(1),
    evidence: z.array(evidenceSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (!FAMILY_CATEGORIES[value.applicationFamily].includes(value.scope.category as never)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Application family is incompatible with its category",
        path: ["applicationFamily"],
      })
    }
  })

const contactTimeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("seconds"), seconds: z.number().int().positive() }).strict(),
  z
    .object({
      kind: z.literal("range_seconds"),
      minimumSeconds: z.number().int().positive(),
      maximumSeconds: z.number().int().positive(),
    })
    .strict()
    .refine((value) => value.maximumSeconds >= value.minimumSeconds, {
      message: "Contact-time range must be ordered",
    }),
  z
    .object({ kind: z.literal("maximum_seconds"), maximumSeconds: z.number().int().positive() })
    .strict(),
  z.object({ kind: z.literal("label_directed") }).strict(),
])

const amountSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("qualitative"),
      value: z.enum(["one_drop", "few_drops", "very_small_amount", "small_amount", "generous"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("pumps"),
      minimum: z.number().int().positive(),
      maximum: z.number().int().positive(),
    })
    .strict()
    .refine((value) => value.maximum >= value.minimum, {
      message: "Pump range must be ordered",
    }),
])

const heatFactsSchema = z
  .object({
    supportedStates: z.array(z.enum(["damp_hair", "dry_hair"])).min(1),
    activationRequired: z.boolean(),
    maximumClaimedTemperatureC: z.number().int().min(40).max(300).nullable(),
    reapplication: z.enum(["none", "each_separate_heat_event", "label_directed"]),
  })
  .strict()

const productFactsSchema = z
  .object({
    applicationState: z.enum([
      "wet_hair",
      "damp_hair",
      "dry_hair",
      "damp_or_dry_hair",
      "pre_wash_dry_hair",
      "clean_damp_scalp",
      "clean_dry_scalp",
      "clean_damp_or_dry_scalp",
    ]),
    applicationArea: z.enum(["scalp_roots", "hair_lengths_ends", "hair_ends", "root_to_tip_hair"]),
    rinse: z.enum(["rinse_out", "leave_in", "follow_with_shampoo"]),
    contactTime: contactTimeSchema.nullable(),
    amount: amountSchema.nullable(),
    heat: heatFactsSchema.nullable(),
    conditionerPolicy: z.enum([
      "not_applicable",
      "replaces_conditioner",
      "conditioner_before",
      "conditioner_after",
      "no_conditioner",
      "conditioner_optional",
      "conditioner_required",
    ]),
  })
  .strict()

const exactStepSchema = z
  .object({
    stepKey: z.string().min(1),
    action: stepActionSchema,
    copyDe: z
      .string()
      .min(1)
      .refine((copy) => !/{{[^}]+}}/.test(copy), {
        message: "Exact workflow steps cannot contain interpolation",
      }),
  })
  .strict()

export const productApplicationPointerV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    contractKind: z.literal("product_pointer"),
    scope: productScopeSchema,
    sourceRole: z.string().min(1),
    role: semanticRoleSchema,
    applicationFamily: applicationFamilySchema,
    facts: productFactsSchema,
    workflowId: exactApplicationWorkflowIdV2Schema.nullable(),
    requiredCompanionProductId: z.string().uuid().nullable(),
    runtimeBlockerCode: z.enum(["missing_verified_companion"]).nullable(),
    exactSteps: z.array(exactStepSchema),
    cautionCodes: z.array(applicationCautionCodeV2Schema),
    evidence: z.array(evidenceSchema).min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (!FAMILY_CATEGORIES[value.applicationFamily].includes(value.scope.category as never)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Application family is incompatible with its category",
        path: ["applicationFamily"],
      })
    }
    if (value.workflowId === null && value.exactSteps.length > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ordinary product pointers cannot own visible exact steps",
        path: ["exactSteps"],
      })
    }
    if (value.workflowId !== null) {
      if (value.exactSteps.length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Reviewed exact workflows require visible steps",
          path: ["exactSteps"],
        })
      }
      if (EXACT_WORKFLOW_FAMILIES[value.workflowId] !== value.applicationFamily) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Exact workflow is incompatible with its application family",
          path: ["workflowId"],
        })
      }
    }
    if (value.requiredCompanionProductId !== null && value.runtimeBlockerCode !== null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A blocked workflow cannot name an executable companion",
        path: ["runtimeBlockerCode"],
      })
    }
    if (
      value.workflowId === null &&
      (value.requiredCompanionProductId !== null || value.runtimeBlockerCode !== null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ordinary product pointers cannot carry workflow dependencies",
        path: ["requiredCompanionProductId"],
      })
    }
  })

export type ApplicationFamilyTemplateV2 = z.infer<typeof applicationFamilyTemplateV2Schema>
export type ProductApplicationPointerV2 = z.infer<typeof productApplicationPointerV2Schema>

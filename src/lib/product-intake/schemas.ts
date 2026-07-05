import { z } from "zod"
import type { ProductFrequency } from "@/lib/types"
import { SUPPORTED_PRODUCT_CATEGORY_KEYS } from "@/lib/product-identity"
import { PRODUCT_FREQUENCIES, normalizeProductFrequency } from "@/lib/vocabulary/frequencies"

const trimmedString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string(),
)

const optionalTrimmedString = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}, z.string().optional())

export const productIntakeFrequencySchema = z.preprocess((value) => {
  if (typeof value !== "string") return value
  return normalizeProductFrequency(value) ?? value
}, z.enum(PRODUCT_FREQUENCIES))

export const productIntakeCategorySchema = z.enum(SUPPORTED_PRODUCT_CATEGORY_KEYS)

const uuidString = z.string().uuid()
const uploadPathString = trimmedString.pipe(z.string().min(1).max(500))
const validationMetadataSchema = z.record(z.string(), z.unknown())

const frontImageValidationStatusSchema = z.enum([
  "valid_product_front",
  "uncertain",
  "not_a_product_photo",
  "unsafe_or_inappropriate",
])

const barcodeImageValidationStatusSchema = z.enum([
  "valid_barcode",
  "uncertain",
  "not_a_product_photo",
  "unsafe_or_inappropriate",
])

const manualProductIntakeBaseSchema = z
  .object({
    intake_method: z.literal("manual").default("manual"),
    category: productIntakeCategorySchema,
    frequency_range: productIntakeFrequencySchema,
    brand_text: optionalTrimmedString,
    brand_id: uuidString.optional(),
    product_line_id: uuidString.nullable().optional(),
    product_name_text: trimmedString.pipe(z.string().min(1).max(240)),
    replace_existing_confirmed: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.brand_text && !value.brand_id) {
      ctx.addIssue({
        code: "custom",
        path: ["brand_text"],
        message: "Marke ist erforderlich.",
      })
    }
  })

const photoProductIntakeBaseSchema = z.object({
  intake_method: z.literal("photo"),
  category: productIntakeCategorySchema,
  frequency_range: productIntakeFrequencySchema,
  front_image_path: uploadPathString,
  front_image_validation_status: frontImageValidationStatusSchema.default("uncertain"),
  front_image_validation_metadata: validationMetadataSchema.default({}),
  barcode_image_path: uploadPathString.optional(),
  barcode_image_validation_status: barcodeImageValidationStatusSchema.optional(),
  barcode_image_validation_metadata: validationMetadataSchema.default({}),
  brand_text: optionalTrimmedString,
  brand_id: uuidString.optional(),
  product_line_id: uuidString.nullable().optional(),
  product_name_text: optionalTrimmedString.pipe(z.string().max(240).optional()),
  replace_existing_confirmed: z.boolean().default(false),
})

export const onboardingProductIntakeSubmissionSchema = z
  .discriminatedUnion("intake_method", [
    manualProductIntakeBaseSchema.extend({
      existing_usage_id: uuidString.optional(),
    }),
    photoProductIntakeBaseSchema.extend({
      front_image_path: uploadPathString.optional(),
      existing_usage_id: uuidString.optional(),
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.intake_method === "photo" && !value.front_image_path && !value.existing_usage_id) {
      ctx.addIssue({
        code: "custom",
        path: ["front_image_path"],
        message: "Vorderseitenfoto ist erforderlich.",
      })
    }
  })

export const chatProductIntakeSubmissionSchema = z
  .discriminatedUnion("intake_method", [
    manualProductIntakeBaseSchema.extend({
      source_conversation_id: uuidString.optional(),
      source_message_id: uuidString.optional(),
      offer_id: z.string().min(1).optional(),
      existing_usage_id: uuidString.optional(),
      existing_submission_id: uuidString.optional(),
    }),
    photoProductIntakeBaseSchema.extend({
      front_image_path: uploadPathString.optional(),
      source_conversation_id: uuidString.optional(),
      source_message_id: uuidString.optional(),
      offer_id: z.string().min(1).optional(),
      existing_usage_id: uuidString.optional(),
      existing_submission_id: uuidString.optional(),
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.intake_method === "photo" && !value.front_image_path && !value.existing_usage_id) {
      ctx.addIssue({
        code: "custom",
        path: ["front_image_path"],
        message: "Vorderseitenfoto ist erforderlich.",
      })
    }
  })

export const onboardingProductIntakeCancelSchema = z.object({
  categories: z
    .array(productIntakeCategorySchema)
    .min(1)
    .max(SUPPORTED_PRODUCT_CATEGORY_KEYS.length),
})

export type OnboardingProductIntakeSubmissionInput = z.infer<
  typeof onboardingProductIntakeSubmissionSchema
> & {
  frequency_range: ProductFrequency
}

export type ChatProductIntakeSubmissionInput = z.infer<typeof chatProductIntakeSubmissionSchema> & {
  frequency_range: ProductFrequency
}

export type ProductIntakeSubmissionInput =
  | OnboardingProductIntakeSubmissionInput
  | ChatProductIntakeSubmissionInput

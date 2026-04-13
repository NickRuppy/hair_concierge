import { z } from "zod"
import {
  HAIR_TEXTURES,
  HAIR_THICKNESSES,
  HAIR_DENSITIES,
  CONCERNS,
  GOALS,
  DESIRED_VOLUME_LEVELS,
  STYLING_TOOLS,
  WASH_FREQUENCIES,
  HEAT_STYLING_LEVELS,
  TOWEL_MATERIALS,
  TOWEL_TECHNIQUES,
  DRYING_METHODS,
  BRUSH_TYPES,
  NIGHT_PROTECTIONS,
} from "@/lib/vocabulary"
import { CONDITIONER_WEIGHTS, CONDITIONER_REPAIR_LEVELS } from "@/lib/conditioner/constants"
import {
  POST_WASH_ACTIONS,
  ROUTINE_PREFERENCES,
  ROUTINE_PRODUCTS,
  LEAVE_IN_FORMATS,
  LEAVE_IN_WEIGHTS,
  LEAVE_IN_ROLES,
  LEAVE_IN_CARE_BENEFITS,
  LEAVE_IN_INGREDIENT_FLAGS,
  LEAVE_IN_APPLICATION_STAGES,
} from "@/lib/leave-in/constants"
import {
  MASK_FORMATS,
  MASK_WEIGHTS,
  MASK_CONCENTRATIONS,
  MASK_BENEFITS,
  MASK_INGREDIENT_FLAGS,
} from "@/lib/mask/constants"
import { OIL_SUBTYPES, isOilCategory } from "@/lib/oil/constants"

export const hairProfileFullSchema = z.object({
  hair_texture: z.enum(HAIR_TEXTURES).nullable(),
  thickness: z.enum(HAIR_THICKNESSES).nullable(),
  density: z.enum(HAIR_DENSITIES).nullable().default(null),
  concerns: z.array(z.enum(CONCERNS)).default([]),
  products_used: z.string().nullable().default(null),
  wash_frequency: z.enum(WASH_FREQUENCIES).nullable().default(null),
  heat_styling: z.enum(HEAT_STYLING_LEVELS).nullable().default(null),
  styling_tools: z.array(z.enum(STYLING_TOOLS)).default([]),
  desired_volume: z.enum(DESIRED_VOLUME_LEVELS).nullable().default(null),
  post_wash_actions: z.array(z.enum(POST_WASH_ACTIONS)).default([]),
  routine_preference: z.enum(ROUTINE_PREFERENCES).nullable().default(null),
  current_routine_products: z.array(z.enum(ROUTINE_PRODUCTS)).default([]),
  goals: z.array(z.enum(GOALS)).default([]),
  towel_material: z.enum(TOWEL_MATERIALS).nullable().default(null),
  towel_technique: z.enum(TOWEL_TECHNIQUES).nullable().default(null),
  drying_method: z.array(z.enum(DRYING_METHODS)).default([]),
  brush_type: z.enum(BRUSH_TYPES).nullable().default(null),
  night_protection: z.array(z.enum(NIGHT_PROTECTIONS)).default([]),
  uses_heat_protection: z.boolean().default(false),
  additional_notes: z.string().nullable().default(null),
})

const leaveInSpecsSchema = z
  .object({
    format: z.enum(LEAVE_IN_FORMATS),
    weight: z.enum(LEAVE_IN_WEIGHTS),
    roles: z.array(z.enum(LEAVE_IN_ROLES)).default([]),
    provides_heat_protection: z.boolean().default(false),
    heat_protection_max_c: z.number().int().nullable().default(null),
    heat_activation_required: z.boolean().default(false),
    care_benefits: z.array(z.enum(LEAVE_IN_CARE_BENEFITS)).default([]),
    ingredient_flags: z.array(z.enum(LEAVE_IN_INGREDIENT_FLAGS)).default([]),
    application_stage: z.array(z.enum(LEAVE_IN_APPLICATION_STAGES)).default(["towel_dry"]),
  })
  .superRefine((value, ctx) => {
    if (value.heat_protection_max_c !== null && !value.provides_heat_protection) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["heat_protection_max_c"],
        message: "heat_protection_max_c requires provides_heat_protection = true",
      })
    }
    if (value.heat_activation_required && !value.roles.includes("styling_prep")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roles"],
        message: "heat_activation_required requires styling_prep role",
      })
    }
  })

const maskSpecsSchema = z.object({
  format: z.enum(MASK_FORMATS),
  weight: z.enum(MASK_WEIGHTS),
  concentration: z.enum(MASK_CONCENTRATIONS),
  benefits: z.array(z.enum(MASK_BENEFITS)).default([]),
  ingredient_flags: z.array(z.enum(MASK_INGREDIENT_FLAGS)).default([]),
  leave_on_minutes: z.number().int().min(1).max(60).default(10),
})

const conditionerSpecsSchema = z.object({
  weight: z.enum(CONDITIONER_WEIGHTS),
  repair_level: z.enum(CONDITIONER_REPAIR_LEVELS),
})

const nullableTextField = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().nullable().optional(),
)

const nullableUrlField = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().url().nullable().optional(),
)

const nullablePriceField = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return null
  return value
}, z.number().min(0).nullable().optional())

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  conversation_id: z.string().uuid().optional(),
})

export const chatFeedbackSchema = z.object({
  message_id: z.string().uuid(),
  score: z.union([z.literal(-1), z.literal(1)]),
})

export const productSchema = z
  .object({
    name: z.string().min(1, "Name ist erforderlich."),
    brand: nullableTextField.default(null),
    description: nullableTextField.default(null),
    category: nullableTextField.default(null),
    affiliate_link: nullableUrlField.default(null),
    image_url: nullableUrlField.default(null),
    price_eur: nullablePriceField.default(null),
    tags: z.array(z.string()).default([]),
    suitable_thicknesses: z.array(z.string()).default([]),
    suitable_concerns: z.array(z.string()).default([]),
    is_active: z.boolean().default(true),
    sort_order: z.number().int().default(0),
    conditioner_specs: conditionerSpecsSchema.nullable().optional(),
    leave_in_specs: leaveInSpecsSchema.nullable().optional(),
    mask_specs: maskSpecsSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!isOilCategory(value.category)) return

    if (value.suitable_thicknesses.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suitable_thicknesses"],
        message: "Mindestens eine Haardicke ist fuer Oele erforderlich.",
      })
    }

    for (const thickness of value.suitable_thicknesses) {
      if (!HAIR_THICKNESSES.includes(thickness as (typeof HAIR_THICKNESSES)[number])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["suitable_thicknesses"],
          message: "Oele duerfen nur gueltige Haardicken verwenden.",
        })
        break
      }
    }

    if (value.suitable_concerns.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suitable_concerns"],
        message: "Mindestens ein Oel-Typ ist fuer Oele erforderlich.",
      })
    }

    for (const concern of value.suitable_concerns) {
      if (!OIL_SUBTYPES.includes(concern as (typeof OIL_SUBTYPES)[number])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["suitable_concerns"],
          message: "Oele duerfen nur natuerliches-oel, styling-oel oder trocken-oel verwenden.",
        })
        break
      }
    }
  })

export const quoteSchema = z.object({
  quote_text: z.string().min(1, "Zitat ist erforderlich."),
  author: z.string().optional().default(""),
  display_date: z.string().optional(),
  is_active: z.boolean().default(true),
})

export const articleSchema = z.object({
  title: z.string().min(1, "Titel ist erforderlich."),
  slug: z.string().min(1, "Slug ist erforderlich."),
  excerpt: z.string().optional().default(""),
  body: z.string().optional().default(""),
  cover_image_url: z.string().url().optional().or(z.literal("")),
  category: z.string().optional().default(""),
  tags: z.array(z.string()).default([]),
  is_published: z.boolean().default(false),
  published_at: z.string().optional(),
  author_name: z.string().optional().default(""),
  sort_order: z.number().int().default(0),
})

export type HairProfileFull = z.infer<typeof hairProfileFullSchema>
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type ChatFeedbackInput = z.infer<typeof chatFeedbackSchema>
export type ProductInput = z.infer<typeof productSchema>
export type QuoteInput = z.infer<typeof quoteSchema>
export type ArticleInput = z.infer<typeof articleSchema>

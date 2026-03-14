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
} from "@/lib/vocabulary"
import {
  CONDITIONER_WEIGHTS,
  CONDITIONER_REPAIR_LEVELS,
} from "@/lib/conditioner/constants"
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
  additional_notes: z.string().nullable().default(null),
})

const leaveInSpecsSchema = z.object({
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
    if (
      value.heat_activation_required &&
      !value.roles.includes("styling_prep")
    ) {
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

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  conversation_id: z.string().uuid().optional(),
  image_url: z.string().url().optional(),
})

export const productSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich."),
  brand: z.string().optional().default(""),
  description: z.string().optional().default(""),
  category: z.string().optional().default(""),
  affiliate_link: z.string().url().optional().or(z.literal("")),
  image_url: z.string().url().optional().or(z.literal("")),
  price_eur: z.number().min(0).optional(),
  tags: z.array(z.string()).default([]),
  suitable_thicknesses: z.array(z.string()).default([]),
  suitable_concerns: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  conditioner_specs: conditionerSpecsSchema.nullable().optional(),
  leave_in_specs: leaveInSpecsSchema.nullable().optional(),
  mask_specs: maskSpecsSchema.nullable().optional(),
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
export type ProductInput = z.infer<typeof productSchema>
export type QuoteInput = z.infer<typeof quoteSchema>
export type ArticleInput = z.infer<typeof articleSchema>

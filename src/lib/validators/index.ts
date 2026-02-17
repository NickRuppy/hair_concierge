import { z } from "zod"
import { HAIR_TYPES, HAIR_THICKNESSES } from "@/lib/vocabulary"

export const hairProfileFullSchema = z.object({
  hair_type: z.enum(HAIR_TYPES).nullable(),
  thickness: z.enum(HAIR_THICKNESSES).nullable(),
  concerns: z.array(z.string()).default([]),
  products_used: z.string().nullable().default(null),
  wash_frequency: z.string().nullable().default(null),
  heat_styling: z.string().nullable().default(null),
  styling_tools: z.array(z.string()).default([]),
  goals: z.array(z.string()).default([]),
  additional_notes: z.string().nullable().default(null),
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
  suitable_hair_types: z.array(z.string()).default([]),
  suitable_concerns: z.array(z.string()).default([]),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
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

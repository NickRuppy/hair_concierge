/* ── Re-export shared vocabulary (single source of truth) ── */

import type { HairType, HairTexture, WashFrequency, HeatStyling, Concern, Goal } from "@/lib/vocabulary"

export type { HairType, HairTexture, WashFrequency, HeatStyling, Concern, Goal }

export {
  HAIR_TYPE_OPTIONS,
  HAIR_TEXTURE_OPTIONS,
  CONCERN_OPTIONS,
  GOAL_OPTIONS,
  WASH_FREQUENCY_OPTIONS,
  HEAT_STYLING_OPTIONS,
  STYLING_TOOL_OPTIONS,
  CUTICLE_CONDITION_LABELS,
  PROTEIN_MOISTURE_LABELS,
  SCALP_TYPE_LABELS,
  SCALP_CONDITION_LABELS,
  CHEMICAL_TREATMENT_LABELS,
} from "@/lib/vocabulary"

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_admin: boolean
  locale: string
  subscription_tier_id: string | null
  message_count_this_month: number
  message_count_reset_at: string | null
  created_at: string
  updated_at: string
}

export interface HairProfile {
  id: string
  user_id: string
  hair_type: HairType | null
  hair_texture: HairTexture | null
  concerns: string[]
  products_used: string | null
  wash_frequency: string | null
  heat_styling: string | null
  styling_tools: string[]
  goals: string[]
  cuticle_condition: string | null
  protein_moisture_balance: string | null
  scalp_type: string | null
  scalp_condition: string | null
  chemical_treatment: string[]
  additional_notes: string | null
  conversation_memory: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  name: string
  brand: string | null
  description: string | null
  short_description: string | null
  tom_take: string | null
  category: string | null
  affiliate_link: string | null
  image_url: string | null
  price_eur: number | null
  currency: string
  tags: string[]
  suitable_hair_types: string[]
  suitable_concerns: string[]
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Conversation {
  id: string
  user_id: string
  title: string | null
  is_active: boolean
  message_count: number
  memory_extracted_at_count: number
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: "user" | "assistant" | "system"
  content: string | null
  image_url: string | null
  image_analysis: string | null
  product_recommendations: Product[] | null
  rag_context: { sources: CitationSource[] } | null
  token_usage: Record<string, number> | null
  created_at: string
}

export interface DailyQuote {
  id: string
  quote_text: string
  author: string | null
  display_date: string | null
  is_active: boolean
  created_at: string
}

export interface Article {
  id: string
  title: string
  slug: string
  excerpt: string | null
  body: string | null
  cover_image_url: string | null
  category: string | null
  tags: string[]
  is_published: boolean
  published_at: string | null
  author_name: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ContentChunk {
  id: string
  source_type: string
  source_name: string | null
  chunk_index: number | null
  content: string
  token_count: number | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface CitationSource {
  index: number          // 1-based, matches [1] markers
  source_type: string    // "book", "product_list", etc.
  label: string          // German: "Fachbuch", "Produktmatrix"
  source_name: string | null
  snippet: string        // First ~200 chars of chunk content
}

export type IntentType =
  | "product_recommendation"
  | "hair_care_advice"
  | "diagnosis"
  | "routine_help"
  | "photo_analysis"
  | "ingredient_question"
  | "general_chat"
  | "followup"

export interface ChatSSEEvent {
  type: "conversation_id" | "content_delta" | "product_recommendations" | "sources" | "done" | "error"
  data: unknown
}

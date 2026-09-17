import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"

export type RetailerEnrichment = {
  source: "dm"
  fetchedAt: string
  gtin: string
  dan: string
  productName: string
  brand: string | null
  imageUrl: string | null
  productUrl: string | null
  ingredientsText: string | null
  description: string | null
  keyBenefits: string | null
  suggestedCategory: PersonalPlanCategory | null
}

export type RetailerLookupOutcome =
  | "disabled"
  | "hit"
  | "not_found"
  | "timeout"
  | "session_expired"
  | "transport"
  | "malformed"
  | "gtin_mismatch"
  | "unexpected"
  | "invalid_gtin"

export type RetailerLookupResult = {
  enrichment: RetailerEnrichment | null
  outcome: RetailerLookupOutcome
  durationMs: number | null
  deadlineMs: number | null
}

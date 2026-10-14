import { PRODUCT_LIFECYCLE_STATUSES, type ProductLifecycleStatus } from "@/lib/types"

export const ADMIN_PRODUCT_ORIGINS = ["curated", "user_submitted"] as const

export type AdminProductFilters = {
  origin: "all" | (typeof ADMIN_PRODUCT_ORIGINS)[number]
  recommendation_status: "all" | "recommended" | "not_recommended"
  lifecycle_status: "all" | ProductLifecycleStatus
  active_status: "all" | "active" | "inactive"
}

export type ParsedAdminProductFilters = {
  origin: Exclude<AdminProductFilters["origin"], "all"> | null
  recommendation: Exclude<AdminProductFilters["recommendation_status"], "all"> | null
  lifecycle: Exclude<AdminProductFilters["lifecycle_status"], "all"> | null
  active: Exclude<AdminProductFilters["active_status"], "all"> | null
}

export const DEFAULT_ADMIN_PRODUCT_FILTERS: AdminProductFilters = {
  origin: "all",
  recommendation_status: "all",
  lifecycle_status: "all",
  active_status: "all",
}

function parseAllowedValue<const T extends readonly string[]>(
  value: string | null,
  allowedValues: T,
): T[number] | null {
  if (!value) return null
  return allowedValues.includes(value as T[number]) ? (value as T[number]) : null
}

function parseRecommendationFilter(
  value: string | null,
): ParsedAdminProductFilters["recommendation"] {
  if (value === "true" || value === "recommended") return "recommended"
  if (value === "false" || value === "not_recommended") return "not_recommended"
  return null
}

function parseActiveFilter(value: string | null): ParsedAdminProductFilters["active"] {
  if (value === "true" || value === "active") return "active"
  if (value === "false" || value === "inactive") return "inactive"
  return null
}

export function parseAdminProductFilters(searchParams: URLSearchParams): ParsedAdminProductFilters {
  return {
    origin: parseAllowedValue(searchParams.get("origin"), ADMIN_PRODUCT_ORIGINS),
    recommendation:
      parseRecommendationFilter(searchParams.get("recommendation_status")) ??
      parseRecommendationFilter(searchParams.get("is_chaarlie_recommended")),
    lifecycle: parseAllowedValue(searchParams.get("lifecycle_status"), PRODUCT_LIFECYCLE_STATUSES),
    active:
      parseActiveFilter(searchParams.get("active_status")) ??
      parseActiveFilter(searchParams.get("is_active")),
  }
}

export function buildAdminProductFilterQueryString(filters: AdminProductFilters): string {
  const params = new URLSearchParams()
  if (filters.origin !== "all") params.set("origin", filters.origin)
  if (filters.recommendation_status !== "all") {
    params.set("recommendation_status", filters.recommendation_status)
  }
  if (filters.lifecycle_status !== "all") {
    params.set("lifecycle_status", filters.lifecycle_status)
  }
  if (filters.active_status !== "all") params.set("active_status", filters.active_status)

  return params.toString()
}

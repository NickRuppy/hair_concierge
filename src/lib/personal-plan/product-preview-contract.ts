import { CATEGORY_ROLE_POLICIES } from "./products/authorities"
import type { PlanProductRole, Stage1Category } from "./types"

/**
 * The payload now carries per-product prices, so a cached response can show a
 * stale price. `no-store` keeps every request source-fresh.
 */
export const STAGE1_PRODUCT_EXAMPLE_PREVIEW_CACHE_CONTROL = "no-store"

export function stage1ProductExamplePreviewRequestUrl(input: {
  personalPlanId: string
  sourceInputHash: string
}): string {
  const query = new URLSearchParams({
    personalPlanId: input.personalPlanId,
    sourceInputHash: input.sourceInputHash,
  })
  return `/api/personal-plan/stage-1/previews?${query.toString()}`
}

export type Stage1ProductExampleReasoning = {
  /** "Worauf es beim Produkt ankommt" */
  productCriteria: string
  /** "Warum das zu deinem Haar passt" */
  fit: string
  /** "Empfohlener Rhythmus" */
  frequency: string
}

export type Stage1ProductExampleCommerce = {
  priceEur: number | null
  purchaseLinkStatus: "available" | "unavailable" | null
  netContentValue: number | null
  netContentUnit: "ml" | "g" | null
  priceLabel: string | null
  netContentLabel: string | null
  // Null when availability is simply unknown — the surface stays quiet instead
  // of announcing an unconfirmed status (mirrors the Routine detail contract).
  availabilityLabel: string | null
  productUrl: string | null
  affiliateDisclosure: string | null
}

/**
 * One buyable recommendation for one Stage-3 role. `decisionKey`, `productId`
 * and `factFingerprint` are exactly the three values the accept-ideal-plan
 * request contract (`DirectAcceptanceSeenRole`) expects the client to echo
 * back at accept time — see `src/lib/personal-plan/direct-acceptance/accept.ts`.
 */
export type Stage1ProductExampleRecommendation = {
  kind: "recommendation"
  category: Stage1Category
  role: PlanProductRole
  decisionKey: string
  productId: string
  productName: string
  imageUrl: string
  verdict: "ideal" | "supportive"
  authorityVersion: string
  factFingerprint: string
  commerce: Stage1ProductExampleCommerce
  reasoning: Stage1ProductExampleReasoning
}

/**
 * The engine has no unique buyable recommendation for this role right now
 * (no candidate, no image, or a stale fingerprint). Task 3 renders this as an
 * explicit "wird nach der Verfeinerung konkret" state rather than silently
 * omitting the role or falling back to an illustration-only product.
 */
export type Stage1ProductExampleFallback = {
  kind: "fallback"
  category: Stage1Category
  role: PlanProductRole
  decisionKey: string
  authorityVersion: string
  fallback: "post_refinement"
}

export type Stage1ProductExampleRolePreview =
  | Stage1ProductExampleRecommendation
  | Stage1ProductExampleFallback

/** @deprecated Use `Stage1ProductExampleRolePreview`. Kept for callers that only render the recommendation case. */
export type Stage1ProductExamplePreview = Stage1ProductExampleRecommendation

/**
 * The payload is per-role, but a Stage-1 card is per-category: it shows the
 * entry of the category's primary (first-allowed) role, preferring a real
 * recommendation over a fallback so a secondary-role product still leads the
 * card. Every other entry of that category is therefore something the user
 * never saw on a card — which the fork screen has to disclose before a direct
 * acceptance buys it.
 */
export function stage1LeadRolePreviewByCategory(
  previews: readonly Stage1ProductExampleRolePreview[],
): Map<Stage1Category, Stage1ProductExampleRolePreview> {
  const roleRank = (role: PlanProductRole, category: Stage1Category) =>
    CATEGORY_ROLE_POLICIES[category].allowedRoles.indexOf(role as never)
  const rank = (preview: Stage1ProductExampleRolePreview) =>
    (preview.kind === "recommendation" ? 0 : 1_000) + roleRank(preview.role, preview.category)

  const leads = new Map<Stage1Category, Stage1ProductExampleRolePreview>()
  for (const preview of previews) {
    const existing = leads.get(preview.category)
    if (!existing || rank(preview) < rank(existing)) leads.set(preview.category, preview)
  }
  return leads
}

export type Stage1ProductExamplePreviewResponse = {
  schemaVersion: 2
  personalPlanId: string
  sourceNeedVersionId: string
  sourceInputHash: string
  previews: Stage1ProductExampleRolePreview[]
}

export function isStage1ProductExamplePreviewResponse(
  value: unknown,
): value is Stage1ProductExamplePreviewResponse {
  if (!value || typeof value !== "object") return false
  const response = value as Partial<Stage1ProductExamplePreviewResponse>
  return (
    response.schemaVersion === 2 &&
    typeof response.personalPlanId === "string" &&
    typeof response.sourceNeedVersionId === "string" &&
    typeof response.sourceInputHash === "string" &&
    Array.isArray(response.previews) &&
    response.previews.every(isProductExampleRolePreview)
  )
}

function isRoleForCategory(category: unknown, role: unknown): boolean {
  return (
    typeof category === "string" &&
    category in CATEGORY_ROLE_POLICIES &&
    typeof role === "string" &&
    CATEGORY_ROLE_POLICIES[category as Stage1Category].allowedRoles.includes(role as never)
  )
}

function isProductExampleRolePreview(value: unknown): value is Stage1ProductExampleRolePreview {
  if (!value || typeof value !== "object") return false
  const preview = value as Record<string, unknown>
  if (
    !isRoleForCategory(preview.category, preview.role) ||
    typeof preview.decisionKey !== "string" ||
    preview.authorityVersion !==
      CATEGORY_ROLE_POLICIES[preview.category as Stage1Category].authorityVersion
  ) {
    return false
  }
  if (preview.kind === "fallback") return preview.fallback === "post_refinement"
  return (
    preview.kind === "recommendation" &&
    typeof preview.productId === "string" &&
    typeof preview.productName === "string" &&
    typeof preview.imageUrl === "string" &&
    (preview.verdict === "ideal" || preview.verdict === "supportive") &&
    typeof preview.factFingerprint === "string" &&
    Boolean(preview.commerce) &&
    Boolean(preview.reasoning)
  )
}

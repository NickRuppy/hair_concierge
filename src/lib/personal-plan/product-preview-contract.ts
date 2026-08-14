import { CATEGORY_ROLE_POLICIES } from "./products/authorities"
import type { PlanProductRole, Stage1Category } from "./types"

export const STAGE1_PRODUCT_EXAMPLE_PREVIEW_CACHE_CONTROL = "private, max-age=60, must-revalidate"

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

export type Stage1ProductExamplePreview = {
  category: Stage1Category
  role: PlanProductRole
  productId: string
  productName: string
  imageUrl: string
  verdict: "ideal" | "supportive"
  authorityVersion: string
}

export type Stage1ProductExamplePreviewResponse = {
  schemaVersion: 1
  personalPlanId: string
  sourceNeedVersionId: string
  sourceInputHash: string
  previews: Stage1ProductExamplePreview[]
}

export function isStage1ProductExamplePreviewResponse(
  value: unknown,
): value is Stage1ProductExamplePreviewResponse {
  if (!value || typeof value !== "object") return false
  const response = value as Partial<Stage1ProductExamplePreviewResponse>
  return (
    response.schemaVersion === 1 &&
    typeof response.personalPlanId === "string" &&
    typeof response.sourceNeedVersionId === "string" &&
    typeof response.sourceInputHash === "string" &&
    Array.isArray(response.previews) &&
    response.previews.every(isProductExamplePreview)
  )
}

function isProductExamplePreview(value: unknown): value is Stage1ProductExamplePreview {
  if (!value || typeof value !== "object") return false
  const preview = value as Partial<Stage1ProductExamplePreview>
  return (
    typeof preview.category === "string" &&
    preview.category in CATEGORY_ROLE_POLICIES &&
    typeof preview.role === "string" &&
    CATEGORY_ROLE_POLICIES[preview.category as Stage1Category].allowedRoles.includes(
      preview.role as never,
    ) &&
    typeof preview.productId === "string" &&
    typeof preview.productName === "string" &&
    typeof preview.imageUrl === "string" &&
    (preview.verdict === "ideal" || preview.verdict === "supportive") &&
    preview.authorityVersion ===
      CATEGORY_ROLE_POLICIES[preview.category as Stage1Category].authorityVersion
  )
}

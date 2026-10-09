import { CATEGORY_ROLE_POLICIES } from "@/lib/personal-plan/products/authorities"
import type { Stage3CategoryProductFacts } from "@/lib/personal-plan/products/authority/contracts"
import { evaluateStage3Authority } from "@/lib/personal-plan/products/authority/evaluate"
import type { PersonalPlanCategory } from "@/lib/personal-plan/products/contracts"
import { bondbuilderApplication } from "@/lib/personal-plan/products/fit-comparison"
import { presentCatalogCommerce } from "@/lib/personal-plan/routine/commerce"
import type {
  InitialNeedPlanSnapshot,
  PlanCategoryDecision,
  PlanProductRole,
} from "@/lib/personal-plan/types"

/**
 * Equal-fit options for one Idealplan step (Nomi consult finish, plan T1).
 *
 * When an authority resolves a tie with a house default (Bondbuilder:
 * `bondbuilder.stage3.tie_default` → K18), the default is only one of several products that
 * evaluate exactly as well. The call may pick any of them — so the cockpit lists the others
 * next to the default. They come from the SAME candidate list and the SAME authority input
 * the preview used: no new ranking, no new rule, and nothing printed or hashed until a
 * participant's swap names one.
 *
 * Only a shortlist that the authority itself flags as an equal tie (a criterion id ending in
 * `.equal_shortlist`) produces options; every other step returns none.
 */

export type DiscoveryEqualOption = {
  productId: string
  productName: string
  /** The catalog's price label („8,95 €"), display only; null without a price. */
  priceLabel: string | null
  imageUrl: string | null
  /**
   * How the product is applied („Vorwäsche, ausspülen", „Leave-in nach der Wäsche", „Abends,
   * über Nacht im Haar") — what tells equally ideal options apart in the call (E2). Null when
   * the catalog facts carry no application mode.
   */
  applicationLabel: string | null
  /** The raw catalog application mode (`bedtime_leave_in`, …) — placement reads it (A3). */
  applicationMode: string | null
}

/** The raw application mode of a candidate whose facts carry one (Bondbuilder specs). */
export function discoveryApplicationModeOf(candidate: Stage3CategoryProductFacts): string | null {
  return (candidate as { spec?: { applicationMode?: string | null } }).spec?.applicationMode ?? null
}

/** The application label of a candidate whose facts carry one (Bondbuilder specs). */
export function discoveryApplicationLabelOf(candidate: Stage3CategoryProductFacts): string | null {
  const spec = (
    candidate as { spec?: { applicationMode?: string | null; treatmentMode?: string | null } }
  ).spec
  if (!spec || (spec.applicationMode == null && spec.treatmentMode == null)) return null
  return bondbuilderApplication({
    applicationMode: spec.applicationMode ?? null,
    treatmentMode: spec.treatmentMode ?? null,
  })
}

export function discoveryEqualOptions(input: {
  category: PersonalPlanCategory
  role: PlanProductRole
  decision: PlanCategoryDecision
  snapshot: InitialNeedPlanSnapshot
  sourceNeedVersionId: string
  candidates: readonly Stage3CategoryProductFacts[]
  /** The preview's pick — never repeated as an option. */
  selectedProductId: string
}): DiscoveryEqualOption[] {
  const authorityInput = {
    category: input.category,
    authorityVersion: CATEGORY_ROLE_POLICIES[input.category].authorityVersion,
    refinedVersionId: input.sourceNeedVersionId,
    refinedInputHash: input.snapshot.inputHash,
    subjectKey: `preview:${input.category}:${input.role}`,
    role: input.role,
    capturedProductId: null,
    subjectIdentity: null,
    categoryDecision: input.decision as never,
    coverage: input.snapshot.coverage,
    hairThickness: input.snapshot.profile.hair.thickness,
    productFacts: null,
    recommendationCandidates: input.candidates as never,
    heatCarrierCoverage: { carrierCategory: null, verifiedRoutes: [] },
  }
  const shortlist = evaluateStage3Authority(authorityInput)
  if (shortlist.status !== "known" || shortlist.verdict !== "ideal") return []
  const tied = (shortlist.criteria ?? []).some((criterion) =>
    criterion.criterionId.endsWith(".equal_shortlist"),
  )
  if (!tied) return []

  return input.candidates
    .filter(
      (candidate) =>
        candidate.productId !== input.selectedProductId &&
        candidate.recommendable &&
        candidate.isActive &&
        candidate.lifecycleStatus === "active",
    )
    .filter((candidate) => {
      const evaluation = evaluateStage3Authority({
        ...authorityInput,
        productFacts: candidate as never,
      })
      return evaluation.status === "known" && evaluation.verdict === "ideal"
    })
    .map((candidate) => {
      const commerce = candidate as Partial<{
        priceEur: number | null
        currency: string | null
        affiliateLink: string | null
        purchaseLinkStatus: "available" | "unavailable" | null
        priceCheckedAt: string | null
      }>
      return {
        productId: candidate.productId,
        productName: candidate.displayName,
        priceLabel: presentCatalogCommerce({
          priceEur: commerce.priceEur ?? null,
          currency: commerce.currency ?? null,
          affiliateLink: commerce.affiliateLink ?? null,
          purchaseLinkStatus: commerce.purchaseLinkStatus ?? null,
          updatedAt: commerce.priceCheckedAt ?? null,
        }).priceLabel,
        imageUrl: candidate.presentationImageUrl?.trim() || null,
        applicationLabel: discoveryApplicationLabelOf(candidate),
        applicationMode: discoveryApplicationModeOf(candidate),
      }
    })
    .sort(
      (left, right) =>
        left.productName.localeCompare(right.productName, "de") ||
        left.productId.localeCompare(right.productId),
    )
}

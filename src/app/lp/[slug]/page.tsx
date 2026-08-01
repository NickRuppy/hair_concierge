import type { Metadata } from "next"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { renderLandingVariant } from "@/funnels/landing/registry"
import {
  isPersonalPlanQuizCrossBrowserResumeEnabled,
  isPersonalPlanQuizV1Enabled,
} from "@/lib/funnel/flags"
import { getFunnelPackageBySlug } from "@/lib/funnel/packages"
import {
  PERSONAL_PLAN_QUIZ_DRAFT_COOKIE,
  PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY,
  resolvePersonalPlanQuizDraftLandingState,
} from "@/lib/personal-plan-quiz/server-draft"
import { LandingTracking } from "@/providers/tracking-providers"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function CampaignLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams])
  const funnelPackage = getFunnelPackageBySlug(slug)
  if (!funnelPackage) notFound()
  if (funnelPackage.key === "meta_personal_plan_v1" && !isPersonalPlanQuizV1Enabled()) {
    notFound()
  }

  const resumeToken = getSingleSearchParam(
    resolvedSearchParams[PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY],
  )
  const resumeEnabled = isPersonalPlanQuizCrossBrowserResumeEnabled()
  let personalPlanQuizResume

  if (funnelPackage.key === "meta_personal_plan_v1") {
    if (!resumeEnabled && resumeToken) redirect("/lp/haarplan")

    if (resumeEnabled) {
      const cookieStore = await cookies()
      const landingState = await resolvePersonalPlanQuizDraftLandingState({
        cookieValue: cookieStore.get(PERSONAL_PLAN_QUIZ_DRAFT_COOKIE)?.value,
        resumeToken,
      })

      if (landingState.shouldExchange && resumeToken) {
        redirect(
          `/api/quiz/personal-plan-draft/resume?${PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY}=${encodeURIComponent(resumeToken)}`,
        )
      }

      personalPlanQuizResume = { enabled: true, snapshot: landingState.snapshot }
    }
  }

  const landingVariant = renderLandingVariant(funnelPackage.landingVariant, {
    personalPlanQuizResume,
  })
  if (!landingVariant) notFound()

  return (
    <>
      <LandingTracking />
      {landingVariant}
    </>
  )
}

function getSingleSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" && value.length > 0 ? value : null
}

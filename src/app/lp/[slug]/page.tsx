import type { Metadata } from "next"
import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { renderLandingVariant } from "@/funnels/landing/registry"
import {
  isPersonalPlanQuizCrossBrowserResumeEnabled,
  isPersonalPlanQuizV1Enabled,
  isPersonalPlanResultReturnEnabled,
} from "@/lib/funnel/flags"
import { getFunnelPackageBySlug } from "@/lib/funnel/packages"
import {
  PERSONAL_PLAN_QUIZ_DRAFT_COOKIE,
  PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY,
  resolvePersonalPlanQuizDraftLandingState,
} from "@/lib/personal-plan-quiz/server-draft"
import {
  type PersonalPlanResultReturnResolution,
  PERSONAL_PLAN_RESULT_RETURN_COOKIE,
  resolvePersonalPlanResultReturn,
  resolvePersonalPlanReturnLanding,
} from "@/lib/personal-plan-quiz/result-return"
import { LandingTracking } from "@/providers/tracking-providers"

export const dynamic = "force-dynamic"

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
  if (funnelPackage.key === "meta_routine_v1") {
    redirect(buildRetiredRoutineRedirect(resolvedSearchParams))
  }
  if (funnelPackage.status === "archived") notFound()
  if (funnelPackage.key === "meta_personal_plan_v1" && !isPersonalPlanQuizV1Enabled()) {
    notFound()
  }

  const resumeToken = getSingleSearchParam(
    resolvedSearchParams[PERSONAL_PLAN_QUIZ_RESUME_QUERY_KEY],
  )
  const resumeEnabled = isPersonalPlanQuizCrossBrowserResumeEnabled()
  let personalPlanQuizResume

  if (funnelPackage.key === "meta_personal_plan_v1") {
    const cookieStore = await cookies()
    const resultCookie = cookieStore.get(PERSONAL_PLAN_RESULT_RETURN_COOKIE)?.value
    let resultReturn: PersonalPlanResultReturnResolution = {
      leadId: null,
      status: "invalid",
    }

    if (isPersonalPlanResultReturnEnabled() && resultCookie) {
      resultReturn = await resolvePersonalPlanResultReturn(resultCookie)
    }

    const initialReturnDecision = resolvePersonalPlanReturnLanding({
      resultReturn,
      resumeToken,
    })
    if (initialReturnDecision.kind === "result") {
      redirect(`/result/${encodeURIComponent(initialReturnDecision.leadId)}?entry=quiz_return`)
    }

    if (resumeToken && !resumeEnabled) {
      redirect("/lp/haarplan")
    }

    if (resumeEnabled) {
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

const SAFE_RETIRED_ROUTINE_QUERY_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
] as const

export function buildRetiredRoutineRedirect(
  searchParams: Record<string, string | string[] | undefined>,
) {
  const params = new URLSearchParams()
  for (const key of SAFE_RETIRED_ROUTINE_QUERY_KEYS) {
    const value = getSingleSearchParam(searchParams[key])
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `/?${query}` : "/"
}

function getSingleSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" && value.length > 0 ? value : null
}

import { permanentRedirect, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow"
import { linkQuizToProfile } from "@/lib/quiz/link-to-profile"
import { getOnboardingEditScope, type OnboardingStep } from "@/lib/onboarding/store"
import { resolveIntakeState } from "@/lib/auth/intake-state"
import { PRODUCT_CATEGORY_ORDER } from "@/lib/onboarding/product-options"

type OnboardingSearchParams = {
  lead?: string | string[]
  step?: string | string[]
  returnTo?: string | string[]
  category?: string | string[]
  editMode?: string | string[]
}

interface OnboardingPageProps {
  searchParams: Promise<OnboardingSearchParams>
}

const VALID_ONBOARDING_STEPS = new Set<OnboardingStep>([
  "welcome",
  "products_basics",
  "products_extras",
  "product_drilldown",
  "heat_tools",
  "heat_frequency",
  "heat_protection",
  "interstitial",
  "towel_material",
  "towel_technique",
  "drying_method",
  "brush_type",
  "night_protection",
  "celebration",
])
const VALID_PRODUCT_CATEGORIES = new Set(PRODUCT_CATEGORY_ORDER)
const PRODUCT_CATEGORY_ALIASES: Record<string, string> = {
  bond_builder: "bondbuilder",
  hair_oil: "oil",
  scalp_peeling: "peeling",
}

function firstSearchParamValue(value: string | string[] | undefined): string | null {
  return (Array.isArray(value) ? value[0] : value) ?? null
}

function canonicalizeProductCategory(value: string | string[] | undefined): string | null {
  const candidate = firstSearchParamValue(value)?.trim()
  if (!candidate) {
    return null
  }
  return PRODUCT_CATEGORY_ALIASES[candidate] ?? candidate
}

function appendSearchParam(
  params: URLSearchParams,
  key: keyof OnboardingSearchParams,
  value: string | string[] | undefined,
) {
  if (Array.isArray(value)) {
    value.forEach((item) => params.append(key, item))
    return
  }

  if (value) {
    params.set(key, value)
  }
}

function buildCanonicalOnboardingPath(
  searchParams: OnboardingSearchParams,
  canonicalCategory: string,
) {
  const params = new URLSearchParams()
  appendSearchParam(params, "lead", searchParams.lead)
  appendSearchParam(params, "step", searchParams.step)
  appendSearchParam(params, "returnTo", searchParams.returnTo)
  params.set("category", canonicalCategory)
  appendSearchParam(params, "editMode", searchParams.editMode)

  return `/onboarding?${params.toString()}`
}

function resolveOnboardingStep(value: string | string[] | undefined): OnboardingStep | null {
  const candidate = Array.isArray(value) ? value[0] : value
  if (!candidate || !VALID_ONBOARDING_STEPS.has(candidate as OnboardingStep)) {
    return null
  }
  return candidate as OnboardingStep
}

function resolveReturnTo(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value
  if (!candidate || !candidate.startsWith("/")) {
    return null
  }
  return candidate
}

function resolveDrilldownCategory(value: string | string[] | undefined): string | null {
  const normalizedCandidate = canonicalizeProductCategory(value)
  if (!normalizedCandidate) {
    return null
  }
  return VALID_PRODUCT_CATEGORIES.has(normalizedCandidate) ? normalizedCandidate : null
}

function resolveSingleStepEdit(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value
  return candidate === "single-step"
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const supabase = await createClient()
  const admin = createAdminClient()
  const resolvedSearchParams = await searchParams
  const leadId = Array.isArray(resolvedSearchParams.lead)
    ? resolvedSearchParams.lead[0]
    : resolvedSearchParams.lead
  const forcedStep = resolveOnboardingStep(resolvedSearchParams.step)
  const returnTo = resolveReturnTo(resolvedSearchParams.returnTo)
  const initialDrilldownCategory = resolveDrilldownCategory(resolvedSearchParams.category)
  const singleStepEdit = resolveSingleStepEdit(resolvedSearchParams.editMode)
  const editScope =
    returnTo && forcedStep && !singleStepEdit ? getOnboardingEditScope(forcedStep) : null
  const rawDrilldownCategory = firstSearchParamValue(resolvedSearchParams.category)?.trim()

  if (
    rawDrilldownCategory &&
    initialDrilldownCategory &&
    rawDrilldownCategory !== initialDrilldownCategory
  ) {
    permanentRedirect(buildCanonicalOnboardingPath(resolvedSearchParams, initialDrilldownCategory))
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect("/auth?next=/onboarding")
  }

  // Link quiz lead if present
  if (leadId) {
    try {
      await linkQuizToProfile(user.id, user.email, leadId)
    } catch (error) {
      console.error("Onboarding lead link failed:", error)
    }
  }

  // Fetch profile data
  const { data: profileRow } = await admin
    .from("profiles")
    .select("onboarding_completed, onboarding_step, has_seen_completion_popup")
    .eq("id", user.id)
    .single()

  // Fetch hair profile for pre-filling
  const { data: hairProfile } = await admin
    .from("hair_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle()

  const intakeState = resolveIntakeState(profileRow, hairProfile)

  if (intakeState === "needs_quiz") {
    redirect("/quiz")
  }

  if (intakeState === "ready" && !forcedStep) {
    redirect(returnTo ?? "/chat")
  }

  // Fetch existing product usage
  const { data: productUsage } = await admin
    .from("user_product_usage")
    .select("*")
    .eq("user_id", user.id)

  return (
    <OnboardingFlow
      userId={user.id}
      initialStep={forcedStep ?? (profileRow?.onboarding_step as string) ?? "welcome"}
      onboardingCompleted={Boolean(profileRow?.onboarding_completed)}
      hairProfile={hairProfile}
      productUsage={productUsage ?? []}
      returnTo={returnTo}
      editScope={editScope}
      singleStepEdit={singleStepEdit}
      initialDrilldownCategory={
        forcedStep === "product_drilldown" ? initialDrilldownCategory : null
      }
      allowCompletionFallback={!forcedStep && profileRow?.onboarding_step === "celebration"}
    />
  )
}

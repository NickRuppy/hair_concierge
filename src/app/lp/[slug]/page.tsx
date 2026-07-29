import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { renderLandingVariant } from "@/funnels/landing/registry"
import { isPersonalPlanQuizV1Enabled } from "@/lib/funnel/flags"
import { getFunnelPackageBySlug } from "@/lib/funnel/packages"
import { LandingTracking } from "@/providers/tracking-providers"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function CampaignLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const funnelPackage = getFunnelPackageBySlug(slug)
  if (!funnelPackage) notFound()
  if (funnelPackage.key === "meta_personal_plan_v1" && !isPersonalPlanQuizV1Enabled()) {
    notFound()
  }
  const landingVariant = renderLandingVariant(funnelPackage.landingVariant)
  if (!landingVariant) notFound()

  return (
    <>
      <LandingTracking />
      {landingVariant}
    </>
  )
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Home from "@/app/page"
import { getFunnelPackageBySlug } from "@/lib/funnel/packages"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function CampaignLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!getFunnelPackageBySlug(slug)) notFound()
  return <Home />
}

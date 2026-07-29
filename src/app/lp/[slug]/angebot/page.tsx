import { notFound } from "next/navigation"
import { isPersonalPlanQuizV1Enabled } from "@/lib/funnel/flags"
import { getFunnelPackageBySlug } from "@/lib/funnel/packages"
import { PRIVATE_PAGE_METADATA } from "@/lib/seo/site-identity"

export const metadata = PRIVATE_PAGE_METADATA

export default async function PersonalPlanQuizOfferPlaceholderPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const funnelPackage = getFunnelPackageBySlug(slug)

  if (funnelPackage?.key !== "meta_personal_plan_v1" || !isPersonalPlanQuizV1Enabled()) {
    notFound()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center px-6 py-16">
      <div className="space-y-4">
        <p className="text-sm font-medium text-foreground/60">Dein persönlicher Haarplan</p>
        <h1 className="text-3xl font-semibold tracking-tight">Fast geschafft</h1>
        <p className="text-base leading-7 text-foreground/75">
          Diese Seite wird gerade vorbereitet. Schau bitte bald wieder vorbei.
        </p>
      </div>
    </main>
  )
}

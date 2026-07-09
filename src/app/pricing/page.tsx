import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

import { PricingCards } from "./pricing-cards"

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; reason?: string; interval?: string }>
}) {
  const sp = await searchParams
  const leadId = sp.lead ?? null

  // Pricing requires an identity to check out with. Anonymous visitors with no
  // lead (direct URL, stale /offer links) can't complete checkout — send them
  // into the quiz instead of a dead-end payment form. Lead-carrying (post-quiz)
  // and authenticated (resubscribe/app) visitors keep normal pricing.
  if (!leadId) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect("/quiz")
  }

  const showResubBanner = sp.reason === "resubscribe"
  const rawInterval = sp.interval
  const initialInterval =
    rawInterval === "month" || rawInterval === "quarter" || rawInterval === "year"
      ? rawInterval
      : null

  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      {showResubBanner && (
        <div className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Dein Abo ist abgelaufen — jetzt wieder freischalten.
        </div>
      )}
      <header className="mb-10 text-center">
        <h1 className="font-header text-4xl">Dein personalisierter Haar-Concierge</h1>
        <p className="mt-3 text-lg text-muted-foreground">Wähle deinen Plan — jederzeit kündbar.</p>
      </header>
      <PricingCards leadId={leadId} initialInterval={initialInterval} />
    </main>
  )
}

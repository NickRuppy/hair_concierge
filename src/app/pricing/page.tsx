import { PricingCards } from "./pricing-cards"

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string; reason?: string }>
}) {
  const sp = await searchParams
  const leadId = sp.lead ?? null
  const showResubBanner = sp.reason === "resubscribe"

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
      <PricingCards leadId={leadId} />
    </main>
  )
}

import { EmbeddedCheckoutMount } from "./embedded-checkout"
import { redirect } from "next/navigation"

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ interval?: string; lead?: string }>
}) {
  const sp = await searchParams
  const interval = sp.interval
  if (interval !== "month" && interval !== "quarter" && interval !== "year") {
    redirect("/pricing")
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-header mb-6 text-2xl">Zahlungsdetails</h1>
      <EmbeddedCheckoutMount interval={interval} leadId={sp.lead ?? null} />
    </main>
  )
}

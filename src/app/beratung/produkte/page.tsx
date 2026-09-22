import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { DiscoveryIntakeChecklist } from "@/components/discovery/intake/discovery-intake-checklist"
import type { DiscoveryIntakeItemView } from "@/components/discovery/intake/types"
import { isDiscoveryCallToolkitEnabled } from "@/lib/discovery/flag"
import {
  loadDiscoveryIntakeItems,
  resolveDiscoveryIntakeContext,
  type DiscoveryIntakeItem,
} from "@/lib/discovery/intake"
import { DISCOVERY_QUIZ_ENTRY_HREF } from "@/lib/discovery/participant"
import { isRetailerSearchEnabled } from "@/lib/scan/enrichment/flag"

import { ensureDiscoveryQuizProjection } from "./quiz-projection"

/**
 * The participant's product checklist — the terminal destination of the
 * discovery middleware gate, and the only page a participant is meant to spend
 * time on before the call.
 *
 * Three guards, in order:
 *   1. the kill switch,
 *   2. a live enrollment for the SIGNED-IN account (`resolveDiscoveryIntakeContext`
 *      re-reads it per request, so a revoked participant 404s here even while
 *      their JWT still carries the stamp),
 *   3. the quiz projection — diagnostics present AND the legacy lead bound.
 *      Missing either one means the quiz did not actually land, and the page
 *      sends them back to `/quiz` rather than collecting products for a profile
 *      that cannot be read at the call.
 */

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

/** The browser never sees `product_id` / `product_submission_id`. */
function toItemView(item: DiscoveryIntakeItem): DiscoveryIntakeItemView {
  return {
    id: item.id,
    category: item.category,
    source: item.source,
    brandText: item.brandText,
    productNameText: item.productNameText,
    barcodeIdentifier: item.barcodeIdentifier,
  }
}

export default async function DiscoveryChecklistPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!isDiscoveryCallToolkitEnabled()) notFound()

  const context = await resolveDiscoveryIntakeContext()
  if (context.status !== "ready") notFound()
  const { userId, enrollment, intake, admin } = context

  const params = searchParams ? await searchParams : {}
  const rawLead = params.lead
  const leadId = typeof rawLead === "string" && rawLead.trim() ? rawLead.trim() : null

  const projection = await ensureDiscoveryQuizProjection({
    client: admin,
    userId,
    email: enrollment.email,
    leadId,
  })
  if (!projection.hasDiagnostics || !projection.leadBound) redirect(DISCOVERY_QUIZ_ENTRY_HREF)

  const items = await loadDiscoveryIntakeItems(intake.id, admin)

  return (
    <DiscoveryIntakeChecklist
      initialItems={items.map(toItemView)}
      initialSubmitted={intake.state === "submitted"}
      // Threaded from the server exactly like `/scan/page.tsx` does it: the dm
      // lane's flag is not Edge/browser-safe.
      retailerSearchEnabled={isRetailerSearchEnabled()}
    />
  )
}

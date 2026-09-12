import { resolveFunnelContextForLead } from "@/lib/funnel/server"

/**
 * Package identity of a checkout's lead, read from `funnel_sessions` on the server.
 *
 * Kept out of `checkout-success-redirect.ts` on purpose: that module is imported by
 * the "use client" welcome client, so it must stay free of admin-client imports.
 * Returns `null` whenever attribution is off, the lead is unknown, or the lookup
 * fails — a missing package must never block a paid buyer's activation.
 */
export async function resolveCheckoutFunnelPackageKey(
  leadId?: string | null,
): Promise<string | null> {
  if (!leadId) return null
  try {
    return (await resolveFunnelContextForLead(leadId))?.packageKey ?? null
  } catch (error) {
    console.warn("[checkout-success] funnel package unavailable", error)
    return null
  }
}

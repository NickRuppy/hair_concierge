import { PublicFlowProviders } from "@/providers/tracking-providers"

/**
 * Die Warteliste ist eine Ad-Landingpage, deshalb braucht sie dasselbe Tracking
 * wie die uebrigen oeffentlichen Strecken: Meta-Pixel, Customer.io, PostHog und
 * vor allem den Funnel-Context.
 *
 * Ohne den Funnel-Context setzt niemand das Session-Cookie, und `/api/waitlist`
 * liest dann leere Werte fuer funnel_session_id und funnel_package_key. Die
 * Eintraege kaemen in Customer.io ohne jede Herkunft an.
 */
export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return <PublicFlowProviders>{children}</PublicFlowProviders>
}

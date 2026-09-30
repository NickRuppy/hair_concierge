/**
 * Shared between the discovery-call offer (client) and the Calendly webhook
 * (server) — keep this module free of Node imports.
 */

/** `utm_source` the offer page stamps on the embed, so bookings are legible in Calendly too. */
export const CALENDLY_FUNNEL_UTM_SOURCE = "chaarlie_funnel"

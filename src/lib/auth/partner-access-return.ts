export const PARTNER_ACCESS_RETURN_PATH = "/partner/weiter"
const HANDOFF = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export function isPartnerAccessReturnPath(value: string | null | undefined): value is string {
  if (!value || value.length > 1200) return false
  try {
    const destination = new URL(value, "https://partner-return.invalid")
    if (destination.pathname !== PARTNER_ACCESS_RETURN_PATH || destination.search) return false
    if (!destination.hash) return true
    const params = new URLSearchParams(destination.hash.slice(1))
    const handoff = params.get("handoff")
    return params.size === 1 && typeof handoff === "string" && HANDOFF.test(handoff)
  } catch {
    return false
  }
}

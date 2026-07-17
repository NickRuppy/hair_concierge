const META_OFFER_VIEW_ID_NAMESPACE = "meta-offer-view-v2"

export async function deriveMetaOfferViewEventIdForLead(leadId: string) {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) throw new Error("Web Crypto is unavailable")
  const canonicalLeadId = leadId.trim().toLowerCase()

  const digest = new Uint8Array(
    await subtle.digest(
      "SHA-256",
      new TextEncoder().encode(`${META_OFFER_VIEW_ID_NAMESPACE}:${canonicalLeadId}`),
    ),
  )
  const bytes = digest.slice(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x80
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-")
}

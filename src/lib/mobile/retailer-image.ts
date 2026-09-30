import { validateDmImageUrl } from "@/lib/scan/enrichment/resolve-enrichment"

/** Keep retailer hosts out of the native contract via the existing Next image proxy. */
export function buildRetailerImageProxyUrl(
  rawImageUrl: string | null,
  requestUrl: string | undefined,
): string | null {
  if (!rawImageUrl || !requestUrl || !validateDmImageUrl(rawImageUrl)) return null
  try {
    const request = new URL(requestUrl)
    if (!/^https?:$/.test(request.protocol) || request.username || request.password) return null
    const image = new URL("/_next/image", request.origin)
    image.searchParams.set("url", rawImageUrl)
    image.searchParams.set("w", "256")
    image.searchParams.set("q", "75")
    return image.toString()
  } catch {
    return null
  }
}

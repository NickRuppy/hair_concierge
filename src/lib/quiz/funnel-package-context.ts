import { resolveFunnelCookieContext } from "@/lib/funnel/server"

/**
 * Reads the funnel package the current visitor was attributed to out of the
 * signed session cookie. `null` means "no attributable package" — the quiz then
 * behaves exactly as it does for organic traffic.
 */
export async function resolveQuizFunnelPackageKey(
  cookieValue: string | undefined,
  resolve = resolveFunnelCookieContext,
): Promise<string | null> {
  const context = await resolve(cookieValue)
  return context?.packageKey ?? null
}

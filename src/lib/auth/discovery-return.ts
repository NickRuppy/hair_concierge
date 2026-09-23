export const DISCOVERY_RETURN_PATH = "/beratung/weiter"
/** The invite credential's shape: `v1.<base64url payload>.<base64url signature>`. */
const HANDOFF = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

/**
 * The discovery-call analogue of `isPartnerAccessReturnPath`, and it carries the
 * same two jobs in `/auth/confirm`:
 *
 *  1. The hash must survive sanitisation. The credential is opaque base64url, so
 *     it can contain the substrings `code`, `token` or `error` by chance; without
 *     this exemption the handoff would be silently stripped and the claim would
 *     land on the continuation page with nothing to continue.
 *  2. `linkQuizToProfile` must NOT run for this destination. The account exists,
 *     but the discovery quiz has not been taken yet — projecting whatever legacy
 *     lead the address happens to own into `hair_profiles` here would write a
 *     stale profile before the claim and could falsely satisfy the checklist's
 *     "diagnostics present and lead bound" completion criterion.
 *
 * Deliberately strict: the exact path, no query string, and at most a single
 * `handoff` fragment parameter of the credential's shape.
 */
export function isDiscoveryReturnPath(value: string | null | undefined): value is string {
  if (!value || value.length > 1200) return false
  // Relative-only. `new URL(value, base)` keeps an absolute input's own origin,
  // so without this an `https://evil.test/beratung/weiter#handoff=…` would pass
  // the pathname check. `/auth/confirm` only ever hands this predicate a
  // same-origin destination, but the predicate should not depend on that.
  if (!value.startsWith("/") || value.startsWith("//")) return false
  try {
    const destination = new URL(value, "https://discovery-return.invalid")
    if (destination.pathname !== DISCOVERY_RETURN_PATH || destination.search) return false
    if (!destination.hash) return true
    const params = new URLSearchParams(destination.hash.slice(1))
    const handoff = params.get("handoff")
    return params.size === 1 && typeof handoff === "string" && HANDOFF.test(handoff)
  } catch {
    return false
  }
}

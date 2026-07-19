type SearchParamsLike = { toString(): string } | null

export const META_QUIZ_EVENT_SOURCE_URL = "https://chaarlie.de/quiz"
export const META_OFFER_EVENT_SOURCE_URL = "https://chaarlie.de/result"
export const META_CHECKOUT_RETURN_EVENT_SOURCE_URL = "https://chaarlie.de/welcome"

const SAFE_RESULT_QUERY_VALUES = {
  entry: new Set(["quiz_completion"]),
  focus: new Set(["routine", "unlock-plan"]),
} as const

const SENSITIVE_BROWSER_QUERY_KEYS = new Set([
  "access_token",
  "code",
  "email",
  "next",
  "redirect_to",
  "refresh_token",
  "session_id",
  "token",
  "token_hash",
])

export type SafeAnalyticsPageContext = {
  path: string
  referrer: string
  search: string
  title: string
  url: string
}

export function buildSafeAnalyticsPath(pathname: string, searchParams: SearchParamsLike) {
  if (!pathname.startsWith("/result/")) return pathname

  const source = new URLSearchParams(searchParams?.toString())
  const safe = new URLSearchParams()

  for (const [key, allowedValues] of Object.entries(SAFE_RESULT_QUERY_VALUES)) {
    const value = source.get(key)
    if (value && allowedValues.has(value)) safe.set(key, value)
  }

  const query = safe.toString()
  return pathname + (query ? `?${query}` : "")
}

export function sanitizeAnalyticsUrl(value: string) {
  try {
    const url = new URL(value)
    return `${url.origin}${buildSafeAnalyticsPath(url.pathname, url.searchParams)}`
  } catch {
    return value.split(/[?#]/, 1)[0]
  }
}

export function buildSafeAnalyticsPageContext({
  href,
  pathname,
  referrer,
  search,
  title,
}: {
  href: string
  pathname: string
  referrer: string
  search: string
  title: string
}): SafeAnalyticsPageContext {
  const currentUrl = new URL(href)
  const safePath = buildSafeAnalyticsPath(pathname, new URLSearchParams(search))
  const safeUrl = new URL(safePath, currentUrl.origin)

  return {
    path: safeUrl.pathname,
    referrer: referrer ? sanitizeAnalyticsUrl(referrer) : "",
    search: safeUrl.search,
    title,
    url: safeUrl.toString(),
  }
}

function containsSensitiveQueryKey(searchParams: URLSearchParams) {
  return Array.from(searchParams.keys()).some((key) =>
    SENSITIVE_BROWSER_QUERY_KEYS.has(key.toLowerCase()),
  )
}

export function hasSensitiveBrowserAnalyticsLocation(searchParams: SearchParamsLike, hash = "") {
  const source = new URLSearchParams(searchParams?.toString())
  if (containsSensitiveQueryKey(source)) return true

  const fragment = hash.replace(/^#/, "")
  if (!fragment) return false
  const queryStart = fragment.indexOf("?")
  const fragmentQuery = queryStart >= 0 ? fragment.slice(queryStart + 1) : fragment
  return containsSensitiveQueryKey(new URLSearchParams(fragmentQuery))
}

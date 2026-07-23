export type RouteClassification = "public" | "protected" | "legacy" | "development" | "unknown"

export type RouteEnvironment = {
  nodeEnv: string | undefined
  localDevLoginEnabled: boolean
  vercelEnv?: string | undefined
}

const PUBLIC_EXACT_ROUTES = [
  "/",
  "/agb",
  "/datenschutz",
  "/icon",
  "/impressum",
  "/kontakt",
  "/methodik",
  "/opengraph-image",
  "/pricing",
  "/quiz",
  "/robots.txt",
  "/sitemap.xml",
  "/twitter-image",
  "/welcome",
  "/widerruf",
]

const PUBLIC_ROUTE_PREFIXES = [
  "/auth",
  "/lp",
  "/result",
  "/api/funnel",
  "/api/og",
  "/api/paypal",
  "/api/quiz",
  "/api/stripe",
]

const PUBLIC_API_EXACT_ROUTES = [
  "/api/analytics/meta-offer-view",
  "/api/analytics/offer-engaged",
  "/api/auth/callback",
  "/api/auth/send-magic-link",
  "/api/auth/send-setup-link",
  "/api/auth/set-checkout-password",
]

const PROTECTED_ROUTE_PREFIXES = [
  "/admin",
  "/chat",
  "/onboarding",
  "/profile",
  "/reactivate",
  "/routine",
  "/tracker",
  "/api/admin",
  "/api/billing",
  "/api/chat",
  "/api/feedback",
  "/api/memory",
  "/api/product-intake",
  "/api/products",
  "/api/profile",
  "/api/routine",
  "/api/tracker",
]

const DEVELOPMENT_ROUTE_PREFIXES = ["/labs", "/api/labs"]
const DEVELOPMENT_EXACT_ROUTES = ["/api/debug/build-info"]
const LOCAL_LOGIN_ROUTE = "/api/dev/login"
const VERCEL_PREVIEW_DEVELOPMENT_ROUTES = ["/labs/offer-page", "/labs/portrait"]

export function pathMatchesRoutePrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

function matchesRoutePrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathMatchesRoutePrefix(pathname, prefix))
}

export function classifyRoute(
  pathname: string,
  environment: RouteEnvironment,
): RouteClassification {
  if (pathname === "/offer") {
    return "legacy"
  }

  const isDevelopment = environment.nodeEnv === "development"
  const isVercelPreview = environment.vercelEnv === "preview"
  const isLocalLoginRoute = pathname === LOCAL_LOGIN_ROUTE
  const isStandardDevelopmentRoute =
    DEVELOPMENT_EXACT_ROUTES.includes(pathname) ||
    matchesRoutePrefix(pathname, DEVELOPMENT_ROUTE_PREFIXES)

  if (isLocalLoginRoute) {
    return isDevelopment && environment.localDevLoginEnabled ? "development" : "protected"
  }

  if (VERCEL_PREVIEW_DEVELOPMENT_ROUTES.includes(pathname) && isVercelPreview) {
    return "development"
  }

  if (isStandardDevelopmentRoute) {
    return isDevelopment ? "development" : "protected"
  }

  if (
    PUBLIC_EXACT_ROUTES.includes(pathname) ||
    PUBLIC_API_EXACT_ROUTES.includes(pathname) ||
    matchesRoutePrefix(pathname, PUBLIC_ROUTE_PREFIXES)
  ) {
    return "public"
  }

  if (matchesRoutePrefix(pathname, PROTECTED_ROUTE_PREFIXES)) {
    return "protected"
  }

  return "unknown"
}

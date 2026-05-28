import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const securityHeaders = [
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://eu.i.posthog.com https://cdp-eu.customer.io https://js.stripe.com https://checkout.stripe.com https://www.paypal.com https://www.paypalobjects.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://www.tophair.de https://assets.cdn.filesafe.space",
      "font-src 'self' data:",
      "connect-src 'self' https://eu.i.posthog.com https://eu.posthog.com https://cdp-eu.customer.io https://*.supabase.co https://*.sentry.io https://api.stripe.com https://js.stripe.com https://checkout.stripe.com https://www.paypal.com https://www.sandbox.paypal.com https://api-m.paypal.com https://api-m.sandbox.paypal.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://checkout.stripe.com https://www.paypal.com https://www.sandbox.paypal.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
]

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this repo even when a parent folder has another lockfile.
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.tophair.de",
        pathname: "/app/uploads/**",
      },
      {
        protocol: "https",
        hostname: "assets.cdn.filesafe.space",
        pathname: "/**",
      },
    ],
  },
  outputFileTracingIncludes: {
    "/api/chat": ["./data/agent-guidance/**/*"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }]
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "haircare-fw",
  project: "hair-concierge",
})

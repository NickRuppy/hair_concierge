import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs"

const nextConfig: NextConfig = {
  // Keep Turbopack scoped to this repo even when a parent folder has another lockfile.
  turbopack: {
    root: process.cwd(),
  },
}

export default withSentryConfig(nextConfig, {
  silent: true,
  org: "haircare-fw",
  project: "hair-concierge",
})

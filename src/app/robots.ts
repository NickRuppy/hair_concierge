import type { MetadataRoute } from "next"
import { SITE_ORIGIN } from "@/lib/seo/site-identity"

const PRIVATE_CRAWL_PATHS = [
  "/admin",
  "/api/",
  "/auth",
  "/chat",
  "/labs",
  "/onboarding",
  "/profile",
  "/result/",
  "/routine",
  "/welcome",
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_CRAWL_PATHS,
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
  }
}

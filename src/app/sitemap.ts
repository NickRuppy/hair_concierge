import type { MetadataRoute } from "next"

import { SITE_ORIGIN } from "@/lib/seo/site-identity"

const STATIC_SITEMAP_PATHS = [
  "/",
  "/quiz",
  "/methodik",
  "/kontakt",
  "/impressum",
  "/datenschutz",
  "/agb",
  "/widerruf",
] as const

export function buildSitemap(): MetadataRoute.Sitemap {
  return STATIC_SITEMAP_PATHS.map((pathname) => ({
    url: `${SITE_ORIGIN}${pathname}`,
  }))
}

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap()
}

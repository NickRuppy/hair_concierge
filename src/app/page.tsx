import type { Metadata } from "next"
import DefaultLandingVariant from "@/funnels/landing/default"
import { LandingTracking } from "@/providers/tracking-providers"
import { JsonLd } from "@/components/seo/json-ld"
import { HOME_METADATA, ORGANIZATION_JSON_LD, WEBSITE_JSON_LD } from "@/lib/seo/site-identity"

export const metadata: Metadata = HOME_METADATA

export default function Home() {
  return (
    <>
      <JsonLd data={ORGANIZATION_JSON_LD} />
      <JsonLd data={WEBSITE_JSON_LD} />
      <LandingTracking />
      <DefaultLandingVariant />
    </>
  )
}

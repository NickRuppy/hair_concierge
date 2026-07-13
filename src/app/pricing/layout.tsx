import type { Metadata } from "next"

import { PublicFlowProviders } from "@/providers/tracking-providers"
import { PRICING_METADATA } from "@/lib/seo/site-identity"

export const metadata: Metadata = PRICING_METADATA

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <PublicFlowProviders>{children}</PublicFlowProviders>
}

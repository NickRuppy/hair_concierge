import { PublicFlowProviders } from "@/providers/route-providers"
import { PRIVATE_PAGE_METADATA } from "@/lib/seo/site-identity"

export const dynamic = "force-dynamic"
export const metadata = PRIVATE_PAGE_METADATA

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <PublicFlowProviders>{children}</PublicFlowProviders>
}

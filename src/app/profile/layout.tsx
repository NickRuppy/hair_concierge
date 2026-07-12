import { AppRouteProviders } from "@/providers/route-providers"
import { PRIVATE_PAGE_METADATA } from "@/lib/seo/site-identity"

export const metadata = PRIVATE_PAGE_METADATA

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <AppRouteProviders>{children}</AppRouteProviders>
}

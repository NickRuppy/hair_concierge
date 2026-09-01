import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell"
import {
  loadAuthenticatedAppNavigationAccess,
  schedulePersonalPlanNavSurfaceVisit,
} from "@/lib/personal-plan/navigation-access"
import { AppRouteProviders } from "@/providers/route-providers"
import { PRIVATE_PAGE_METADATA } from "@/lib/seo/site-identity"

export const metadata = PRIVATE_PAGE_METADATA

export default async function ScanLayout({ children }: { children: React.ReactNode }) {
  const navigation = await loadAuthenticatedAppNavigationAccess()
  await schedulePersonalPlanNavSurfaceVisit(navigation, "scan")
  return (
    <AppRouteProviders>
      <AuthenticatedAppShell navigation={navigation}>{children}</AuthenticatedAppShell>
    </AppRouteProviders>
  )
}

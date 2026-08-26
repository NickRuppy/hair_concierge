import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell"
import { loadAuthenticatedAppNavigationAccess } from "@/lib/personal-plan/navigation-access"
import { AppRouteProviders } from "@/providers/route-providers"
import { PRIVATE_PAGE_METADATA } from "@/lib/seo/site-identity"

export const metadata = PRIVATE_PAGE_METADATA

export default async function ScanLayout({ children }: { children: React.ReactNode }) {
  // No `schedulePersonalPlanNavSurfaceVisit` call here: Scan stays out of
  // the tab bar during its stealth rollout (see navigation-access.ts), so
  // there is no dot to ever clear for it.
  const navigation = await loadAuthenticatedAppNavigationAccess()
  return (
    <AppRouteProviders>
      <AuthenticatedAppShell navigation={navigation}>{children}</AuthenticatedAppShell>
    </AppRouteProviders>
  )
}

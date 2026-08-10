import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell"
import { loadAuthenticatedAppNavigationAccess } from "@/lib/personal-plan/navigation-access"
import { AppRouteProviders } from "@/providers/route-providers"
import { PRIVATE_PAGE_METADATA } from "@/lib/seo/site-identity"

export const metadata = PRIVATE_PAGE_METADATA

export default async function RoutineLayout({ children }: { children: React.ReactNode }) {
  const navigation = await loadAuthenticatedAppNavigationAccess()
  return (
    <AppRouteProviders>
      <AuthenticatedAppShell navigation={navigation}>{children}</AuthenticatedAppShell>
    </AppRouteProviders>
  )
}

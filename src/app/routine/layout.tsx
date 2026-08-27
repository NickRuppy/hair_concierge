import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell"
import { loadAuthenticatedAppNavigationAccess } from "@/lib/personal-plan/navigation-access"
import { AppRouteProviders } from "@/providers/route-providers"
import { PRIVATE_PAGE_METADATA } from "@/lib/seo/site-identity"

export const metadata = PRIVATE_PAGE_METADATA

export default async function RoutineLayout({ children }: { children: React.ReactNode }) {
  // No `schedulePersonalPlanNavSurfaceVisit` call here: Routine is the
  // Personal Plan's landing surface, so its tab is simply never dotted
  // (Task 2.9, decision 14) — see `shouldShowNavUnvisitedDot` in
  // lifecycle/repository.ts. Marking it visited would be a no-op anyway.
  const navigation = await loadAuthenticatedAppNavigationAccess()
  return (
    <AppRouteProviders>
      <AuthenticatedAppShell navigation={navigation}>{children}</AuthenticatedAppShell>
    </AppRouteProviders>
  )
}

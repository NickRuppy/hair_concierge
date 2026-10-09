import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell"
import { PlanInviteProvider } from "@/components/layout/plan-invite-banner"
import {
  loadAuthenticatedAppNavigationAccess,
  schedulePersonalPlanNavSurfaceVisit,
} from "@/lib/personal-plan/navigation-access"
import { loadPersonalPlanInvite } from "@/lib/personal-plan/plan-invite"
import { AppRouteProviders } from "@/providers/route-providers"
import { PRIVATE_PAGE_METADATA } from "@/lib/seo/site-identity"

export const metadata = PRIVATE_PAGE_METADATA

export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const [navigation, showPlanInvite] = await Promise.all([
    loadAuthenticatedAppNavigationAccess(),
    loadPersonalPlanInvite(),
  ])
  await schedulePersonalPlanNavSurfaceVisit(navigation, "chat")
  return (
    <AppRouteProviders>
      <AuthenticatedAppShell navigation={navigation}>
        <PlanInviteProvider show={showPlanInvite}>{children}</PlanInviteProvider>
      </AuthenticatedAppShell>
    </AppRouteProviders>
  )
}

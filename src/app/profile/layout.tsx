import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell"
import { ProfileRoutineAccessProvider } from "@/components/profile/profile-routine-access"
import {
  hasRoutineTabAccess,
  loadAuthenticatedAppNavigationAccess,
} from "@/lib/personal-plan/navigation-access"
import { AppRouteProviders } from "@/providers/route-providers"
import { PRIVATE_PAGE_METADATA } from "@/lib/seo/site-identity"

export const metadata = PRIVATE_PAGE_METADATA

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  const navigation = await loadAuthenticatedAppNavigationAccess()
  return (
    <AppRouteProviders>
      <AuthenticatedAppShell navigation={navigation}>
        <ProfileRoutineAccessProvider hasRoutineAccess={hasRoutineTabAccess(navigation)}>
          {children}
        </ProfileRoutineAccessProvider>
      </AuthenticatedAppShell>
    </AppRouteProviders>
  )
}

import type { CSSProperties, ReactNode } from "react"

import { Header } from "@/components/layout/header"
import { PersonalPlanNavigation } from "@/components/layout/personal-plan-navigation"
import type { AuthenticatedAppNavigationAccess } from "@/lib/personal-plan/navigation-access"

type PersonalPlanShellStyle = CSSProperties & {
  "--personal-plan-shell-bottom-padding": string
}

export function AuthenticatedAppShell({
  navigation,
  children,
  legacyHeader,
  personalPlanNavigation,
}: {
  navigation: AuthenticatedAppNavigationAccess
  children: ReactNode
  legacyHeader?: ReactNode
  personalPlanNavigation?: ReactNode
}) {
  const personalPlan = navigation.kind === "personal_plan"
  const style: PersonalPlanShellStyle | undefined = personalPlan
    ? ({
        "--personal-plan-shell-bottom-padding": "calc(4.5rem + env(safe-area-inset-bottom))",
      } as PersonalPlanShellStyle)
    : undefined

  return (
    <div className="min-h-dvh" data-personal-plan-shell={personalPlan || undefined} style={style}>
      {personalPlan
        ? (personalPlanNavigation ?? <PersonalPlanNavigation items={navigation.items} />)
        : (legacyHeader ?? <Header />)}
      {personalPlan ? (
        <div
          data-personal-plan-content="true"
          style={{ paddingBottom: "var(--personal-plan-shell-bottom-padding)" }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

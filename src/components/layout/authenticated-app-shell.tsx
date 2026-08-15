import type { ReactNode } from "react"

import { Header } from "@/components/layout/header"
import { PersonalPlanNavigation } from "@/components/layout/personal-plan-navigation"
import type { AuthenticatedAppNavigationAccess } from "@/lib/personal-plan/navigation-access"

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

  return (
    <div
      className={
        personalPlan
          ? // Die Tab-Bar existiert nur mobil; ab md entfällt auch die Padding-Kompensation.
            "min-h-dvh [--personal-plan-shell-bottom-padding:calc(4.5rem+env(safe-area-inset-bottom))] md:[--personal-plan-shell-bottom-padding:0px]"
          : "min-h-dvh"
      }
      data-personal-plan-shell={personalPlan || undefined}
    >
      {personalPlan
        ? (personalPlanNavigation ?? (
            <PersonalPlanNavigation
              key={navigation.hasPendingRoutineProposal ? "pending" : "clear"}
              items={navigation.items}
              initialHasPendingRoutineProposal={navigation.hasPendingRoutineProposal}
            />
          ))
        : (legacyHeader ?? <Header />)}
      {personalPlan ? (
        <div
          data-personal-plan-content="true"
          className="pb-[var(--personal-plan-shell-bottom-padding)]"
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  )
}

import type { Metadata } from "next"

import { PersonalPlanFieldTestEnded } from "@/components/personal-plan-field-test/personal-plan-field-test-ended"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function PersonalPlanFieldTestEndedPage() {
  return <PersonalPlanFieldTestEnded />
}

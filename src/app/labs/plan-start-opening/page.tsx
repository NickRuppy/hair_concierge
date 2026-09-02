import { notFound } from "next/navigation"

import { PlanStartOpening } from "@/components/personal-plan-start/plan-start-opening"

/**
 * Dev-only harness for the shared /plan-start opening shell (Follow-up A,
 * plans/2026-09-02-follow-up-transitions.md). The real surface needs an
 * authenticated Personal-Plan account, so this is the cheapest honest way to
 * review the one loading layout in a browser.
 */
export default async function PlanStartOpeningLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  return <PlanStartOpening />
}

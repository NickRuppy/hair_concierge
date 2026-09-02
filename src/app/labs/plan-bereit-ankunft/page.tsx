import { notFound } from "next/navigation"

import { PlanBereitOpeningReplay } from "./replay-harness"

/**
 * Dev-only harness for the post-payment arrival screen. The real surface needs
 * the full lead/consent/purchase chain (docs/local-qa-access.md §3), so this is
 * the cheapest honest way to review its layout, copy, and the two-state opening
 * choreography (loading → morph → ready) in a browser.
 */
export default async function PlanBereitAnkunftLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  return <PlanBereitOpeningReplay />
}

import { redirect } from "next/navigation"

import { loadScanRouteAccess } from "@/lib/auth/authenticated-app-route-access"
import type { EntitlementTier } from "@/lib/entitlements"
import { loadAuthenticatedAppNavigationAccess } from "@/lib/personal-plan/navigation-access"

import { ScanPageClient } from "./scan-page-client"

export default async function ScanPage() {
  const access = await loadScanRouteAccess()
  if (access.kind === "redirect") redirect(access.href)

  // Fix round 1 (T9 review, F1): the free tier's Merken bookmark must lock from the very
  // first paint, before any verdict has proven the tier from a response shape.
  // `loadAuthenticatedAppNavigationAccess` is `cache()`-wrapped and `/scan/layout.tsx`
  // already calls it for this same request, so this costs no extra read. `"legacy"` (no
  // Personal Plan nav at all, or the loader's own catch-all failure path) always means
  // "premium" here — the loader never promotes a user to the free-tier nav without its own
  // signal, so this can never mislock a premium or pre-restructure user.
  const navigation = await loadAuthenticatedAppNavigationAccess()
  const tier: EntitlementTier = navigation.kind === "personal_plan" ? navigation.tier : "premium"

  return <ScanPageClient tier={tier} />
}

import { redirect } from "next/navigation"

import { ScanFlow } from "@/components/scan/scan-flow"
import { loadScanRouteAccess } from "@/lib/auth/authenticated-app-route-access"

export default async function ScanPage() {
  const access = await loadScanRouteAccess()
  if (access.kind === "redirect") redirect(access.href)

  return <ScanFlow />
}

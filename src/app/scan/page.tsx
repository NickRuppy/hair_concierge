import { redirect } from "next/navigation"

import { loadScanRouteAccess } from "@/lib/auth/authenticated-app-route-access"

import { ScanPageClient } from "./scan-page-client"

export default async function ScanPage() {
  const access = await loadScanRouteAccess()
  if (access.kind === "redirect") redirect(access.href)

  return <ScanPageClient />
}

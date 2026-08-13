import { loadTrackerRouteAccess } from "@/lib/auth/authenticated-app-route-access"
import { redirect } from "next/navigation"

export default async function TrackerLayout({ children }: { children: React.ReactNode }) {
  const access = await loadTrackerRouteAccess()
  if (access.kind === "redirect") redirect(access.href)
  return children
}

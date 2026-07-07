import { AppRouteProviders } from "@/providers/route-providers"

export default function RoutineLayout({ children }: { children: React.ReactNode }) {
  return <AppRouteProviders>{children}</AppRouteProviders>
}

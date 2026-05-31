import { AppRouteProviders } from "@/providers/route-providers"

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <AppRouteProviders>{children}</AppRouteProviders>
}

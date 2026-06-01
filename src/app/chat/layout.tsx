import { AppRouteProviders } from "@/providers/route-providers"

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <AppRouteProviders>{children}</AppRouteProviders>
}

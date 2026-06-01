import { PublicFlowProviders } from "@/providers/route-providers"

export const dynamic = "force-dynamic"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <PublicFlowProviders>{children}</PublicFlowProviders>
}

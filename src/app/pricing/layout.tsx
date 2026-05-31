import { PublicFlowProviders } from "@/providers/route-providers"

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <PublicFlowProviders>{children}</PublicFlowProviders>
}

import { PublicFlowProviders } from "@/providers/route-providers"

export default function ResultLayout({ children }: { children: React.ReactNode }) {
  return <PublicFlowProviders>{children}</PublicFlowProviders>
}

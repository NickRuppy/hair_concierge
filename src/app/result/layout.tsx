import { PublicFlowProviders } from "@/providers/tracking-providers"

export default function ResultLayout({ children }: { children: React.ReactNode }) {
  return <PublicFlowProviders>{children}</PublicFlowProviders>
}

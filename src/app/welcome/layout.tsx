import { PublicFlowProviders } from "@/providers/route-providers"

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <PublicFlowProviders>{children}</PublicFlowProviders>
}

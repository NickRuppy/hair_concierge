import { PublicAuthFlowProviders } from "@/providers/route-providers"

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return <PublicAuthFlowProviders>{children}</PublicAuthFlowProviders>
}

import type { Metadata } from "next"

import { WaitlistTrackingProvider } from "@/providers/waitlist-tracking-provider"

export const metadata: Metadata = { robots: { index: false, follow: false } }

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return <WaitlistTrackingProvider>{children}</WaitlistTrackingProvider>
}

import type { ReactNode } from "react"

import { LandingHeader } from "@/components/landing/landing-header"
import { SiteFooter } from "@/components/landing/site-footer"
import { LandingTracking } from "@/providers/route-providers"

export function EditorialShell({ children }: { children: ReactNode }) {
  return (
    <>
      <LandingTracking />
      <LandingHeader />
      <div className="flex min-h-[calc(100vh-64px)] flex-col">
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </div>
    </>
  )
}

import type { ReactNode } from "react"

import { LandingHeader } from "@/components/landing/landing-header"
import { SiteFooter } from "@/components/landing/site-footer"
import { PublicFunnelContextBootstrap } from "@/providers/public-funnel-context-bootstrap"

export function EditorialShell({
  children,
  bootstrapFunnelContext = false,
}: {
  children: ReactNode
  bootstrapFunnelContext?: boolean
}) {
  return (
    <>
      {bootstrapFunnelContext ? <PublicFunnelContextBootstrap /> : null}
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

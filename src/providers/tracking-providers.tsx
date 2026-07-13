"use client"

import type { ReactNode } from "react"
import { AnalyticsRuntimeCoordinator } from "@/providers/analytics-runtime-coordinator"
import { CustomerIoProvider } from "@/providers/customerio-provider"
import { FunnelContextBootstrap } from "@/providers/funnel-context-bootstrap"
import { MetaPixelProvider } from "@/providers/meta-pixel-provider"
import { PostHogClientProvider } from "@/providers/posthog-provider"
import { ToastProvider } from "@/providers/toast-provider"

export function TrackingProviders({
  children,
  landing = false,
}: {
  children?: ReactNode
  landing?: boolean
}) {
  return (
    <MetaPixelProvider>
      <CustomerIoProvider>
        <PostHogClientProvider>
          <AnalyticsRuntimeCoordinator />
          <FunnelContextBootstrap landing={landing} />
          {children}
        </PostHogClientProvider>
      </CustomerIoProvider>
    </MetaPixelProvider>
  )
}
export function LandingTracking() {
  return <TrackingProviders landing />
}

export function PublicFlowProviders({ children }: { children: ReactNode }) {
  return (
    <TrackingProviders>
      <ToastProvider>{children}</ToastProvider>
    </TrackingProviders>
  )
}

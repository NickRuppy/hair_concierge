"use client"

import { LazyFeedbackWidget } from "@/components/feedback/lazy-feedback-widget"
import { AuthProvider } from "@/providers/auth-provider"
import { CustomerIoProvider } from "@/providers/customerio-provider"
import { MetaPixelProvider } from "@/providers/meta-pixel-provider"
import { PostHogClientProvider } from "@/providers/posthog-provider"
import { ToastProvider } from "@/providers/toast-provider"
import { FunnelContextBootstrap } from "@/providers/funnel-context-bootstrap"

export function AppRouteProviders({ children }: { children: React.ReactNode }) {
  return (
    <MetaPixelProvider>
      <AuthProvider>
        <CustomerIoProvider>
          <PostHogClientProvider>
            <FunnelContextBootstrap />
            <ToastProvider>
              {children}
              <LazyFeedbackWidget />
            </ToastProvider>
          </PostHogClientProvider>
        </CustomerIoProvider>
      </AuthProvider>
    </MetaPixelProvider>
  )
}

export function PublicFlowProviders({ children }: { children: React.ReactNode }) {
  return (
    <MetaPixelProvider>
      <CustomerIoProvider>
        <PostHogClientProvider>
          <FunnelContextBootstrap />
          <ToastProvider>{children}</ToastProvider>
        </PostHogClientProvider>
      </CustomerIoProvider>
    </MetaPixelProvider>
  )
}

export function PublicAuthFlowProviders({ children }: { children: React.ReactNode }) {
  return (
    <MetaPixelProvider>
      <AuthProvider>
        <CustomerIoProvider>
          <PostHogClientProvider>
            <FunnelContextBootstrap />
            <ToastProvider>{children}</ToastProvider>
          </PostHogClientProvider>
        </CustomerIoProvider>
      </AuthProvider>
    </MetaPixelProvider>
  )
}

export function LandingTracking() {
  return (
    <MetaPixelProvider>
      <CustomerIoProvider>
        <PostHogClientProvider>
          <FunnelContextBootstrap landing />
        </PostHogClientProvider>
      </CustomerIoProvider>
    </MetaPixelProvider>
  )
}

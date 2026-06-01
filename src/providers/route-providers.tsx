"use client"

import { LazyFeedbackWidget } from "@/components/feedback/lazy-feedback-widget"
import { AuthProvider } from "@/providers/auth-provider"
import { CustomerIoProvider } from "@/providers/customerio-provider"
import { MetaPixelProvider } from "@/providers/meta-pixel-provider"
import { PostHogClientProvider } from "@/providers/posthog-provider"
import { ToastProvider } from "@/providers/toast-provider"

export function AppRouteProviders({ children }: { children: React.ReactNode }) {
  return (
    <MetaPixelProvider>
      <AuthProvider>
        <CustomerIoProvider>
          <PostHogClientProvider>
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
        <PostHogClientProvider>{null}</PostHogClientProvider>
      </CustomerIoProvider>
    </MetaPixelProvider>
  )
}

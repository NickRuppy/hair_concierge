"use client"

import { LazyFeedbackWidget } from "@/components/feedback/lazy-feedback-widget"
import { AuthProvider } from "@/providers/auth-provider"
import { CustomerIoIdentify } from "@/providers/customerio-identify"
import { PostHogIdentify } from "@/providers/posthog-identify"
import { TrackingProviders } from "@/providers/tracking-providers"
import { ToastProvider } from "@/providers/toast-provider"

export function AppRouteProviders({ children }: { children: React.ReactNode }) {
  return (
    <TrackingProviders>
      <AuthProvider>
        <CustomerIoIdentify />
        <PostHogIdentify />
        <ToastProvider>
          {children}
          <LazyFeedbackWidget />
        </ToastProvider>
      </AuthProvider>
    </TrackingProviders>
  )
}

export function PublicAuthFlowProviders({ children }: { children: React.ReactNode }) {
  return (
    <TrackingProviders>
      <AuthProvider>
        <CustomerIoIdentify />
        <PostHogIdentify />
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </TrackingProviders>
  )
}

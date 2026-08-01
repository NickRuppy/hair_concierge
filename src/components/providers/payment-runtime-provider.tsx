"use client"

import { createContext, type ReactNode, useContext } from "react"

import type { PaymentRuntime } from "@/lib/billing/payment-runtime-config"

export type { PaymentRuntime }

const DEFAULT_PAYMENT_RUNTIME: PaymentRuntime = {
  stripeLive: false,
  paypalLive: false,
}

const PaymentRuntimeContext = createContext<PaymentRuntime>(DEFAULT_PAYMENT_RUNTIME)

export function PaymentRuntimeProvider({
  children,
  runtime,
}: {
  children: ReactNode
  runtime: PaymentRuntime
}) {
  return <PaymentRuntimeContext.Provider value={runtime}>{children}</PaymentRuntimeContext.Provider>
}

export function usePaymentRuntime(): PaymentRuntime {
  return useContext(PaymentRuntimeContext)
}

"use client"

import { CircleAlert, LoaderCircle } from "lucide-react"
import { useEffect, useRef } from "react"
import {
  getCheckoutRecoveryAction,
  getCheckoutRecoveryContent,
  type CheckoutRecoveryCode,
} from "@/lib/auth/checkout-activation-outcome"

export function CheckoutRecoveryPanel({ code }: { code: CheckoutRecoveryCode }) {
  const section = useRef<HTMLElement>(null)
  const content = getCheckoutRecoveryContent(code)
  const pending = code === "activation_pending"
  useEffect(() => {
    section.current?.focus()
  }, [code])

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section
        ref={section}
        tabIndex={-1}
        role={pending ? "status" : "alert"}
        aria-live={pending ? "polite" : "assertive"}
        aria-labelledby="checkout-recovery-title"
        className="w-full max-w-md text-center outline-none"
      >
        <div
          className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden="true"
        >
          {pending ? (
            <LoaderCircle className="h-6 w-6 animate-spin motion-reduce:animate-none" />
          ) : (
            <CircleAlert className="h-6 w-6" />
          )}
        </div>
        <h1
          id="checkout-recovery-title"
          className="mb-6 font-header text-3xl text-foreground sm:text-4xl"
        >
          {content.title}
        </h1>
        <div className="rounded-lg border bg-card p-6 text-left shadow-sm">
          <p className="text-sm leading-6 text-muted-foreground">{content.message}</p>
          <div className="mt-6 flex flex-col gap-3">
            {[content.primary, content.secondary].map((action, index) => {
              if (!action) return null
              const { href, label } = getCheckoutRecoveryAction(action)
              const className =
                index === 0
                  ? "inline-flex min-h-11 items-center justify-center rounded-lg border border-primary px-5 py-3 text-center text-sm font-medium text-primary hover:bg-primary/10"
                  : "inline-flex min-h-11 items-center justify-center text-center text-sm text-primary underline underline-offset-4"
              return href ? (
                <a key={action} href={href} className={className}>
                  {label}
                </a>
              ) : (
                <button
                  key={action}
                  type="button"
                  className={className}
                  onClick={() => window.location.reload()}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </section>
    </main>
  )
}

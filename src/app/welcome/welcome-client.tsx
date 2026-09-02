"use client"

import { CheckCircle, LoaderCircle, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { PasswordPolicyChecklist } from "@/components/auth/password-policy-checklist"
import { usePaymentRuntime } from "@/components/providers/payment-runtime-provider"
import { Input } from "@/components/ui/input"
import { validatePasswordDraft } from "@/lib/auth/password-policy"
import type { CheckoutPurchaseAnalytics } from "@/lib/stripe/purchase-analytics"
import { createClient } from "@/lib/supabase/client"
import { markPlanOpeningStart } from "@/app/plan-bereit/opening-beat"
import { PlanBereitArrival } from "@/app/plan-bereit/plan-ready-arrival"
import { CheckoutReturnAnalytics } from "./checkout-return-analytics"
import { addCheckoutBreadcrumb, captureCheckoutException } from "@/lib/observability/checkout"
import { capturePaymentFailure } from "@/lib/observability/payment-client"
import {
  isCheckoutFirstTimeDestination,
  type CheckoutFirstTimeDestination,
} from "@/lib/billing/checkout-success-redirect"

interface WelcomeClientProps {
  analyticsId?: string
  email?: string
  providerSubscriberEmail?: string | null
  purchase: CheckoutPurchaseAnalytics | null
  redirectTo?: string
  sessionId?: string
  activationSource: CheckoutActivationSource
  mode?: "activation" | "pending" | "duplicate"
  oneTimeReturnState?: Exclude<OneTimePendingState, "pending">
  activationRedirectTo?: CheckoutFirstTimeDestination
}

type CheckoutActivationSource =
  | { provider: "stripe"; sessionId: string; purchaseKind?: "one_time" }
  | { provider: "paypal"; token: string; purchaseKind?: "one_time" }

type LoadingState = "password" | "magic_link" | null
type ScreenState = { view: "choice" } | { view: "sent" }
type OneTimePendingState =
  | "pending"
  | "timed_out"
  | "support_needed"
  | "failed_permanent"
  | "revoked"
type OneTimeActivationStatus =
  | "active"
  | "paid_pending"
  | "pending"
  | "revoked"
  | "failed_permanent"
  | "permanent_failure"

const SIGN_IN_AFTER_PASSWORD_ERROR =
  "Passwort wurde erstellt, aber die Anmeldung hat nicht geklappt. Bitte melde dich mit deiner E-Mail und deinem Passwort an."
const NETWORK_ERROR =
  "Verbindung fehlgeschlagen. Bitte prüfe deine Internet-Verbindung und versuche es erneut."
const UNKNOWN_ERROR = "Unbekannter Fehler"
const MAGIC_LINK_BODY =
  "Wir senden dir einen sicheren Login-Link. Du klickst ihn im Postfach an und bist direkt angemeldet."
const ONE_TIME_PENDING_TIMEOUT_TITLE = "Das dauert gerade länger als erwartet"
const ONE_TIME_PENDING_TIMEOUT_BODY =
  "Deine Zahlung ist sicher erfasst – du wirst nicht erneut belastet. Wir senden dir eine E-Mail, sobald dein Zugang bereit ist."
const ONE_TIME_PENDING_SUPPORT_BODY =
  "Deine Zahlung ist sicher erfasst. Bitte kontaktiere uns, damit wir deinen Zugang manuell prüfen können."
const ONE_TIME_RETURN_SUPPORT_BODY =
  "Wir konnten deinen Zugang nicht automatisch prüfen. Unser Support hilft dir weiter. Bitte bewahre deine Bestellbestätigung auf."
const ONE_TIME_RETURN_REVOKED_BODY =
  "Für diese Bestellung kann kein Zugang geöffnet werden. Wenn dir etwas unklar ist, kontaktiere bitte unseren Support."

export function WelcomeClient({
  analyticsId: providedAnalyticsId,
  email,
  providerSubscriberEmail,
  purchase,
  redirectTo,
  sessionId,
  activationSource,
  mode = "activation",
  oneTimeReturnState,
  activationRedirectTo = "/onboarding",
}: WelcomeClientProps) {
  const { paypalLive } = usePaymentRuntime()
  const router = useRouter()
  const supabase = createClient()
  const analyticsId = providedAnalyticsId ?? sessionId ?? activationSourceId(activationSource)
  const requestBody = useMemo(
    () => activationRequestBody(activationSource, activationRedirectTo),
    [activationRedirectTo, activationSource],
  )
  const isOneTimePurchase = activationSource.purchaseKind === "one_time"
  const paypalActivationToken =
    !isOneTimePurchase && activationSource.provider === "paypal" ? activationSource.token : null
  const oneTimeActivationStatusUrl = useMemo(
    () => oneTimeActivationStatusRequestUrl(activationSource),
    [activationSource],
  )
  const oneTimePollingBlockedByReturnState =
    oneTimeReturnState === "revoked" || oneTimeReturnState === "failed_permanent"
  const showProviderSubscriberEmail =
    Boolean(providerSubscriberEmail?.trim()) &&
    providerSubscriberEmail?.trim().toLowerCase() !== email?.trim().toLowerCase()

  const [state, setState] = useState<ScreenState>({ view: "choice" })
  const [loading, setLoading] = useState<LoadingState>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [highlightMagicLink, setHighlightMagicLink] = useState(false)
  const [oneTimePendingState, setOneTimePendingState] = useState<OneTimePendingState>(
    oneTimeReturnState ?? "pending",
  )
  const [oneTimePendingCheck, setOneTimePendingCheck] = useState(0)

  useEffect(() => {
    if (mode !== "pending" || !paypalActivationToken) return
    const token = paypalActivationToken

    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    async function pollActivation() {
      attempts += 1
      try {
        const params = new URLSearchParams({ token })
        const response = await fetch(`/api/paypal/activation-status?${params.toString()}`)
        const body = await response.json().catch(() => ({}))
        if (cancelled) return

        if (response.ok && body.status === "active") {
          addCheckoutBreadcrumb({
            provider: "paypal",
            stage: "paypal_activation_status_poll",
            source: "welcome",
            paypalTokenPresent: true,
            status: "active",
          })
          window.location.reload()
          return
        }
        if (response.ok && body.status === "duplicate") {
          addCheckoutBreadcrumb(
            {
              provider: "paypal",
              stage: "paypal_activation_status_poll",
              source: "welcome",
              paypalTokenPresent: true,
              status: "duplicate",
            },
            "warning",
          )
          window.location.reload()
          return
        }
        if (!response.ok && attempts === 1) {
          captureCheckoutException(new Error("PayPal activation status poll failed"), {
            provider: "paypal",
            stage: "paypal_activation_status_poll",
            source: "welcome",
            paypalTokenPresent: true,
            status: response.status,
          })
        }
      } catch (err) {
        if (cancelled) return
        if (attempts === 1) {
          captureCheckoutException(err, {
            provider: "paypal",
            stage: "paypal_activation_status_poll",
            source: "welcome",
            paypalTokenPresent: true,
            reason: "network_error",
          })
        }
        // Keep the pending screen calm; the next poll or manual refresh can recover.
      }

      if (!cancelled && attempts < 15) {
        timer = setTimeout(pollActivation, 2000)
      } else if (!cancelled) {
        capturePaymentFailure({
          signal: "customer_payment_error_observed",
          provider: "paypal",
          stage: "paypal_activation_status_poll",
          errorFamily: "timeout",
          commerceKind: isOneTimePurchase ? "one_time" : "subscription",
          origin: "browser",
          method: "paypal",
          truth: "unknown",
          live: paypalLive,
          isInternalTest: false,
          retryable: "true",
          source: "welcome",
          providerReferencePresent: true,
        })
        setMessage("Das dauert gerade etwas länger. Bitte aktualisiere die Seite gleich erneut.")
      }
    }

    timer = setTimeout(pollActivation, 1200)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [isOneTimePurchase, mode, paypalActivationToken, paypalLive])

  useEffect(() => {
    if (
      mode !== "pending" ||
      !isOneTimePurchase ||
      !oneTimeActivationStatusUrl ||
      oneTimePollingBlockedByReturnState
    )
      return

    const statusUrl = oneTimeActivationStatusUrl
    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    setMessage(null)
    setOneTimePendingState("pending")

    async function pollActivation() {
      attempts += 1
      try {
        const response = await fetch(statusUrl)
        const body = await response.json().catch(() => ({}))
        if (cancelled) return
        const status = normalizeOneTimeActivationStatus(body.status)

        if (status === "active" && response.ok) {
          addCheckoutBreadcrumb({
            provider: activationSource.provider,
            stage: "checkout_return",
            source: "welcome",
            status: "active",
          })
          window.location.reload()
          return
        }
        if (status === "paid_pending" || status === "pending") {
          scheduleNextOneTimeActivationPoll()
          return
        }
        if (status === "revoked") {
          setOneTimePendingState("revoked")
          return
        }
        if (isPermanentOneTimeActivationStatus(status)) {
          setOneTimePendingState("failed_permanent")
          return
        }
        if (response.ok) {
          setOneTimePendingState("support_needed")
          return
        }

        if (response.status >= 500) {
          scheduleNextOneTimeActivationPoll()
          return
        }

        setOneTimePendingState("support_needed")
        if (attempts === 1) {
          captureCheckoutException(new Error("One-time activation status poll failed"), {
            provider: activationSource.provider,
            stage: "checkout_return",
            source: "welcome",
            status: response.status,
          })
        }
        return
      } catch (err) {
        if (cancelled) return
        if (attempts === 1) {
          captureCheckoutException(err, {
            provider: activationSource.provider,
            stage: "checkout_return",
            source: "welcome",
            reason: "network_error",
          })
        }
        scheduleNextOneTimeActivationPoll()
      }
    }

    function scheduleNextOneTimeActivationPoll() {
      if (cancelled) return
      if (attempts < 15) {
        timer = setTimeout(pollActivation, 2000)
        return
      }
      setOneTimePendingState("timed_out")
      captureCheckoutException(new Error("One-time activation polling timed out"), {
        provider: activationSource.provider,
        stage: "checkout_return",
        source: "welcome",
        reason: "polling_timeout",
      })
    }

    timer = setTimeout(pollActivation, 1200)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [
    activationSource.provider,
    isOneTimePurchase,
    mode,
    oneTimeActivationStatusUrl,
    oneTimePendingCheck,
    oneTimePollingBlockedByReturnState,
  ])

  async function handleCreatePassword(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    setHighlightMagicLink(false)

    const validation = validatePasswordDraft(password, confirmPassword)
    if (!validation.ok) {
      setMessage(validation.message)
      return
    }

    setLoading("password")
    try {
      const res = await fetch("/api/auth/set-checkout-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody, password }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        const errorMessage = typeof body.error === "string" ? body.error : UNKNOWN_ERROR
        if (res.status === 409 || errorMessage.includes("Login-Link")) {
          setHighlightMagicLink(true)
        }
        captureCheckoutException(new Error(errorMessage), {
          ...checkoutActivationSentryDetails(activationSource, "checkout_password_activation"),
          status: res.status,
        })
        throw new Error(errorMessage)
      }

      const signInEmail = typeof body.email === "string" ? body.email : email
      if (!signInEmail) throw new Error(UNKNOWN_ERROR)
      const { error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password,
      })

      if (error) {
        captureCheckoutException(error, {
          ...checkoutActivationSentryDetails(activationSource, "checkout_password_activation"),
          reason: "supabase_password_sign_in_failed",
        })
        setMessage(SIGN_IN_AFTER_PASSWORD_ERROR)
        return
      }

      const resolvedNext = isCheckoutFirstTimeDestination(body.next)
        ? body.next
        : activationRedirectTo
      router.replace(resolvedNext)
    } catch (err) {
      setMessage(normalizeError(err))
    } finally {
      setLoading(null)
    }
  }

  async function handleMagicLink() {
    setMessage(null)
    setHighlightMagicLink(false)
    setLoading("magic_link")

    try {
      const res = await fetch("/api/auth/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const errorMessage = typeof body.error === "string" ? body.error : UNKNOWN_ERROR
        captureCheckoutException(new Error(errorMessage), {
          ...checkoutActivationSentryDetails(activationSource, "checkout_magic_link_activation"),
          status: res.status,
        })
        throw new Error(errorMessage)
      }
      setState({ view: "sent" })
    } catch (err) {
      setMessage(normalizeError(err))
    } finally {
      setLoading(null)
    }
  }

  if (redirectTo) {
    // A buyer bound for /plan-bereit continues into the identical frame — this
    // paint IS the loading state, so the route change stays invisible. Every
    // other target keeps the generic confirmation screen. That deliberately
    // includes the activation-ready cohort redirected straight to /plan-start:
    // bridging that route is Follow-up A of the two-state opening plan
    // (plans/2026-09-02-plan-opening-two-state.md), not this branch.
    const opensPersonalPlan = redirectTo.startsWith("/plan-bereit")
    return (
      <>
        <CheckoutReturnAnalytics
          purchase={purchase}
          purchaseKind={activationSource.purchaseKind}
          redirectTo={redirectTo}
          sessionId={analyticsId}
        />
        {opensPersonalPlan ? (
          <>
            <PlanOpeningStartMarker />
            <PlanBereitArrival
              phase="loading"
              noscriptFallback={
                <noscript>
                  <div className="mt-6 text-center">
                    <a
                      href={redirectTo}
                      className="inline-flex min-h-11 items-center justify-center rounded-full border border-primary bg-transparent px-5 py-2 text-sm font-medium text-primary"
                    >
                      Weiter zu deinem Plan
                    </a>
                  </div>
                </noscript>
              }
            />
          </>
        ) : (
          <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
            <div className="w-full max-w-md space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-medium text-primary">Zahlung erfolgreich</p>
              <h1 className="font-header text-3xl">Weiterleitung...</h1>
            </div>
          </main>
        )}
      </>
    )
  }

  if (mode === "pending") {
    if (isOneTimePurchase) {
      const isBlocked = oneTimePendingState !== "pending"
      const canRetryOneTimeStatus =
        oneTimePendingState !== "revoked" && oneTimePendingState !== "failed_permanent"
      return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
          <section
            aria-live={isBlocked ? "assertive" : "polite"}
            className="w-full max-w-md space-y-6 text-center"
            role={isBlocked ? "alert" : "status"}
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              {isBlocked ? (
                <Mail className="h-6 w-6 text-primary" />
              ) : (
                <LoaderCircle className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none" />
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">
                {oneTimePendingState === "revoked"
                  ? "Bestellung prüfen"
                  : oneTimePendingState === "support_needed" ||
                      oneTimePendingState === "failed_permanent"
                    ? "Zugang prüfen"
                    : "Zahlung bestätigt"}
              </p>
              <h1 className="font-header text-3xl text-foreground">
                {oneTimePendingState === "timed_out"
                  ? ONE_TIME_PENDING_TIMEOUT_TITLE
                  : oneTimePendingState === "support_needed" ||
                      oneTimePendingState === "failed_permanent"
                    ? "Wir prüfen deinen Zugang"
                    : "Wir schließen deinen Zugang ab"}
              </h1>
              <p className="text-base text-muted-foreground">
                {oneTimePendingState === "timed_out"
                  ? ONE_TIME_PENDING_TIMEOUT_BODY
                  : oneTimePendingState === "support_needed" ||
                      oneTimePendingState === "failed_permanent"
                    ? oneTimeReturnState === "support_needed" ||
                      oneTimeReturnState === "failed_permanent"
                      ? ONE_TIME_RETURN_SUPPORT_BODY
                      : ONE_TIME_PENDING_SUPPORT_BODY
                    : oneTimePendingState === "revoked"
                      ? ONE_TIME_RETURN_REVOKED_BODY
                      : "Deine Zahlung ist sicher erfasst. Wir senden dir gleich die Bestätigung und öffnen anschließend deinen persönlichen Haarplan."}
              </p>
            </div>

            {!isBlocked ? (
              <ol className="mx-auto w-full max-w-xs space-y-3 text-left text-sm text-muted-foreground">
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 shrink-0 text-primary" />
                  Zahlung bestätigt
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-primary text-xs text-primary">
                    2
                  </span>
                  Bestätigung wird gesendet
                </li>
                <li className="flex items-center gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-muted-foreground/40 text-xs">
                    3
                  </span>
                  Zugang wird geöffnet
                </li>
              </ol>
            ) : null}

            {isBlocked ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                {canRetryOneTimeStatus ? (
                  <button
                    type="button"
                    onClick={() => setOneTimePendingCheck((current) => current + 1)}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-primary bg-transparent px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    Status erneut prüfen
                  </button>
                ) : null}
                <a
                  href="/kontakt"
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-card px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Support kontaktieren
                </a>
              </div>
            ) : null}
          </section>
        </main>
      )
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
        <div aria-live="polite" className="w-full max-w-md space-y-5 text-center" role="status">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LoaderCircle className="h-6 w-6 animate-spin text-primary motion-reduce:animate-none" />
          </div>
          <div className="space-y-2">
            <h1 className="font-header text-3xl text-foreground">Wir aktivieren dein Abo...</h1>
            <p className="text-base text-muted-foreground">
              Das dauert normalerweise nur ein paar Sekunden.
            </p>
          </div>
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>
      </main>
    )
  }

  if (mode === "duplicate") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md space-y-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="font-header text-3xl text-foreground">
              {isOneTimePurchase ? "Zugang bereits vorhanden" : "Abo bereits aktiv"}
            </h1>
            <p className="text-base text-muted-foreground">
              {isOneTimePurchase
                ? "Für diese E-Mail ist bereits ein Zugang vorhanden. Bitte melde dich mit deinem bestehenden Konto an."
                : "Für diese E-Mail gibt es bereits ein aktives Abo. Wir haben die neue PayPal-Zahlung gestoppt. Bitte melde dich mit deinem bestehenden Konto an."}
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (state.view === "sent") {
    return (
      <>
        <CheckoutReturnAnalytics
          purchase={purchase}
          purchaseKind={activationSource.purchaseKind}
          sessionId={analyticsId}
        />
        <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
          <div className="w-full max-w-md space-y-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <h1 className="font-header text-3xl">Check deine E-Mails</h1>
            <p className="text-base text-muted-foreground">
              Wir haben dir einen Login-Link geschickt.
            </p>
            <p className="text-xs text-muted-foreground">
              Keine E-Mail erhalten? Prüfe deinen Spam-Ordner oder warte 1-2 Minuten.
            </p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <CheckoutReturnAnalytics
        purchase={purchase}
        purchaseKind={activationSource.purchaseKind}
        sessionId={analyticsId}
      />
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-4xl space-y-6">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">Zahlung erfolgreich</p>
              <h1 className="font-header text-3xl text-foreground sm:text-4xl">
                {isOneTimePurchase ? "Zugang einrichten" : "Konto aktivieren"}
              </h1>
              <p className="text-base text-muted-foreground">
                Wähle, wie du dich bei Chaarlie anmelden möchtest.
              </p>
            </div>
          </div>

          <div className="mx-auto w-full max-w-md space-y-3">
            <div className="space-y-2">
              <label htmlFor="checkout-email" className="text-sm font-medium text-foreground">
                Chaarlie-E-Mail
              </label>
              <Input
                id="checkout-email"
                value={email ?? ""}
                readOnly
                aria-readonly="true"
                className="h-11 bg-muted/60 text-center"
              />
            </div>
            {showProviderSubscriberEmail ? (
              <div className="space-y-2">
                <label
                  htmlFor="provider-subscriber-email"
                  className="text-sm font-medium text-foreground"
                >
                  PayPal-E-Mail
                </label>
                <Input
                  id="provider-subscriber-email"
                  value={providerSubscriberEmail?.trim() ?? ""}
                  readOnly
                  aria-readonly="true"
                  className="h-11 bg-muted/60 text-center"
                />
              </div>
            ) : null}
          </div>

          {message && (
            <div className="mx-auto w-full max-w-2xl rounded-lg bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
              {message}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
            <section className="flex min-h-[360px] flex-col rounded-lg border bg-card p-5 shadow-sm">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Mit Passwort fortfahren</h2>
                <p className="min-h-[72px] text-sm leading-6 text-muted-foreground">
                  Erstelle ein Passwort und melde dich künftig direkt mit deiner E-Mail an.
                </p>
              </div>

              <form onSubmit={handleCreatePassword} className="mt-5 flex flex-1 flex-col">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="password" className="text-sm font-medium text-foreground">
                      Passwort
                    </label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={loading !== null}
                      minLength={8}
                      required
                      autoComplete="new-password"
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="confirm-password"
                      className="text-sm font-medium text-foreground"
                    >
                      Passwort wiederholen
                    </label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      disabled={loading !== null}
                      minLength={8}
                      required
                      autoComplete="new-password"
                      className="h-11"
                    />
                  </div>
                  <PasswordPolicyChecklist
                    password={password}
                    confirmPassword={confirmPassword}
                    context="create"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading !== null || !password || !confirmPassword}
                  className="mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-primary bg-transparent px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  {loading === "password" ? "Wird erstellt..." : "Passwort erstellen"}
                </button>
              </form>
            </section>

            <section
              className={[
                "flex min-h-[360px] flex-col rounded-lg border bg-card p-5 shadow-sm transition-colors",
                highlightMagicLink ? "border-primary bg-primary/5" : "",
              ].join(" ")}
            >
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Ohne Passwort fortfahren</h2>
                <p className="min-h-[72px] text-sm leading-6 text-muted-foreground">
                  {MAGIC_LINK_BODY}
                </p>
              </div>

              <div className="mt-5 flex flex-1 flex-col justify-end">
                <button
                  type="button"
                  onClick={handleMagicLink}
                  disabled={loading !== null}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-primary bg-transparent px-6 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  {loading === "magic_link" ? "Wird gesendet..." : "Login-Link senden"}
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  )
}

/**
 * Stamps the opening frame's first paint so /plan-bereit can subtract the
 * redirect time from its minimum beat instead of stacking a second wait.
 */
function PlanOpeningStartMarker() {
  useEffect(() => {
    markPlanOpeningStart()
  }, [])
  return null
}

function activationRequestBody(
  source: CheckoutActivationSource,
  next: CheckoutFirstTimeDestination,
): Record<string, string> {
  if (source.provider === "paypal") {
    return {
      provider: "paypal",
      token: source.token,
      ...(source.purchaseKind === "one_time" ? { purchase: "one_time" } : {}),
      next,
    }
  }
  return { session_id: source.sessionId, next }
}

function oneTimeActivationStatusRequestUrl(source: CheckoutActivationSource): string | null {
  if (source.purchaseKind !== "one_time") return null
  const params = new URLSearchParams({ provider: source.provider })
  if (source.provider === "paypal") {
    params.set("token", source.token)
  } else {
    params.set("session_id", source.sessionId)
  }
  return `/api/billing/one-time-activation-status?${params.toString()}`
}

function activationSourceId(source: CheckoutActivationSource): string {
  if (source.provider === "paypal") return "paypal:checkout"
  return source.sessionId
}

function checkoutActivationSentryDetails(
  source: CheckoutActivationSource,
  stage: "checkout_password_activation" | "checkout_magic_link_activation",
) {
  if (source.provider === "paypal") {
    return {
      provider: "paypal" as const,
      stage,
      source: "welcome" as const,
      paypalTokenPresent: true,
    }
  }
  return {
    provider: "stripe" as const,
    stage,
    source: "welcome" as const,
    stripeSessionId: source.sessionId,
  }
}

function normalizeError(err: unknown): string {
  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) return NETWORK_ERROR
  if (err instanceof Error) return err.message
  return UNKNOWN_ERROR
}

function normalizeOneTimeActivationStatus(value: unknown): OneTimeActivationStatus | null {
  if (
    value === "active" ||
    value === "paid_pending" ||
    value === "pending" ||
    value === "revoked" ||
    value === "failed_permanent" ||
    value === "permanent_failure"
  ) {
    return value
  }
  return null
}

function isPermanentOneTimeActivationStatus(status: OneTimeActivationStatus | null): boolean {
  return status === "failed_permanent" || status === "permanent_failure"
}

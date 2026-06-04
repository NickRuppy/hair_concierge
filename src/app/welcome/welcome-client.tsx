"use client"

import { CheckCircle, LoaderCircle, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { PasswordPolicyChecklist } from "@/components/auth/password-policy-checklist"
import { Input } from "@/components/ui/input"
import { validatePasswordDraft } from "@/lib/auth/password-policy"
import type { CheckoutPurchaseAnalytics } from "@/lib/stripe/purchase-analytics"
import { createClient } from "@/lib/supabase/client"
import { CheckoutReturnAnalytics } from "./checkout-return-analytics"
import { addCheckoutBreadcrumb, captureCheckoutException } from "@/lib/observability/checkout"

interface WelcomeClientProps {
  analyticsId?: string
  email?: string
  providerSubscriberEmail?: string | null
  purchase: CheckoutPurchaseAnalytics | null
  redirectTo?: string
  sessionId?: string
  activationSource: CheckoutActivationSource
  mode?: "activation" | "pending" | "duplicate"
}

type CheckoutActivationSource =
  | { provider: "stripe"; sessionId: string }
  | { provider: "paypal"; token: string }

type LoadingState = "password" | "magic_link" | null
type ScreenState = { view: "choice" } | { view: "sent" }

const SIGN_IN_AFTER_PASSWORD_ERROR =
  "Passwort wurde erstellt, aber die Anmeldung hat nicht geklappt. Bitte melde dich mit deiner E-Mail und deinem Passwort an."
const NETWORK_ERROR =
  "Verbindung fehlgeschlagen. Bitte prüfe deine Internet-Verbindung und versuche es erneut."
const UNKNOWN_ERROR = "Unbekannter Fehler"
const MAGIC_LINK_BODY =
  "Wir senden dir einen sicheren Login-Link. Du klickst ihn im Postfach an und bist direkt angemeldet."

export function WelcomeClient({
  analyticsId: providedAnalyticsId,
  email,
  providerSubscriberEmail,
  purchase,
  redirectTo,
  sessionId,
  activationSource,
  mode = "activation",
}: WelcomeClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const analyticsId = providedAnalyticsId ?? sessionId ?? activationSourceId(activationSource)
  const requestBody = useMemo(() => activationRequestBody(activationSource), [activationSource])
  const paypalActivationToken =
    activationSource.provider === "paypal" ? activationSource.token : null
  const showProviderSubscriberEmail =
    Boolean(providerSubscriberEmail?.trim()) &&
    providerSubscriberEmail?.trim().toLowerCase() !== email?.trim().toLowerCase()

  const [state, setState] = useState<ScreenState>({ view: "choice" })
  const [loading, setLoading] = useState<LoadingState>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [highlightMagicLink, setHighlightMagicLink] = useState(false)

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
        captureCheckoutException(new Error("PayPal activation polling timed out"), {
          provider: "paypal",
          stage: "paypal_activation_status_poll",
          source: "welcome",
          paypalTokenPresent: true,
          reason: "polling_timeout",
        })
        setMessage("Das dauert gerade etwas länger. Bitte aktualisiere die Seite gleich erneut.")
      }
    }

    timer = setTimeout(pollActivation, 1200)
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [mode, paypalActivationToken])

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

      router.replace("/onboarding")
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
    return (
      <>
        <CheckoutReturnAnalytics
          purchase={purchase}
          redirectTo={redirectTo}
          sessionId={analyticsId}
        />
        <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
          <div className="w-full max-w-md space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-sm font-medium text-primary">Zahlung erfolgreich</p>
            <h1 className="font-header text-3xl">Weiterleitung...</h1>
          </div>
        </main>
      </>
    )
  }

  if (mode === "pending") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-md space-y-5 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
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
            <h1 className="font-header text-3xl text-foreground">Abo bereits aktiv</h1>
            <p className="text-base text-muted-foreground">
              Für diese E-Mail gibt es bereits ein aktives Abo. Wir haben die neue PayPal-Zahlung
              gestoppt. Bitte melde dich mit deinem bestehenden Konto an.
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (state.view === "sent") {
    return (
      <>
        <CheckoutReturnAnalytics purchase={purchase} sessionId={analyticsId} />
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
      <CheckoutReturnAnalytics purchase={purchase} sessionId={analyticsId} />
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-4xl space-y-6">
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary">Zahlung erfolgreich</p>
              <h1 className="font-header text-3xl text-foreground sm:text-4xl">Konto aktivieren</h1>
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

function activationRequestBody(source: CheckoutActivationSource): Record<string, string> {
  if (source.provider === "paypal") {
    return { provider: "paypal", token: source.token }
  }
  return { session_id: source.sessionId }
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

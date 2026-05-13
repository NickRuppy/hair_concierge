"use client"

import { CheckCircle, Mail } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { PasswordPolicyChecklist } from "@/components/auth/password-policy-checklist"
import { Input } from "@/components/ui/input"
import { validatePasswordDraft } from "@/lib/auth/password-policy"
import { createClient } from "@/lib/supabase/client"

interface WelcomeClientProps {
  email: string
  sessionId: string
}

type LoadingState = "password" | "magic_link" | null
type ScreenState = { view: "choice" } | { view: "sent" }

const SIGN_IN_AFTER_PASSWORD_ERROR =
  "Passwort wurde erstellt, aber die Anmeldung hat nicht geklappt. Bitte melde dich mit deiner E-Mail und deinem Passwort an."
const NETWORK_ERROR =
  "Verbindung fehlgeschlagen. Bitte prüfe deine Internet-Verbindung und versuche es erneut."
const UNKNOWN_ERROR = "Unbekannter Fehler"
const MAGIC_LINK_BODY =
  "Wir senden dir einen sicheren Login-Link. Du klickst ihn im Postfach an und bist direkt angemeldet."

export function WelcomeClient({ email, sessionId }: WelcomeClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [state, setState] = useState<ScreenState>({ view: "choice" })
  const [loading, setLoading] = useState<LoadingState>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState<string | null>(null)
  const [highlightMagicLink, setHighlightMagicLink] = useState(false)

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
        body: JSON.stringify({ session_id: sessionId, password }),
      })
      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        const errorMessage = typeof body.error === "string" ? body.error : UNKNOWN_ERROR
        if (res.status === 409 || errorMessage.includes("Login-Link")) {
          setHighlightMagicLink(true)
        }
        throw new Error(errorMessage)
      }

      const signInEmail = typeof body.email === "string" ? body.email : email
      const { error } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password,
      })

      if (error) {
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
        body: JSON.stringify({ session_id: sessionId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(typeof body.error === "string" ? body.error : UNKNOWN_ERROR)
      }
      setState({ view: "sent" })
    } catch (err) {
      setMessage(normalizeError(err))
    } finally {
      setLoading(null)
    }
  }

  if (state.view === "sent") {
    return (
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
    )
  }

  return (
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
              Wähle, wie du dich bei Hair Concierge anmelden möchtest.
            </p>
          </div>
        </div>

        <div className="mx-auto w-full max-w-md space-y-2">
          <label htmlFor="checkout-email" className="text-sm font-medium text-foreground">
            E-Mail aus deinem Checkout
          </label>
          <Input
            id="checkout-email"
            value={email}
            readOnly
            aria-readonly="true"
            className="h-11 bg-muted/60 text-center"
          />
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
                  <label htmlFor="confirm-password" className="text-sm font-medium text-foreground">
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
  )
}

function normalizeError(err: unknown): string {
  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) return NETWORK_ERROR
  if (err instanceof Error) return err.message
  return UNKNOWN_ERROR
}

"use client"

import { CheckCircle, Mail } from "lucide-react"
import { useState } from "react"

interface WelcomeClientProps {
  email: string
  sessionId: string
}

type ScreenState =
  | { view: "choice" }
  | { view: "sent"; mode: "password" | "magic_link" }
  | { view: "error"; message: string }

export function WelcomeClient({ email, sessionId }: WelcomeClientProps) {
  const [state, setState] = useState<ScreenState>({ view: "choice" })
  const [loading, setLoading] = useState<"password" | "magic_link" | null>(null)

  async function handleSetupPassword() {
    setLoading("password")
    try {
      const res = await fetch("/api/auth/send-setup-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, session_id: sessionId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Unbekannter Fehler")
      }
      setState({ view: "sent", mode: "password" })
    } catch (err) {
      setState({
        view: "error",
        message: err instanceof Error ? err.message : "Unbekannter Fehler",
      })
    } finally {
      setLoading(null)
    }
  }

  async function handleMagicLink() {
    setLoading("magic_link")
    try {
      const res = await fetch("/api/auth/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, session_id: sessionId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Unbekannter Fehler")
      }
      setState({ view: "sent", mode: "magic_link" })
    } catch (err) {
      setState({
        view: "error",
        message: err instanceof Error ? err.message : "Unbekannter Fehler",
      })
    } finally {
      setLoading(null)
    }
  }

  if (state.view === "sent") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-header text-3xl">Check deine E-Mails</h1>
          <p className="text-base text-muted-foreground">
            {state.mode === "password"
              ? "Wir haben dir einen Link geschickt, um dein Passwort einzurichten."
              : "Wir haben dir einen Login-Link geschickt."}
          </p>
          <p className="text-xs text-muted-foreground">
            Keine E-Mail erhalten? Pruefe deinen Spam-Ordner oder warte 1–2 Minuten.
          </p>
        </div>
      </main>
    )
  }

  if (state.view === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="font-header text-3xl">Zahlung erfolgreich</h1>
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {state.message}
          </div>
          <button
            onClick={() => setState({ view: "choice" })}
            className="text-sm text-primary hover:underline"
          >
            Zurueck
          </button>
        </div>
      </main>
    )
  }

  // Choice screen
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="font-header text-3xl">Zahlung erfolgreich</h1>
          <p className="text-base text-muted-foreground">
            Wie moechtest du dich in Zukunft anmelden?
          </p>
        </div>

        <div className="space-y-3">
          {/* Primary: set up password */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
            <button
              onClick={handleSetupPassword}
              disabled={loading !== null}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {loading === "password" ? "Wird gesendet..." : "Passwort festlegen"}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Du erhaeltst eine E-Mail, um dein Passwort einzurichten.
            </p>
          </div>

          {/* Secondary: magic link */}
          <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
            <button
              onClick={handleMagicLink}
              disabled={loading !== null}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              {loading === "magic_link" ? "Wird gesendet..." : "Login-Link zuschicken"}
            </button>
            <p className="text-xs text-muted-foreground text-center">
              Einmaliger Link zum Anmelden ohne Passwort.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}

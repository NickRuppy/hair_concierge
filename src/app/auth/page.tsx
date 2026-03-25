"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Mail } from "lucide-react"
import { AuthForm } from "@/components/auth/auth-form"

const ERROR_MESSAGES: Record<string, string> = {
  link_expired: "Der Link ist abgelaufen oder ungueltig. Bitte fordere einen neuen an.",
  auth_failed: "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
}

const REASON_COPY: Record<string, { heading: string; subtext: string }> = {
  session_expired: {
    heading: "Willkommen zurueck!",
    subtext: "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
  },
  signed_out: {
    heading: "Bis bald!",
    subtext: "Du wurdest erfolgreich abgemeldet.",
  },
}

export default function AuthPage() {
  const searchParams = useSearchParams()

  const leadId = searchParams.get("lead")
  const from = searchParams.get("from")
  const urlError = searchParams.get("error")
  const reason = searchParams.get("reason")
  const rawNext = searchParams.get("next")
  const defaultNext = from === "quiz" || leadId ? "/onboarding/goals" : "/chat"
  const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\")
    ? rawNext
    : defaultNext
  const copy = reason && reason in REASON_COPY ? REASON_COPY[reason] : null

  // Default tab: signup if coming from quiz/lead capture, login otherwise
  const defaultTab = (from === "quiz" || leadId) && !reason ? "signup" : "login"

  const [view, setView] = useState<"form" | "email-sent" | "signup-confirm">("form")
  const [emailSentTo, setEmailSentTo] = useState("")

  // Password reset email sent
  if (view === "email-sent") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="font-header text-4xl tracking-tight text-foreground">TomBot</h1>
            <p className="text-lg text-muted-foreground">Dein persoenlicher Haar-Experte — powered by AI</p>
          </div>
          <div className="rounded-xl border bg-card p-8 shadow-sm">
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Pruefe dein Postfach</h2>
              <p className="text-sm text-muted-foreground">
                Wir haben eine E-Mail an{" "}
                <span className="font-medium text-foreground">{emailSentTo}</span>{" "}
                gesendet. Klicke auf den Link, um dein Passwort zurueckzusetzen.
              </p>
              <button
                onClick={() => setView("form")}
                className="text-sm text-primary hover:underline"
              >
                Zurueck zur Anmeldung
              </button>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    )
  }

  // Signup confirmation (check email)
  if (view === "signup-confirm") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="font-header text-4xl tracking-tight text-foreground">TomBot</h1>
            <p className="text-lg text-muted-foreground">Dein persoenlicher Haar-Experte — powered by AI</p>
          </div>
          <div className="rounded-xl border bg-card p-8 shadow-sm">
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">Pruefe dein Postfach</h2>
              <p className="text-sm text-muted-foreground">
                Wir haben eine Bestaetigungs-E-Mail an{" "}
                <span className="font-medium text-foreground">{emailSentTo}</span>{" "}
                gesendet. Klicke auf den Link, um dein Konto zu aktivieren.
              </p>
              <button
                onClick={() => setView("form")}
                className="text-sm text-primary hover:underline"
              >
                Andere E-Mail verwenden
              </button>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    )
  }

  // Main form view
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="font-header text-4xl tracking-tight text-foreground">
            {copy?.heading ?? "TomBot"}
          </h1>
          <p className="text-lg text-muted-foreground">
            {copy?.subtext ?? "Dein persoenlicher Haar-Experte — powered by AI"}
          </p>
        </div>

        {urlError && ERROR_MESSAGES[urlError] && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {ERROR_MESSAGES[urlError]}
          </div>
        )}

        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <AuthForm
            theme="light"
            defaultTab={defaultTab}
            defaultEmail={searchParams.get("email") ?? undefined}
            leadId={leadId}
            next={next}
            showForgotPassword={true}
            onEmailSent={(email, type) => {
              setEmailSentTo(email)
              setView(type === "reset" ? "email-sent" : "signup-confirm")
            }}
          />
        </div>

        <Footer />
      </div>
    </div>
  )
}

function Footer() {
  return (
    <footer className="flex justify-center gap-4 text-xs text-muted-foreground">
      <a href="/impressum" className="px-2 py-2 hover:underline">
        Impressum
      </a>
      <a href="/datenschutz" className="px-2 py-2 hover:underline">
        Datenschutz
      </a>
    </footer>
  )
}

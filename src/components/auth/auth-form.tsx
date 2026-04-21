"use client"

import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { linkLeadAction } from "@/app/auth/actions"

interface AuthFormProps {
  defaultEmail?: string
  leadId?: string | null
  next: string
  showForgotPassword?: boolean
  onEmailSent?: (email: string, type: "reset" | "magic_link") => void
}

type MagicLinkErrorNode = { type: "not_found" } | { type: "text"; message: string } | null

/** True when the error message indicates bad credentials (no password set, wrong password, etc.) */
function isInvalidCredentials(message: string): boolean {
  return message.includes("Invalid login credentials")
}

function mapSupabaseError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "E-Mail oder Passwort ist falsch."
  }
  if (message.includes("Email not confirmed")) {
    return "Bitte bestaetige zuerst deine E-Mail-Adresse."
  }
  return message
}

function mapMagicLinkError(message: string): MagicLinkErrorNode {
  if (
    message.includes("Signups not allowed for otp") ||
    message.includes("User not found") ||
    message.includes("user not found")
  ) {
    return { type: "not_found" }
  }
  if (message.includes("Email link is invalid or has expired")) {
    return {
      type: "text",
      message: "Der Link ist abgelaufen. Bitte fordere einen neuen an.",
    }
  }
  return { type: "text", message }
}

function buildNextDestination(next: string, leadId: string | null): string {
  if (!leadId) return next

  const nextUrl = new URL(next, "http://localhost")
  if (!nextUrl.pathname.startsWith("/onboarding")) {
    return `${nextUrl.pathname}${nextUrl.search}`
  }

  nextUrl.searchParams.set("lead", leadId)
  return `${nextUrl.pathname}${nextUrl.search}`
}

export function AuthForm({
  defaultEmail,
  leadId,
  next,
  showForgotPassword = true,
  onEmailSent,
}: AuthFormProps) {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState<"email" | "magic_link" | null>(null)
  const [email, setEmail] = useState(defaultEmail ?? "")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loginErrorIsCredentials, setLoginErrorIsCredentials] = useState(false)
  const [magicLinkError, setMagicLinkError] = useState<MagicLinkErrorNode>(null)
  const [view, setView] = useState<"login" | "forgot">("login")

  const submitBtnClass =
    "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"

  const errorBanner = error ? (
    <div className="space-y-2">
      <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      {loginErrorIsCredentials && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleMagicLink}
            disabled={loading !== null || !email.trim()}
            className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {loading === "magic_link" ? "Wird gesendet..." : "Login-Link senden"}
          </button>
          <button
            type="button"
            onClick={() => {
              setView("forgot")
              setError(null)
              setLoginErrorIsCredentials(false)
              setMagicLinkError(null)
              setPassword("")
            }}
            className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            Passwort zuruecksetzen
          </button>
        </div>
      )}
    </div>
  ) : null

  const magicLinkErrorBanner = magicLinkError ? (
    <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {magicLinkError.type === "not_found" ? (
        <>
          Kein Konto mit dieser E-Mail. Schließe zuerst dein Abo ab.{" "}
          <Link href="/pricing" className="font-medium underline hover:no-underline">
            Zum Abo
          </Link>
        </>
      ) : (
        magicLinkError.message
      )}
    </div>
  ) : null

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) return

    setLoading("email")
    setError(null)
    setLoginErrorIsCredentials(false)
    setMagicLinkError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (error) {
      console.error("Login error:", error)
      const credentialsError = isInvalidCredentials(error.message)
      setError(
        credentialsError
          ? "Login nicht moeglich. Falls du noch kein Passwort festgelegt hast, kannst du auch einen Login-Link anfordern oder dein Passwort zuruecksetzen."
          : mapSupabaseError(error.message),
      )
      setLoginErrorIsCredentials(credentialsError)
      setLoading(null)
    } else {
      const destination = buildNextDestination(next, leadId ?? null)

      // Link quiz lead data if user logged in with a lead from the quiz
      if (leadId) {
        try {
          await linkLeadAction(leadId)
        } catch (e) {
          console.error("linkLeadAction failed:", e)
        }
      }
      router.push(destination)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return

    setLoading("email")
    setError(null)
    setLoginErrorIsCredentials(false)

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })

    if (error) {
      console.error("Reset error:", error)
      setError("E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.")
      setLoading(null)
    } else {
      onEmailSent?.(trimmedEmail, "reset")
      setLoading(null)
    }
  }

  async function handleMagicLink(e?: React.SyntheticEvent) {
    e?.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setMagicLinkError({ type: "text", message: "Bitte gib deine E-Mail-Adresse ein." })
      return
    }

    setLoading("magic_link")
    setError(null)
    setLoginErrorIsCredentials(false)
    setMagicLinkError(null)

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
          shouldCreateUser: false,
        },
      })

      if (error) {
        console.error("Magic link error:", error)
        setMagicLinkError(mapMagicLinkError(error.message))
      } else {
        onEmailSent?.(trimmedEmail, "magic_link")
      }
    } finally {
      setLoading(null)
    }
  }

  // Forgot password sub-view
  if (view === "forgot" && showForgotPassword) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Passwort vergessen?</h2>
        <p className="text-sm text-muted-foreground">
          Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zuruecksetzen.
        </p>

        {errorBanner}

        <form onSubmit={handleForgotPassword} className="space-y-3">
          <Input
            type="email"
            placeholder="E-Mail-Adresse"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading !== null}
            required
            className="h-11"
          />
          <button
            type="submit"
            disabled={loading !== null || !email.trim()}
            className={submitBtnClass}
          >
            {loading === "email" ? "Wird gesendet..." : "Link senden"}
          </button>
        </form>
        <button
          onClick={() => {
            setView("login")
            setError(null)
            setLoginErrorIsCredentials(false)
          }}
          className="text-sm text-primary hover:underline"
        >
          Zurueck zur Anmeldung
        </button>
      </div>
    )
  }

  // Main login view
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Anmelden</h2>

      {errorBanner}

      <form onSubmit={handleLogin} className="space-y-3">
        <Input
          type="email"
          placeholder="E-Mail-Adresse"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading !== null}
          required
          className="h-11"
        />
        <Input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading !== null}
          required
          className="h-11"
        />
        <button
          type="submit"
          disabled={loading !== null || !email.trim() || !password}
          className={submitBtnClass}
        >
          {loading === "email" ? "Wird geladen..." : "Anmelden"}
        </button>
      </form>

      <div className="relative flex items-center">
        <div className="flex-grow border-t border-border" />
        <span className="mx-3 flex-shrink text-xs text-muted-foreground">oder</span>
        <div className="flex-grow border-t border-border" />
      </div>

      {magicLinkErrorBanner}

      <button
        onClick={handleMagicLink}
        disabled={loading !== null || !email.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
      >
        {loading === "magic_link" ? "Wird gesendet..." : "Login-Link per E-Mail senden"}
      </button>

      {showForgotPassword && (
        <button
          onClick={() => {
            setView("forgot")
            setError(null)
            setLoginErrorIsCredentials(false)
            setMagicLinkError(null)
            setPassword("")
          }}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          Passwort vergessen?
        </button>
      )}
    </div>
  )
}

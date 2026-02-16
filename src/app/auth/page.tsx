"use client"

import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Mail } from "lucide-react"
import { linkLeadAction } from "./actions"

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

function mapSupabaseError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "E-Mail oder Passwort ist falsch."
  }
  if (message.includes("Email not confirmed")) {
    return "Bitte bestaetige zuerst deine E-Mail-Adresse."
  }
  if (message.includes("User already registered")) {
    return "Diese E-Mail ist bereits registriert. Bitte melde dich an."
  }
  return message
}

export default function AuthPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()

  const leadId = searchParams.get("lead")
  const from = searchParams.get("from")
  const urlError = searchParams.get("error")
  const reason = searchParams.get("reason")
  const rawNext = searchParams.get("next")
  const next = rawNext?.startsWith("/") && !rawNext.startsWith("//") && !rawNext.includes("\\") ? rawNext : null
  const copy = reason && reason in REASON_COPY ? REASON_COPY[reason] : null

  // Default tab: signup if coming from quiz/lead capture, login otherwise
  const defaultTab = (from === "quiz" || leadId) && !reason ? "signup" : "login"

  const [loading, setLoading] = useState<"google" | "email" | null>(null)
  const [email, setEmail] = useState(searchParams.get("email") ?? "")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<"tabs" | "forgot" | "email-sent" | "signup-confirm">("tabs")
  const [emailSentTo, setEmailSentTo] = useState("")

  async function handleGoogleLogin() {
    setLoading("google")
    setError(null)
    const callbackUrl = new URL("/api/auth/callback", window.location.origin)
    if (leadId) callbackUrl.searchParams.set("lead", leadId)
    if (next) callbackUrl.searchParams.set("next", next)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    })
    if (error) {
      console.error("Auth error:", error)
      setError("Google-Anmeldung fehlgeschlagen. Bitte versuche es erneut.")
      setLoading(null)
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) return

    setLoading("email")
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    })

    if (error) {
      console.error("Login error:", error)
      setError(mapSupabaseError(error.message))
      setLoading(null)
    } else {
      // Link quiz lead data if user logged in with a lead from the quiz
      if (leadId) {
        linkLeadAction(leadId).catch((e) =>
          console.error("linkLeadAction failed:", e)
        )
      }
      router.push(next ?? "/chat")
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !password) return

    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwoerter stimmen nicht ueberein.")
      return
    }

    setLoading("email")
    setError(null)

    const redirectUrl = new URL("/auth/confirm", window.location.origin)
    if (leadId) redirectUrl.searchParams.set("lead", leadId)
    redirectUrl.searchParams.set("next", next ?? "/chat")

    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: redirectUrl.toString(),
      },
    })

    if (error) {
      console.error("Signup error:", error)
      setError(mapSupabaseError(error.message))
      setLoading(null)
    } else if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      setError("Diese E-Mail ist bereits registriert. Bitte melde dich an.")
      setLoading(null)
    } else {
      setEmailSentTo(trimmedEmail)
      setView("signup-confirm")
      setLoading(null)
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return

    setLoading("email")
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/auth/update-password`,
    })

    if (error) {
      console.error("Reset error:", error)
      setError("E-Mail konnte nicht gesendet werden. Bitte versuche es erneut.")
      setLoading(null)
    } else {
      setEmailSentTo(trimmedEmail)
      setView("email-sent")
      setLoading(null)
    }
  }

  const displayError = error || (urlError ? ERROR_MESSAGES[urlError] : null)

  const googleButton = (
    <button
      onClick={handleGoogleLogin}
      disabled={loading !== null}
      className="inline-flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-100 disabled:opacity-50"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      {loading === "google" ? "Wird geladen..." : "Mit Google anmelden"}
    </button>
  )

  const divider = (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">oder</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  )

  // Email-sent confirmation (forgot password)
  if (view === "email-sent") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="font-header text-4xl tracking-tight text-foreground">Hair Concierge</h1>
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
                onClick={() => {
                  setView("tabs")
                  setError(null)
                  setPassword("")
                }}
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
            <h1 className="font-header text-4xl tracking-tight text-foreground">Hair Concierge</h1>
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
                onClick={() => {
                  setView("tabs")
                  setError(null)
                  setPassword("")
                  setConfirmPassword("")
                }}
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

  // Forgot password sub-view
  if (view === "forgot") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="font-header text-4xl tracking-tight text-foreground">Passwort vergessen?</h1>
            <p className="text-lg text-muted-foreground">
              Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zuruecksetzen.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-8 shadow-sm">
            <div className="space-y-4">
              {displayError && (
                <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {displayError}
                </div>
              )}
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
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading === "email" ? "Wird gesendet..." : "Link senden"}
                </button>
              </form>
              <button
                onClick={() => {
                  setView("tabs")
                  setError(null)
                }}
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

  // Main tabbed view (login / signup)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="font-header text-4xl tracking-tight text-foreground">
            {copy?.heading ?? "Hair Concierge"}
          </h1>
          <p className="text-lg text-muted-foreground">
            {copy?.subtext ?? "Dein persoenlicher Haar-Experte — powered by AI"}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <Tabs defaultValue={defaultTab} onValueChange={() => { setError(null); setPassword(""); setConfirmPassword("") }}>
            <TabsList className="mb-4 grid w-full grid-cols-2">
              <TabsTrigger value="login">Anmelden</TabsTrigger>
              <TabsTrigger value="signup">Registrieren</TabsTrigger>
            </TabsList>

            {/* Login Tab */}
            <TabsContent value="login">
              <div className="space-y-4">
                {displayError && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {displayError}
                  </div>
                )}

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
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading === "email" ? "Wird geladen..." : "Anmelden"}
                  </button>
                </form>

                <button
                  onClick={() => {
                    setView("forgot")
                    setError(null)
                    setPassword("")
                  }}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  Passwort vergessen?
                </button>

                {divider}
                {googleButton}
              </div>
            </TabsContent>

            {/* Signup Tab */}
            <TabsContent value="signup">
              <div className="space-y-4">
                {displayError && (
                  <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {displayError}
                  </div>
                )}

                <form onSubmit={handleSignup} className="space-y-3">
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
                    placeholder="Passwort (min. 8 Zeichen)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading !== null}
                    required
                    minLength={8}
                    className="h-11"
                  />
                  <Input
                    type="password"
                    placeholder="Passwort bestaetigen"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading !== null}
                    required
                    minLength={8}
                    className="h-11"
                  />
                  <button
                    type="submit"
                    disabled={loading !== null || !email.trim() || !password || !confirmPassword}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading === "email" ? "Wird geladen..." : "Konto erstellen"}
                  </button>
                </form>

                {divider}
                {googleButton}
              </div>
            </TabsContent>
          </Tabs>
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

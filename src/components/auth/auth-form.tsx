"use client"

import { createClient } from "@/lib/supabase/client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { linkLeadAction } from "@/app/auth/actions"

interface AuthFormProps {
  defaultTab: "login" | "signup"
  defaultEmail?: string
  leadId?: string | null
  next: string
  showForgotPassword?: boolean
  onEmailSent?: (email: string, type: "reset" | "confirm" | "magic_link") => void
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

function mapMagicLinkError(message: string): string {
  if (
    message.includes("User not found") ||
    message.includes("user not found") ||
    message.includes("Email link is invalid or has expired")
  ) {
    return "Wir konnten kein Konto mit dieser E-Mail finden. Hast du schon ein Abo abgeschlossen?"
  }
  return message
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
  defaultTab,
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
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<"tabs" | "forgot">("tabs")

  const submitBtnClass =
    "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"

  const errorBanner = error ? (
    <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
  ) : null

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
    redirectUrl.searchParams.set("next", next)

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
      onEmailSent?.(trimmedEmail, "confirm")
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
      onEmailSent?.(trimmedEmail, "reset")
      setLoading(null)
    }
  }

  async function handleMagicLink(e: React.MouseEvent) {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("Bitte gib deine E-Mail-Adresse ein.")
      return
    }

    setLoading("magic_link")
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        shouldCreateUser: false,
      },
    })

    if (error) {
      console.error("Magic link error:", error)
      setError(mapMagicLinkError(error.message))
      setLoading(null)
    } else {
      onEmailSent?.(trimmedEmail, "magic_link")
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
            setView("tabs")
            setError(null)
          }}
          className="text-sm text-primary hover:underline"
        >
          Zurueck zur Anmeldung
        </button>
      </div>
    )
  }

  // Main tabbed view
  return (
    <Tabs
      defaultValue={defaultTab}
      onValueChange={() => {
        setError(null)
        setPassword("")
        setConfirmPassword("")
      }}
    >
      <TabsList className="mb-4 grid w-full grid-cols-2">
        <TabsTrigger value="login">Anmelden</TabsTrigger>
        <TabsTrigger value="signup">Registrieren</TabsTrigger>
      </TabsList>

      {/* Login Tab */}
      <TabsContent value="login">
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
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
              className={submitBtnClass}
            >
              {loading === "email" ? "Wird geladen..." : "Anmelden"}
            </button>
          </form>

          <div className="flex flex-col gap-2">
            <button
              onClick={handleMagicLink}
              disabled={loading !== null || !email.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-transparent px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              {loading === "magic_link" ? "Wird gesendet..." : "Oder per E-Mail-Link anmelden"}
            </button>

            {showForgotPassword && (
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
            )}
          </div>
        </div>
      </TabsContent>

      {/* Signup Tab */}
      <TabsContent value="signup">
        <div className="space-y-4">
          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
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
              className={submitBtnClass}
            >
              {loading === "email" ? "Wird geladen..." : "Konto erstellen"}
            </button>
          </form>
        </div>
      </TabsContent>
    </Tabs>
  )
}

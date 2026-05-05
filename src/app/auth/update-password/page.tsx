"use client"

import { createClient } from "@/lib/supabase/client"
import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import {
  extractSupabaseHashSession,
  mapPasswordUpdateError,
  PASSWORD_RESET_LINK_ERROR,
  type PasswordResetMessage,
} from "@/lib/auth/password-reset"

const UPDATE_TIMEOUT_MS = 15_000
const UPDATE_TIMEOUT_ERROR: PasswordResetMessage = {
  message: "Speichern dauert zu lange.",
  guidance: "Bitte prüfe deine Verbindung und versuche es erneut.",
}

export default function UpdatePasswordPage() {
  const supabase = useMemo(() => createClient({ detectSessionInUrl: false }), [])

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<PasswordResetMessage | null>(null)
  const [success, setSuccess] = useState(false)
  const [checking, setChecking] = useState(true)
  const [canUpdatePassword, setCanUpdatePassword] = useState(false)
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string | null>(null)
  const [recoveryEmail, setRecoveryEmail] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function preparePasswordSession() {
      const code = new URLSearchParams(window.location.search).get("code")
      const hashSession = extractSupabaseHashSession(window.location.hash)

      if (hashSession) {
        window.history.replaceState({}, "", "/auth/update-password")
        const { email, error } = await getRecoveryUser(hashSession.access_token)
        if (!active) return

        if (error) {
          console.error("Password recovery token validation failed:", error)
          setError(PASSWORD_RESET_LINK_ERROR)
          setChecking(false)
          return
        }

        setRecoveryAccessToken(hashSession.access_token)
        setRecoveryEmail(email)
        setCanUpdatePassword(true)
        setChecking(false)
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!active) return

        if (error) {
          console.error("Password recovery session exchange failed:", error)
          setError(PASSWORD_RESET_LINK_ERROR)
          setChecking(false)
          return
        }

        window.history.replaceState({}, "", "/auth/update-password")
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!active) return

      if (!user) {
        setError(PASSWORD_RESET_LINK_ERROR)
        setChecking(false)
      } else {
        setCanUpdatePassword(true)
        setChecking(false)
      }
    }

    preparePasswordSession()

    return () => {
      active = false
    }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 8) {
      setError({ message: "Passwort muss mindestens 8 Zeichen lang sein." })
      return
    }
    if (password !== confirmPassword) {
      setError({ message: "Passwörter stimmen nicht überein." })
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { error } = await withUpdateTimeout(
        recoveryAccessToken
          ? updatePasswordWithRecoveryToken(recoveryAccessToken, password)
          : supabase.auth.updateUser({ password }),
      )

      if (error) {
        console.error("Update password error:", error)
        setError(mapPasswordUpdateError(error))
        setLoading(false)
      } else {
        if (recoveryEmail) {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: recoveryEmail,
            password,
          })

          if (signInError) {
            console.error("Password recovery sign-in failed:", signInError)
            setSuccess(true)
            setLoading(false)
            setTimeout(() => window.location.assign("/auth?reason=password_updated"), 1200)
            return
          }
        }

        setSuccess(true)
        setLoading(false)
        setTimeout(() => window.location.assign("/chat"), 1200)
      }
    } catch (err) {
      console.error("Update password failed:", err)
      setError(
        err instanceof PasswordUpdateTimeoutError
          ? UPDATE_TIMEOUT_ERROR
          : mapPasswordUpdateError(err),
      )
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="font-header text-4xl tracking-tight text-foreground">
            Passwort festlegen
          </h1>
          <p className="text-lg text-muted-foreground">Wähle ein Passwort für dein Konto.</p>
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-sm">
          {success ? (
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Passwort erfolgreich gespeichert!
              </h2>
              <p className="text-sm text-muted-foreground">Wir leiten dich jetzt weiter...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {error && <PasswordResetErrorBanner error={error} />}

              {canUpdatePassword && (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Input
                    type="password"
                    placeholder="Neues Passwort (min. 8 Zeichen)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={8}
                    className="h-11"
                  />
                  <Input
                    type="password"
                    placeholder="Passwort wiederholen"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    required
                    minLength={8}
                    className="h-11"
                  />
                  <button
                    type="submit"
                    disabled={loading || !password || !confirmPassword}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {loading ? "Wird gespeichert..." : "Passwort speichern"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <footer className="flex justify-center gap-4 text-xs text-muted-foreground">
          <a href="/impressum" className="px-2 py-2 hover:underline">
            Impressum
          </a>
          <a href="/datenschutz" className="px-2 py-2 hover:underline">
            Datenschutz
          </a>
        </footer>
      </div>
    </div>
  )
}

class PasswordUpdateTimeoutError extends Error {
  constructor() {
    super(UPDATE_TIMEOUT_ERROR.message)
    this.name = "PasswordUpdateTimeoutError"
  }
}

function withUpdateTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new PasswordUpdateTimeoutError()), UPDATE_TIMEOUT_MS)
    }),
  ]).finally(() => {
    if (timeout) clearTimeout(timeout)
  })
}

async function getRecoveryUser(
  accessToken: string,
): Promise<{ email: string | null; error: unknown | null }> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const body = await parseSupabaseBody(response)
  if (!response.ok) return { email: null, error: body }

  return {
    email: typeof body.email === "string" ? body.email : null,
    error: null,
  }
}

async function updatePasswordWithRecoveryToken(accessToken: string, password: string) {
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
  })

  if (response.ok) return { error: null }
  return { error: await parseSupabaseBody(response) }
}

async function parseSupabaseBody(response: Response) {
  try {
    return await response.json()
  } catch {
    return { message: response.statusText, code: String(response.status) }
  }
}

function PasswordResetErrorBanner({ error }: { error: PasswordResetMessage }) {
  return (
    <div className="space-y-3 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="font-medium">{error.message}</div>
      {error.guidance && <div className="leading-5 text-destructive/90">{error.guidance}</div>}
      {error.actionHref && error.actionLabel && (
        <a
          href={error.actionHref}
          className="inline-flex w-full items-center justify-center rounded-md border border-destructive/20 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          {error.actionLabel}
        </a>
      )}
    </div>
  )
}

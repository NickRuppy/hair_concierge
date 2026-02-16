"use client"

import { createClient } from "@/lib/supabase/client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"

export default function UpdatePasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/auth")
      } else {
        setChecking(false)
      }
    })
  }, [supabase, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwoerter stimmen nicht ueberein.")
      return
    }

    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      console.error("Update password error:", error)
      setError("Passwort konnte nicht geaendert werden. Bitte versuche es erneut.")
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push("/chat"), 2000)
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
            Neues Passwort setzen
          </h1>
          <p className="text-lg text-muted-foreground">
            Waehle ein neues Passwort fuer dein Konto.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-8 shadow-sm">
          {success ? (
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground">
                Passwort erfolgreich geaendert!
              </h2>
              <p className="text-sm text-muted-foreground">
                Du wirst gleich weitergeleitet...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}

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
                  placeholder="Passwort bestaetigen"
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
                  {loading ? "Wird gespeichert..." : "Passwort aendern"}
                </button>
              </form>
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

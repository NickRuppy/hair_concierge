"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState } from "react"

import { WAITLIST_EMAIL_STORAGE_KEY } from "@/lib/waitlist/config"

const inputClass =
  "w-full rounded-[10px] border border-border bg-card px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-plum)] focus-visible:ring-offset-2"

export function WaitlistForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return

    setPending(true)
    setError(null)

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setError(payload?.error ?? "Das hat gerade nicht geklappt. Bitte versuch es nochmal.")
        setPending(false)
        return
      }

      // Die E-Mail wandert bewusst ueber sessionStorage und nicht als Query-Parameter
      // zur Umfrage: personenbezogene Daten gehoeren nicht in eine URL.
      try {
        window.sessionStorage.setItem(WAITLIST_EMAIL_STORAGE_KEY, email.trim().toLowerCase())
      } catch {
        // Privater Modus o.ae. Die Umfrage funktioniert auch ohne Zuordnung.
      }

      router.push("/warteliste/umfrage")
    } catch {
      setError("Keine Verbindung. Bitte pruef dein Netz und versuch es nochmal.")
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="waitlist-name" className="sr-only">
          Vorname
        </label>
        <input
          id="waitlist-name"
          name="name"
          type="text"
          autoComplete="given-name"
          required
          minLength={2}
          maxLength={80}
          placeholder="Dein Vorname"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="waitlist-email" className="sr-only">
          E-Mail-Adresse
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={160}
          placeholder="Deine E-Mail-Adresse"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-[var(--brand-coral-dark,#b4444f)]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 w-full rounded-[10px] bg-[var(--brand-coral)] px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-[var(--brand-coral-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-coral)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Einen Moment ..." : "Platz auf der Warteliste sichern"}
      </button>

      <p className="mt-1 text-center text-xs leading-relaxed text-muted-foreground">
        Mit dem Eintragen bekommst du E-Mails zum Start von chaarlie. Abmelden geht jederzeit mit
        einem Klick. Mehr dazu in der{" "}
        <Link href="/datenschutz" className="underline underline-offset-2">
          Datenschutzerklärung
        </Link>
        .
      </p>
    </form>
  )
}

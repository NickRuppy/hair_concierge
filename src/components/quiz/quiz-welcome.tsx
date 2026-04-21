"use client"

import { useState } from "react"
import { useQuizStore } from "@/lib/quiz/store"
import { AuthForm } from "@/components/auth/auth-form"
import { Mail } from "lucide-react"

export function QuizWelcome() {
  const lead = useQuizStore((s) => s.lead)
  const leadId = useQuizStore((s) => s.leadId)

  const [emailSent, setEmailSent] = useState<{
    email: string
    type: "reset" | "confirm" | "magic_link"
  } | null>(null)

  if (emailSent) {
    return (
      <div className="flex flex-col animate-fade-in-up">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "rgba(var(--brand-plum-rgb), 0.15)" }}
          >
            <Mail className="h-6 w-6 text-[var(--brand-plum)]" />
          </div>
          <h2 className="font-header text-2xl text-foreground mb-2">Prüfe dein Postfach</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {emailSent.type === "confirm" ? (
              <>
                Wir haben eine Bestätigungs-E-Mail an{" "}
                <span className="font-medium text-foreground">{emailSent.email}</span> gesendet.
                Klicke auf den Link, um dein Konto zu aktivieren.
              </>
            ) : (
              <>
                Wir haben eine E-Mail an{" "}
                <span className="font-medium text-foreground">{emailSent.email}</span> gesendet.
                Klicke auf den Link, um dein Passwort zurückzusetzen.
              </>
            )}
          </p>
          <button
            onClick={() => setEmailSent(null)}
            className="text-sm text-[var(--brand-plum)] hover:underline"
          >
            Zurück
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col animate-fade-in-up">
      <div className="flex-1 flex flex-col justify-center">
        <h2 className="font-header text-4xl text-foreground mb-3">
          Profil speichern &amp; weitermachen
        </h2>
        <p className="text-base text-muted-foreground mb-2 leading-relaxed">
          Noch 3 kurze Schritte bis zu deinem vollständigen Profil
        </p>
        <p className="text-sm text-[var(--text-sub)] mb-8 leading-relaxed">
          Damit dein Profil gespeichert bleibt und deine Beratung darauf aufbauen kann.
        </p>

        <AuthForm
          defaultTab="signup"
          defaultEmail={lead.email}
          leadId={leadId}
          next="/onboarding"
          showForgotPassword={false}
          onEmailSent={(email, type) => setEmailSent({ email, type })}
        />
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { useQuizStore } from "@/lib/quiz/store"
import { AuthForm } from "@/components/auth/auth-form"
import { Mail } from "lucide-react"

export function QuizWelcome() {
  const lead = useQuizStore((s) => s.lead)
  const leadId = useQuizStore((s) => s.leadId)

  const [emailSent, setEmailSent] = useState<{ email: string; type: "reset" | "confirm" } | null>(null)

  if (emailSent) {
    return (
      <div className="flex flex-col animate-fade-in-up">
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#F5C518]/20">
            <Mail className="h-6 w-6 text-[#F5C518]" />
          </div>
          <h2 className="font-header text-2xl text-white mb-2">Pruefe dein Postfach</h2>
          <p className="text-sm text-white/60 mb-4">
            {emailSent.type === "confirm"
              ? <>Wir haben eine Bestaetigungs-E-Mail an <span className="font-medium text-white">{emailSent.email}</span> gesendet. Klicke auf den Link, um dein Konto zu aktivieren.</>
              : <>Wir haben eine E-Mail an <span className="font-medium text-white">{emailSent.email}</span> gesendet. Klicke auf den Link, um dein Passwort zurueckzusetzen.</>}
          </p>
          <button
            onClick={() => setEmailSent(null)}
            className="text-sm text-[#F5C518] hover:underline"
          >
            Zurueck
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col animate-fade-in-up">
      <div className="flex-1 flex flex-col justify-center">
        <h2 className="font-header text-4xl text-white mb-3">
          PROFIL SPEICHERN &amp; WEITERMACHEN
        </h2>
        <p className="text-base text-white/60 mb-2 leading-relaxed">
          Noch 3 kurze Schritte bis zu deinem vollstaendigen Profil
        </p>
        <p className="text-sm text-white/40 mb-8 leading-relaxed">
          Damit dein Profil gespeichert bleibt und TomBot darauf aufbauen kann.
        </p>

        <AuthForm
          theme="dark"
          defaultTab="signup"
          defaultEmail={lead.email}
          leadId={leadId}
          next="/onboarding/goals"
          showForgotPassword={false}
          onEmailSent={(email, type) => setEmailSent({ email, type })}
        />
      </div>
    </div>
  )
}

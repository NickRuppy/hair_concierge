"use client"

import { useState } from "react"
import { useQuizStore } from "@/lib/quiz/store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { QuizProgressBar } from "./quiz-progress-bar"
import { QuizConsentSheet } from "./quiz-consent-sheet"
import { ArrowLeft } from "lucide-react"

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function QuizLeadCapture() {
  const {
    leadCaptureSubStep,
    setLeadCaptureSubStep,
    lead,
    setLeadField,
    answers,
    setLeadId,
    goNext,
    goBack,
  } = useQuizStore()

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleNameSubmit = () => {
    if (lead.name.trim()) {
      setLeadCaptureSubStep("email")
    }
  }

  const handleEmailSubmit = () => {
    if (isValidEmail(lead.email)) {
      setLeadCaptureSubStep("consent")
    }
  }

  const handleConsent = async (accepted: boolean) => {
    setLeadField("marketingConsent", accepted)
    setSaving(true)
    setError("")

    try {
      const res = await fetch("/api/quiz/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: lead.name.trim(),
          email: lead.email.trim().toLowerCase(),
          marketingConsent: accepted,
          quizAnswers: answers,
        }),
      })

      if (!res.ok) throw new Error("Speichern fehlgeschlagen")

      const data = await res.json()
      setLeadId(data.leadId)
      goNext()
    } catch {
      setError("Etwas ist schiefgelaufen. Bitte versuche es erneut.")
      setLeadCaptureSubStep("email")
    } finally {
      setSaving(false)
    }
  }

  const handleBack = () => {
    if (leadCaptureSubStep === "email") {
      setLeadCaptureSubStep("name")
    } else if (leadCaptureSubStep === "name") {
      goBack()
    }
  }

  return (
    <div className="flex flex-col" key={leadCaptureSubStep}>
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={handleBack} className="text-white/60 hover:text-white transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <QuizProgressBar current={7} total={7} />
        </div>
      </div>

      {/* Yellow banner (was green) */}
      <div className="mb-6 flex items-center gap-2 rounded-xl bg-[#F5C518]/15 px-3 py-2.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F5C518]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 4" stroke="#1A1618" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-base font-medium text-white">Dein persoenlicher Pflegeplan ist bereit!</span>
      </div>

      {/* Sub-step content */}
      {leadCaptureSubStep === "name" && (
        <div className="animate-fade-in-up flex-1 flex flex-col">
          <h2 className="font-header text-3xl text-white mb-6">WIE HEISST DU?</h2>
          <Input
            value={lead.name}
            onChange={(e) => setLeadField("name", e.target.value)}
            placeholder="Dein Vorname"
            autoFocus
            className="h-14 rounded-xl bg-white/7 border-white/11 text-white placeholder:text-white/38 text-base mb-4"
            onKeyDown={(e) => { if (e.key === "Enter") handleNameSubmit() }}
          />
          <div className="mt-auto pt-4">
            <Button
              onClick={handleNameSubmit}
              disabled={!lead.name.trim()}
              variant="unstyled"
              className={`w-full h-14 text-base font-bold tracking-wide rounded-xl ${lead.name.trim() ? "quiz-btn-primary" : "disabled:opacity-40"}`}
            >
              WEITER
            </Button>
          </div>
        </div>
      )}

      {leadCaptureSubStep === "email" && (
        <div className="animate-fade-in-up flex-1 flex flex-col">
          <h2 className="font-header text-3xl text-white mb-6">DEINE E-MAIL ADRESSE</h2>
          <Input
            type="email"
            value={lead.email}
            onChange={(e) => setLeadField("email", e.target.value)}
            placeholder="name@beispiel.de"
            autoFocus
            className="h-14 rounded-xl bg-white/7 border-white/11 text-white placeholder:text-white/38 text-base mb-3"
            onKeyDown={(e) => { if (e.key === "Enter") handleEmailSubmit() }}
          />
          <div className="flex items-start gap-2 mb-4">
            <span className="text-sm">&#128274;</span>
            <p className="text-sm text-white/38 leading-relaxed">
              Wir schuetzen deine Daten und nehmen Datenschutz sehr ernst – kein Spam.
            </p>
          </div>
          {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
          <div className="mt-auto pt-4">
            <Button
              onClick={handleEmailSubmit}
              disabled={!isValidEmail(lead.email) || saving}
              variant="unstyled"
              className={`w-full h-14 text-base font-bold tracking-wide rounded-xl ${isValidEmail(lead.email) ? "quiz-btn-primary" : "disabled:opacity-40"}`}
            >
              {saving ? "WIRD GESPEICHERT..." : "WEITER"}
            </Button>
          </div>
        </div>
      )}

      {/* Consent inline card */}
      <QuizConsentSheet
        open={leadCaptureSubStep === "consent"}
        onConsent={handleConsent}
      />
    </div>
  )
}

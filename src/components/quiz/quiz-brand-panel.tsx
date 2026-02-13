"use client"

import { useQuizStore } from "@/lib/quiz/store"

export function QuizBrandPanel() {
  const step = useQuizStore((s) => s.step)
  const leadCaptureSubStep = useQuizStore((s) => s.leadCaptureSubStep)

  const questionNumber = step >= 2 && step <= 8 ? step - 1 : null

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-12">
      {/* Charcoal base + noise texture */}
      <div className="absolute inset-0 bg-[#1A1618]" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Yellow brush-stroke accent */}
      <div
        className="absolute left-[-20%] top-[15%] h-[300px] w-[140%] rotate-[-8deg] opacity-[0.07]"
        style={{
          background: "linear-gradient(90deg, transparent, #FFBE10 30%, #F5C518 70%, transparent)",
          borderRadius: "50%",
          filter: "blur(40px)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-[360px] text-center">
        {step === 1 && <LandingPanel />}
        {questionNumber !== null && <QuestionPanel questionNumber={questionNumber} />}
        {step === 9 && <LeadCapturePanel subStep={leadCaptureSubStep} />}
        {step === 10 && <AnalysisPanel />}
        {step === 11 && <ResultsPanel />}
        {step === 14 && <WelcomePanel />}
      </div>
    </div>
  )
}

function LandingPanel() {
  return (
    <>
      <h1 className="font-header text-6xl leading-[0.95] text-white mb-6">
        THE.<br />
        BEAUTIFUL.<br />
        PEOPLE.
      </h1>
      <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-[#F5C518]" />
      <p className="text-lg text-white/50 leading-relaxed">
        Dein Haar verdient mehr als Raten.
        <br />
        Finde heraus, was es wirklich braucht.
      </p>
    </>
  )
}

function QuestionPanel({ questionNumber }: { questionNumber: number }) {
  return (
    <>
      <div className="mb-6 font-header text-sm tracking-[0.2em] text-[#F5C518]">
        FRAGE {questionNumber} VON 7
      </div>
      <h2 className="font-header text-5xl leading-[0.95] text-white mb-6">
        TOM<br />BOT
      </h2>
      <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#F5C518]/40" />
      <p className="text-sm text-white/40">
        Dein persoenlicher Haar-Experte
      </p>
    </>
  )
}

function LeadCapturePanel({ subStep }: { subStep: string }) {
  return (
    <>
      <h2 className="font-header text-5xl leading-[0.95] text-white mb-6">
        TOM<br />BOT
      </h2>
      <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-[#F5C518]/40" />
      <p className="text-lg text-white/50 leading-relaxed">
        {subStep === "consent"
          ? "Gleich hast du deinen Plan."
          : "Dein Profil ist fast fertig."}
      </p>
    </>
  )
}

function AnalysisPanel() {
  return (
    <>
      <h2 className="font-header text-5xl leading-[0.95] text-white mb-6">
        TOM<br />BOT
      </h2>
      <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-[#F5C518]/40" />
      <p className="font-header text-2xl tracking-wider text-[#F5C518] animate-pulse">
        ANALYSIERE...
      </p>
    </>
  )
}

function ResultsPanel() {
  return (
    <>
      <h2 className="font-header text-5xl leading-[0.95] text-white mb-6">
        TOM<br />BOT
      </h2>
      <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-[#F5C518]/40" />
      <p className="text-lg text-white/50 leading-relaxed">
        Dein Haarprofil
      </p>
    </>
  )
}

function WelcomePanel() {
  return (
    <>
      <h2 className="font-header text-5xl leading-[0.95] text-white mb-6">
        TOM<br />BOT
      </h2>
      <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-[#F5C518]/40" />
      <p className="text-lg text-white/50 leading-relaxed">
        Willkommen
      </p>
    </>
  )
}

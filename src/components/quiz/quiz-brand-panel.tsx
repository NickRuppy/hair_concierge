"use client"

import { useQuizStore } from "@/lib/quiz/store"

export function QuizBrandPanel() {
  const step = useQuizStore((s) => s.step)
  const leadCaptureSubStep = useQuizStore((s) => s.leadCaptureSubStep)

  const QUESTION_NUMBER_MAP: Record<number, number> = {
    2: 1, // texture
    3: 2, // thickness
    4: 3, // surface
    5: 4, // pull
    7: 5, // chemical
    6: 6, // scalp
  }
  const questionNumber = QUESTION_NUMBER_MAP[step] ?? null

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center px-12">
      {/* Light plum base */}
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      {/* Plum brush-stroke accent */}
      <div
        className="absolute left-[-20%] top-[15%] h-[300px] w-[140%] rotate-[-8deg] opacity-[0.07]"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--brand-plum) 30%, var(--brand-plum-dark) 70%, transparent)",
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
      <h1 className="font-header text-6xl leading-[0.95] text-foreground mb-6">
        Hair
        <br />
        Concierge
      </h1>
      <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-[var(--brand-plum)]" />
      <p className="text-lg text-muted-foreground leading-relaxed">
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
      <div className="mb-6 font-header text-sm tracking-[0.2em] text-[var(--brand-plum)]">
        FRAGE {questionNumber} VON 6
      </div>
      <h2 className="font-header text-5xl leading-[0.95] text-foreground mb-6">
        Hair
        <br />
        Concierge
      </h2>
      <div
        className="mx-auto mb-4 h-1 w-12 rounded-full"
        style={{ background: "rgba(var(--brand-plum-rgb), 0.4)" }}
      />
      <p className="text-sm text-[var(--text-caption)]">Personalisierte Haarpflege-Beratung</p>
    </>
  )
}

function LeadCapturePanel({ subStep }: { subStep: string }) {
  return (
    <>
      <h2 className="font-header text-5xl leading-[0.95] text-foreground mb-6">
        Hair
        <br />
        Concierge
      </h2>
      <div
        className="mx-auto mb-6 h-1 w-12 rounded-full"
        style={{ background: "rgba(var(--brand-plum-rgb), 0.4)" }}
      />
      <p className="text-lg text-muted-foreground leading-relaxed">
        {subStep === "consent" ? "Gleich hast du deinen Plan." : "Dein Profil ist fast fertig."}
      </p>
    </>
  )
}

function AnalysisPanel() {
  return (
    <>
      <h2 className="font-header text-5xl leading-[0.95] text-foreground mb-6">
        Hair
        <br />
        Concierge
      </h2>
      <div
        className="mx-auto mb-6 h-1 w-12 rounded-full"
        style={{ background: "rgba(var(--brand-plum-rgb), 0.4)" }}
      />
      <p className="font-header text-2xl tracking-wider text-[var(--brand-plum)] animate-pulse">
        Analysiere...
      </p>
    </>
  )
}

function ResultsPanel() {
  return (
    <>
      <h2 className="font-header text-5xl leading-[0.95] text-foreground mb-6">
        Hair
        <br />
        Concierge
      </h2>
      <div
        className="mx-auto mb-6 h-1 w-12 rounded-full"
        style={{ background: "rgba(var(--brand-plum-rgb), 0.4)" }}
      />
      <p className="text-lg text-muted-foreground leading-relaxed">Deine Diagnose</p>
    </>
  )
}

function WelcomePanel() {
  return (
    <>
      <h2 className="font-header text-5xl leading-[0.95] text-foreground mb-6">
        Hair
        <br />
        Concierge
      </h2>
      <div
        className="mx-auto mb-6 h-1 w-12 rounded-full"
        style={{ background: "rgba(var(--brand-plum-rgb), 0.4)" }}
      />
      <p className="text-lg text-muted-foreground leading-relaxed">Dein nächster Schritt</p>
    </>
  )
}

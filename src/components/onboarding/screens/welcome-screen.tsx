"use client"

interface WelcomeScreenProps {
  onContinue: () => void
}

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1
        className="animate-fade-in-up font-header text-3xl leading-tight text-white mb-4"
      >
        Willkommen bei TomBot!
      </h1>

      <p
        className="animate-fade-in-up text-base text-white/70 leading-relaxed mb-10 max-w-md"
        style={{ animationDelay: "100ms" }}
      >
        In wenigen Schritten lernst du, wie du dein Haar optimal pflegen kannst.
        Lass uns mit deiner aktuellen Routine starten.
      </p>

      <div
        className="animate-fade-in-up w-full"
        style={{ animationDelay: "200ms" }}
      >
        <button onClick={onContinue} className="quiz-btn-primary w-full">
          LOS GEHT&apos;S
        </button>
      </div>
    </div>
  )
}

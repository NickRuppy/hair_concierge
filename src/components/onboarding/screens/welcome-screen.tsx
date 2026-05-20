"use client"

interface WelcomeScreenProps {
  onContinue: () => void
}

export function WelcomeScreen({ onContinue }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center text-center">
      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-foreground mb-4">
        Hi, ich bin Chaarlie 👋
      </h1>

      <p
        className="animate-fade-in-up text-base text-muted-foreground leading-relaxed mb-10 max-w-md"
        style={{ animationDelay: "100ms" }}
      >
        Schön, dass du da bist! In wenigen Schritten lerne ich dein Haar kennen — und kann dir
        zeigen, was wirklich zu dir passt. Lass uns mit deiner aktuellen Routine starten.
      </p>

      <div className="animate-fade-in-up w-full" style={{ animationDelay: "200ms" }}>
        <button onClick={onContinue} className="quiz-btn-primary w-full">
          LOS GEHT&apos;S
        </button>
      </div>
    </div>
  )
}

"use client"

interface CelebrationPopupProps {
  onDismiss: () => void
}

export function CelebrationPopup({ onDismiss }: CelebrationPopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="animate-scale-in mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-2xl">
        <h2 className="font-header text-3xl leading-tight text-foreground mb-4">
          Geschafft! {"\u{1F389}"}
        </h2>

        <p className="text-base text-muted-foreground leading-relaxed mb-8">
          Dein Haarprofil ist komplett. Hair Concierge kann dir jetzt personalisierte Empfehlungen
          geben.
        </p>

        <button onClick={onDismiss} className="quiz-btn-primary w-full">
          ZUM CHAT
        </button>
      </div>
    </div>
  )
}

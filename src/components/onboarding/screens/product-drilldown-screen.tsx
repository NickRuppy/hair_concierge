"use client"

import { ArrowLeft } from "lucide-react"
import { PRODUCT_FREQUENCY_OPTIONS } from "@/lib/vocabulary"
import type { ProductFrequency } from "@/lib/vocabulary"

interface ProductDrilldownScreenProps {
  category: string
  categoryLabel: string
  subtitle?: string
  productName: string
  frequency: ProductFrequency | null
  onProductNameChange: (name: string) => void
  onFrequencyChange: (freq: ProductFrequency) => void
  onContinue: () => void
  onBack: () => void
}

export function ProductDrilldownScreen({
  categoryLabel,
  subtitle,
  productName,
  frequency,
  onProductNameChange,
  onFrequencyChange,
  onContinue,
  onBack,
}: ProductDrilldownScreenProps) {
  return (
    <div>
      <button
        onClick={onBack}
        aria-label="Zurück"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-foreground mb-2">
        Dein {categoryLabel}
      </h1>

      <p
        className="animate-fade-in-up text-sm text-[var(--text-sub)] mb-6"
        style={{ animationDelay: "50ms" }}
      >
        {subtitle ?? "Welches Produkt nutzt du und wie oft?"}
      </p>

      {/* Product name input */}
      <div className="animate-fade-in-up mb-6" style={{ animationDelay: "100ms" }}>
        <input
          type="text"
          value={productName}
          onChange={(e) => onProductNameChange(e.target.value)}
          placeholder="z.B. Produktname oder Marke"
          className="w-full rounded-xl border border-border bg-muted px-4 py-3 text-base text-foreground placeholder:text-[var(--text-caption)] focus:border-[var(--brand-plum)]/50 focus:outline-none focus:ring-1 focus:ring-[var(--brand-plum)]/30 transition-colors"
        />
      </div>

      {/* Frequency pills */}
      <div className="animate-fade-in-up mb-8" style={{ animationDelay: "160ms" }}>
        <p className="text-sm text-[var(--text-sub)] mb-3">Wie oft?</p>
        <div className="flex flex-wrap gap-2">
          {PRODUCT_FREQUENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFrequencyChange(option.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                frequency === option.value
                  ? "border-secondary bg-secondary text-secondary-foreground"
                  : "border-border text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: "220ms" }}>
        <button
          onClick={onContinue}
          disabled={!frequency}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Weiter
        </button>
      </div>
    </div>
  )
}

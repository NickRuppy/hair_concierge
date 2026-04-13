"use client"

import { ArrowLeft } from "lucide-react"
import { QuizOptionCard } from "@/components/quiz/quiz-option-card"
import { STYLING_TOOL_OPTIONS } from "@/lib/vocabulary"
import type { IconName } from "@/components/ui/icon"

const HEAT_TOOL_ICONS: Record<string, IconName> = {
  blow_dryer: "heat-blow-dryer",
  flat_iron: "heat-flat-iron",
  curling_iron: "heat-curling-iron",
  wave_iron: "heat-wave-iron",
  hot_air_brush: "heat-hot-air-brush",
  multi_tool: "heat-multi-tool",
  diffuser: "heat-diffuser",
}

interface HeatToolsScreenProps {
  selected: string[]
  onToggle: (tool: string) => void
  onContinue: () => void
  onBack: () => void
  onNone: () => void
  isSaving?: boolean
}

export function HeatToolsScreen({
  selected,
  onToggle,
  onContinue,
  onBack,
  onNone,
  isSaving,
}: HeatToolsScreenProps) {
  const hasSelection = selected.length > 0

  return (
    <div>
      <button
        onClick={onBack}
        disabled={isSaving}
        aria-label="Zurück"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-muted-foreground hover:text-foreground transition-colors mb-2 disabled:opacity-40"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>

      <h1 className="animate-fade-in-up font-header text-3xl leading-tight text-foreground mb-2">
        Welche Hitzetools nutzt du?
      </h1>

      <p
        className="animate-fade-in-up text-sm text-[var(--text-sub)] mb-6"
        style={{ animationDelay: "50ms" }}
      >
        Mehrfachauswahl möglich.
      </p>

      <div className="space-y-3 mb-6">
        {STYLING_TOOL_OPTIONS.map((option, i) => (
          <QuizOptionCard
            key={option.value}
            icon={HEAT_TOOL_ICONS[option.value] ?? "heat-tool"}
            label={option.label}
            active={selected.includes(option.value)}
            disabled={isSaving}
            onClick={() => onToggle(option.value)}
            animationDelay={100 + i * 60}
          />
        ))}
      </div>

      <div
        className="animate-fade-in-up mb-6"
        style={{ animationDelay: `${100 + STYLING_TOOL_OPTIONS.length * 60}ms` }}
      >
        <button
          type="button"
          onClick={onNone}
          disabled={isSaving}
          className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-border hover:text-foreground disabled:opacity-40"
        >
          Nichts davon
        </button>
      </div>

      <div
        className="animate-fade-in-up"
        style={{ animationDelay: `${100 + (STYLING_TOOL_OPTIONS.length + 1) * 60}ms` }}
      >
        <button
          onClick={onContinue}
          disabled={!hasSelection || isSaving}
          className="quiz-btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "Speichern..." : "Weiter"}
        </button>
      </div>
    </div>
  )
}

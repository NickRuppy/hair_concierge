"use client"

interface QuizProgressBarProps {
  current: number
  total: number
}

export function QuizProgressBar({ current, total }: QuizProgressBarProps) {
  const fraction = current / total

  return (
    <div className="h-[4px] w-full rounded-full bg-border">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${fraction * 100}%`,
          background: "linear-gradient(90deg, var(--brand-plum), var(--brand-plum-dark))",
        }}
      />
    </div>
  )
}

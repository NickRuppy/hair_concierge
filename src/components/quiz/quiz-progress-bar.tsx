"use client"

interface QuizProgressBarProps {
  current: number
  total: number
}

export function QuizProgressBar({ current, total }: QuizProgressBarProps) {
  const fraction = current / total

  return (
    <div className="h-[3px] w-full rounded-full bg-white/10">
      <div
        className="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${fraction * 100}%`,
          background: "linear-gradient(90deg, #F5C518, #D4A800)",
        }}
      />
    </div>
  )
}

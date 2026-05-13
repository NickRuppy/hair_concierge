"use client"

import { useEffect, useState } from "react"

const INITIAL_SECONDS = 8 * 60 + 28

function formatRemaining(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`
}

export function ResultOfferCountdown({
  className,
  valueClassName,
  label = "Angebot läuft ab in",
}: {
  className?: string
  valueClassName?: string
  label?: string
}) {
  const [seconds, setSeconds] = useState(INITIAL_SECONDS)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  return (
    <span className={className}>
      <span
        aria-hidden="true"
        className="inline-block size-1.5 rounded-full bg-[var(--brand-coral)] motion-safe:animate-pulse"
      />
      <span>{label}</span>
      <span className={valueClassName}>{formatRemaining(seconds)}</span>
    </span>
  )
}

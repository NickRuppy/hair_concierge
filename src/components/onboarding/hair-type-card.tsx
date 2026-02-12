"use client"

import { cn } from "@/lib/utils"

interface HairTypeCardProps {
  label: string
  value: string
  selected: boolean
  onClick: () => void
  illustration: React.ReactNode
}

export function HairTypeCard({
  label,
  selected,
  onClick,
  illustration,
}: HairTypeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 p-4 transition-all hover:shadow-md cursor-pointer",
        selected
          ? "border-primary bg-primary/5 shadow-md"
          : "border-border bg-card hover:border-primary/40"
      )}
    >
      <div
        className={cn(
          "flex h-20 w-20 items-center justify-center rounded-full transition-colors",
          selected ? "bg-primary/10" : "bg-muted"
        )}
      >
        {illustration}
      </div>
      <span
        className={cn(
          "text-sm font-semibold",
          selected ? "text-primary" : "text-foreground"
        )}
      >
        {label}
      </span>
    </button>
  )
}

/* --- SVG Illustrations --- */

export function GlattSVG({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn("h-10 w-10 text-primary", className)}
    >
      <line x1="10" y1="8" x2="10" y2="40" />
      <line x1="18" y1="8" x2="18" y2="40" />
      <line x1="26" y1="8" x2="26" y2="40" />
      <line x1="34" y1="8" x2="34" y2="40" />
      <line x1="42" y1="8" x2="42" y2="40" />
    </svg>
  )
}

export function WelligSVG({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn("h-10 w-10 text-primary", className)}
    >
      <path d="M8 8 C8 16, 14 16, 14 24 C14 32, 8 32, 8 40" />
      <path d="M18 8 C18 16, 24 16, 24 24 C24 32, 18 32, 18 40" />
      <path d="M28 8 C28 16, 34 16, 34 24 C34 32, 28 32, 28 40" />
      <path d="M38 8 C38 16, 44 16, 44 24 C44 32, 38 32, 38 40" />
    </svg>
  )
}

export function LockigSVG({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn("h-10 w-10 text-primary", className)}
    >
      <path d="M10 6 C4 10, 16 14, 10 18 C4 22, 16 26, 10 30 C4 34, 16 38, 10 42" />
      <path d="M22 6 C16 10, 28 14, 22 18 C16 22, 28 26, 22 30 C16 34, 28 38, 22 42" />
      <path d="M34 6 C28 10, 40 14, 34 18 C28 22, 40 26, 34 30 C28 34, 40 38, 34 42" />
    </svg>
  )
}

export function KrausSVG({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={cn("h-10 w-10 text-primary", className)}
    >
      <path d="M8 6 C4 8, 12 10, 8 12 C4 14, 12 16, 8 18 C4 20, 12 22, 8 24 C4 26, 12 28, 8 30 C4 32, 12 34, 8 36 C4 38, 12 40, 8 42" />
      <path d="M20 6 C16 8, 24 10, 20 12 C16 14, 24 16, 20 18 C16 20, 24 22, 20 24 C16 26, 24 28, 20 30 C16 32, 24 34, 20 36 C16 38, 24 40, 20 42" />
      <path d="M32 6 C28 8, 36 10, 32 12 C28 14, 36 16, 32 18 C28 20, 36 22, 32 24 C28 26, 36 28, 32 30 C28 32, 36 34, 32 36 C28 38, 36 40, 32 42" />
      <path d="M44 6 C40 8, 48 10, 44 12 C40 14, 48 16, 44 18 C40 20, 48 22, 44 24 C40 26, 48 28, 44 30 C40 32, 48 34, 44 36 C40 38, 48 40, 44 42" />
    </svg>
  )
}

/* --- Hair Texture SVGs --- */

export function FeinSVG({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      className={cn("h-10 w-10 text-primary", className)}
    >
      <line x1="14" y1="8" x2="14" y2="40" />
      <line x1="24" y1="8" x2="24" y2="40" />
      <line x1="34" y1="8" x2="34" y2="40" />
    </svg>
  )
}

export function MittelSVG({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className={cn("h-10 w-10 text-primary", className)}
    >
      <line x1="14" y1="8" x2="14" y2="40" />
      <line x1="24" y1="8" x2="24" y2="40" />
      <line x1="34" y1="8" x2="34" y2="40" />
    </svg>
  )
}

export function DickSVG({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.5"
      strokeLinecap="round"
      className={cn("h-10 w-10 text-primary", className)}
    >
      <line x1="14" y1="8" x2="14" y2="40" />
      <line x1="24" y1="8" x2="24" y2="40" />
      <line x1="34" y1="8" x2="34" y2="40" />
    </svg>
  )
}

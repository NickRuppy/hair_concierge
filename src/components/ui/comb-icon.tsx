import { cn } from "@/lib/utils"

interface CombIconProps {
  className?: string
}

export function CombIcon({ className }: CombIconProps) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Handle */}
      <rect x="3" y="4" width="4" height="16" rx="1" />
      {/* Teeth */}
      <line x1="7" y1="6" x2="21" y2="6" />
      <line x1="7" y1="9" x2="21" y2="9" />
      <line x1="7" y1="12" x2="21" y2="12" />
      <line x1="7" y1="15" x2="21" y2="15" />
      <line x1="7" y1="18" x2="21" y2="18" />
    </svg>
  )
}

"use client"

import {
  Droplets,
  FlaskConical,
  Sparkles,
  Wind,
  Scissors,
  Palette,
  Shield,
  Pipette,
  Package,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const CATEGORY_CONFIG: Record<string, { icon: LucideIcon; bg: string }> = {
  Shampoo: { icon: Droplets, bg: "bg-blue-500/15 text-blue-400" },
  Conditioner: { icon: FlaskConical, bg: "bg-emerald-500/15 text-emerald-400" },
  Maske: { icon: Sparkles, bg: "bg-purple-500/15 text-purple-400" },
  "Leave-in": { icon: Wind, bg: "bg-teal-500/15 text-teal-400" },
  Styling: { icon: Scissors, bg: "bg-orange-500/15 text-orange-400" },
  Farbe: { icon: Palette, bg: "bg-pink-500/15 text-pink-400" },
  Kopfhaut: { icon: Shield, bg: "bg-yellow-500/15 text-yellow-400" },
  Serum: { icon: Pipette, bg: "bg-indigo-500/15 text-indigo-400" },
  Öl: { icon: Pipette, bg: "bg-amber-500/15 text-amber-400" },
}

const DEFAULT_CONFIG = { icon: Package, bg: "bg-muted text-muted-foreground" }

function getCategoryConfig(category: string | null) {
  if (!category) return DEFAULT_CONFIG
  // Check for partial match (e.g. "Shampoo (sulfatfrei)" matches "Shampoo")
  for (const [key, config] of Object.entries(CATEGORY_CONFIG)) {
    if (category.toLowerCase().includes(key.toLowerCase())) return config
  }
  return DEFAULT_CONFIG
}

interface ProductImageProps {
  imageUrl: string | null
  category: string | null
  size?: "sm" | "md" | "lg"
}

const SIZES = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
}

const ICON_SIZES = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-10 w-10",
}

export function ProductImage({ imageUrl, category, size = "md" }: ProductImageProps) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        className={`${SIZES[size]} shrink-0 rounded-xl object-cover`}
      />
    )
  }

  const { icon: Icon, bg } = getCategoryConfig(category)

  return (
    <div className={`${SIZES[size]} shrink-0 rounded-xl ${bg} flex items-center justify-center`}>
      <Icon className={ICON_SIZES[size]} />
    </div>
  )
}

export { getCategoryConfig }
